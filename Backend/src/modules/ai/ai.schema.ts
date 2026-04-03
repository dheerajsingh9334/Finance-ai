import { z } from "zod";

export const querySchema = z.object({
  question: z.string().min(5).max(500),
});

export const insightSchema = z.object({
  months: z.coerce.number().min(1).max(12).default(3),
});

export type QueryInput = z.infer<typeof querySchema>;
export type InsightInput = z.infer<typeof insightSchema>;
