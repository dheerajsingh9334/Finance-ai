import { z } from "zod";
import { RecordType } from "@prisma/client";

export const createRecordSchema = z.object({
  amount: z.number().positive(),
  type: z.nativeEnum(RecordType),
  category: z.string().min(1).max(100),
  date: z
    .string()
    .datetime()
    .default(() => new Date().toISOString()),
  notes: z.string().max(500).optional(),
});

export const updateRecordSchema = createRecordSchema.partial();

export const listRecordsSchema = z.object({
  type: z.nativeEnum(RecordType).optional(),
  category: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().default(1),
  limit: z.coerce.number().max(100).default(20),
  sortBy: z.enum(["date", "amount", "createdAt"]).default("date"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const aiSearchSchema = z.object({
  query: z.string().min(1).max(500),
  page: z.coerce.number().default(1),
  limit: z.coerce.number().max(100).default(20),
});

export type CreateRecordInput = z.infer<typeof createRecordSchema>;
export type UpdateRecordInput = z.infer<typeof updateRecordSchema>;
export type ListRecordsInput = z.infer<typeof listRecordsSchema>;
export type AiSearchInput = z.infer<typeof aiSearchSchema>;
