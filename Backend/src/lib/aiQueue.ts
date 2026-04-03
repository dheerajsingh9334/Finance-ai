import { createHash } from "crypto";
import { Queue, QueueEvents, Worker } from "bullmq";
import { env } from "../config/env";
import { generateAiResponse } from "../utils/ai.utils";

interface AiQueryJobData {
  systemPrompt: string;
  promptContext: string;
  maxTokens: number;
}

const connection = {
  url: env.REDIS_URL,
  maxRetriesPerRequest: null as null,
};

const QUEUE_NAME = "ai-query";

const createQueueBundle = () => {
  const queue = new Queue<AiQueryJobData, string>(QUEUE_NAME, { connection });
  const queueEvents = new QueueEvents(QUEUE_NAME, { connection });

  const worker = new Worker<AiQueryJobData, string>(
    QUEUE_NAME,
    async (job) => {
      return generateAiResponse(
        job.data.systemPrompt,
        job.data.promptContext,
        job.data.maxTokens,
      );
    },
    {
      connection,
      concurrency: 2,
    },
  );

  worker.on("failed", (job, error) => {
    console.error(`AI queue job failed: ${job?.id ?? "unknown"}`, error);
  });

  return { queue, queueEvents, worker };
};

const globalQueue = globalThis as typeof globalThis & {
  __aiQueueBundle?: ReturnType<typeof createQueueBundle>;
};

if (!globalQueue.__aiQueueBundle) {
  globalQueue.__aiQueueBundle = createQueueBundle();
}

const { queue, queueEvents } = globalQueue.__aiQueueBundle;

const buildJobId = (userId: string, question: string): string => {
  const normalized = question.trim().toLowerCase();
  return createHash("sha256").update(`${userId}:${normalized}`).digest("hex");
};

export const runAiQueryJob = async (
  userId: string,
  question: string,
  payload: AiQueryJobData,
): Promise<string> => {
  const jobId = buildJobId(userId, question);

  let job = await queue.getJob(jobId);
  if (!job) {
    job = await queue.add("generate-answer", payload, {
      jobId,
      attempts: 2,
      backoff: {
        type: "exponential",
        delay: 300,
      },
      removeOnComplete: true,
      removeOnFail: 100,
    });
  }

  const result = await job.waitUntilFinished(
    queueEvents,
    env.AI_QUEUE_JOB_TIMEOUT_MS,
  );

  if (typeof result !== "string") {
    throw new Error("AI queue returned an invalid response payload");
  }

  return result;
};
