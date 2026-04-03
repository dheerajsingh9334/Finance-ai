import {
  getGeminiModel,
  getGeminiModelCandidates,
  listGenerateContentModels,
} from "../lib/gemini";

const finalizeAiText = (text: string): string => {
  let normalized = text.trim();
  if (!normalized) return normalized;

  // Normalize malformed punctuation that can appear in truncated outputs.
  normalized = normalized
    .replace(/,\s*\./g, ".")
    .replace(/\s+([.,!?])/g, "$1")
    .replace(/,+$/g, "")
    .trim();

  // Remove common truncated markdown/list tails such as "**1." or "1."
  // that often appear when model output is cut mid-generation.
  normalized = normalized.replace(/(\n\s*(?:\*\*)?\d+\.?\*?\*?\s*)$/, "");
  normalized = normalized.trim();
  if (!normalized) return normalized;

  const endsCleanly = /[.!?)]$/.test(normalized);
  if (endsCleanly) return normalized;

  const punctuationPositions = [
    normalized.lastIndexOf("."),
    normalized.lastIndexOf("!"),
    normalized.lastIndexOf("?"),
  ];

  const lastSentenceEnd = Math.max(...punctuationPositions);
  if (lastSentenceEnd > normalized.length * 0.5) {
    return normalized.slice(0, lastSentenceEnd + 1).trim();
  }

  return `${normalized}.`;
};

export const generateAiResponse = async (
  systemPrompt: string,
  userContent: string,
  maxTokens: number = 1024,
): Promise<string> => {
  const configuredCandidates = getGeminiModelCandidates();
  let discoveredModels: string[] = [];

  try {
    discoveredModels = await listGenerateContentModels();
  } catch (error) {
    // Continue with configured candidates if model discovery fails.
    discoveredModels = [];
  }

  const preferredDiscovered = configuredCandidates.filter((candidate) =>
    discoveredModels.includes(candidate),
  );
  const modelCandidates = [
    ...preferredDiscovered,
    ...discoveredModels,
    ...configuredCandidates,
  ].filter((model, index, all) => all.indexOf(model) === index);

  let lastError: unknown;

  for (const modelName of modelCandidates) {
    try {
      const response = await getGeminiModel(modelName).generateContent({
        contents: [
          {
            role: "user",
            parts: [{ text: `${systemPrompt}\n\n${userContent}` }],
          },
        ],
        generationConfig: {
          maxOutputTokens: maxTokens,
        },
      });

      return finalizeAiText(response.response.text());
    } catch (error) {
      lastError = error;
    }
  }

  const reason =
    lastError instanceof Error ? lastError.message : "Unknown Gemini error";
  throw new Error(
    `No Gemini model could generate content. Tried: ${modelCandidates.join(", ")}. Last error: ${reason}`,
  );
};
