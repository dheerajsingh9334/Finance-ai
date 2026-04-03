import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "../config/env";

const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);

const defaultModelCandidates = [
  "gemini-2.0-flash",
  "gemini-1.5-flash-latest",
  "gemini-1.5-flash",
];

export const getGeminiModelCandidates = (): string[] => {
  const configuredModels = env.GEMINI_MODEL
    ? env.GEMINI_MODEL.split(",")
        .map((name) => name.trim())
        .filter(Boolean)
    : [];

  return [...configuredModels, ...defaultModelCandidates].filter(
    (model, index, all) => all.indexOf(model) === index,
  );
};

export const getGeminiModel = (model: string) =>
  genAI.getGenerativeModel({ model });

let cachedGenerateContentModels: string[] | null = null;

export const listGenerateContentModels = async (): Promise<string[]> => {
  if (cachedGenerateContentModels) return cachedGenerateContentModels;

  const url = new URL(
    "https://generativelanguage.googleapis.com/v1beta/models",
  );
  url.searchParams.set("key", env.GEMINI_API_KEY);

  type ModelInfo = {
    name?: string;
    supportedGenerationMethods?: string[];
  };

  type ModelsResponse = {
    models?: ModelInfo[];
  };

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Failed to list Gemini models (${response.status})`);
  }

  const payload = (await response.json()) as ModelsResponse;
  const models =
    payload.models
      ?.filter((model) =>
        model.supportedGenerationMethods?.includes("generateContent"),
      )
      .map((model) => model.name?.replace(/^models\//, ""))
      .filter((name): name is string => Boolean(name)) ?? [];

  cachedGenerateContentModels = models;
  return models;
};
