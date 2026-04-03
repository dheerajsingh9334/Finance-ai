import { z } from "zod";
import { Role } from "@prisma/client";

export const updateRoleSchema = z.object({
  role: z.nativeEnum(Role),
});

export const updateStatusSchema = z.object({
  isActive: z.boolean(),
});

export const listUsersSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  role: z.nativeEnum(Role).optional(),
  isActive: z.coerce.boolean().optional(),
});

export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;
export type ListUsersInput = z.infer<typeof listUsersSchema>;
