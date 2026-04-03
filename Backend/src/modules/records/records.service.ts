import prisma from "../../lib/prisma";
import { cache } from "../../lib/redis";
import { AppError } from "../../lib/errors";
import {
  CreateRecordInput,
  UpdateRecordInput,
  ListRecordsInput,
} from "./records.schema";
import { Prisma, Role } from "@prisma/client";

interface Requester {
  userId: string;
  role: Role;
}

export interface ParsedAiFilters {
  type?: "INCOME" | "EXPENSE";
  category?: string;
  from?: string;
  to?: string;
  keywords?: string;
  amountRange?: {
    min?: number | null;
    max?: number | null;
  };
}

export class RecordsService {
  static async listRecords(filters: ListRecordsInput, user: Requester) {
    const { type, category, from, to, page, limit, sortBy, sortOrder } =
      filters;
    const skip = (page - 1) * limit;

    const where: Prisma.FinancialRecordWhereInput = { deletedAt: null };

    if (user.role !== Role.ADMIN) {
      where.createdById = user.userId;
    }

    if (type) where.type = type;
    if (category) where.category = { contains: category, mode: "insensitive" };
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(from);
      if (to) where.date.lte = new Date(to);
    }

    const orderBy = { [sortBy]: sortOrder };

    const [total, rawRecords] = await Promise.all([
      prisma.financialRecord.count({ where }),
      prisma.financialRecord.findMany({
        where,
        skip,
        take: limit,
        orderBy,
      }),
    ]);

    const records = rawRecords.map((r) => ({
      ...r,
      amount: r.amount.toNumber(),
    }));

    const totalPages = Math.ceil(total / limit);

    return {
      data: records,
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    };
  }

  static async createRecord(data: CreateRecordInput, userId: string) {
    const record = await prisma.financialRecord.create({
      data: {
        ...data,
        amount: new Prisma.Decimal(data.amount),
        createdById: userId,
      },
    });

    await cache.delPattern("dashboard:summary:*");
    await cache.delPattern("ai:*");
    return { ...record, amount: record.amount.toNumber() };
  }

  static async updateRecord(
    id: string,
    data: UpdateRecordInput,
    user: Requester,
  ) {
    const existing = await prisma.financialRecord.findFirst({
      where: { id, deletedAt: null },
    });

    if (!existing) {
      throw new AppError("Record not found", 404);
    }

    if (user.role !== Role.ADMIN && existing.createdById !== user.userId) {
      throw new AppError("Forbidden: Cannot modify someone else's record", 403);
    }

    const payload: Prisma.FinancialRecordUpdateInput = { ...data };
    if (data.amount !== undefined) {
      payload.amount = new Prisma.Decimal(data.amount);
    }

    const record = await prisma.financialRecord.update({
      where: { id },
      data: payload,
    });

    await cache.delPattern("dashboard:summary:*");
    await cache.delPattern("ai:*");
    return { ...record, amount: record.amount.toNumber() };
  }

  static async softDeleteRecord(id: string, user: Requester) {
    const existing = await prisma.financialRecord.findFirst({
      where: { id, deletedAt: null },
    });

    if (!existing) {
      throw new AppError("Record not found", 404);
    }

    if (user.role !== Role.ADMIN && existing.createdById !== user.userId) {
      throw new AppError("Forbidden: Cannot delete someone else's record", 403);
    }

    await prisma.financialRecord.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await cache.delPattern("dashboard:summary:*");
    await cache.delPattern("ai:*");
    return { id, success: true };
  }

  static async restoreRecord(id: string, user: Requester) {
    if (user.role !== Role.ADMIN) {
      throw new AppError("Forbidden: Only admins can restore records", 403);
    }

    const existing = await prisma.financialRecord.findFirst({
      where: { id, deletedAt: { not: null } },
    });

    if (!existing) {
      throw new AppError("Deleted record not found", 404);
    }

    const record = await prisma.financialRecord.update({
      where: { id },
      data: { deletedAt: null },
    });

    await cache.delPattern("dashboard:summary:*");
    await cache.delPattern("ai:*");
    return { ...record, amount: record.amount.toNumber() };
  }

  static async getRecordById(id: string, user: Requester) {
    const record = await prisma.financialRecord.findFirst({
      where: { id, deletedAt: null },
    });

    if (!record) {
      throw new AppError("Record not found", 404);
    }

    if (user.role !== Role.ADMIN && record.createdById !== user.userId) {
      throw new AppError("Forbidden: Cannot view someone else's record", 403);
    }

    return { ...record, amount: record.amount.toNumber() };
  }

  static async listDeletedRecords(filters: ListRecordsInput, user: Requester) {
    if (user.role !== Role.ADMIN) {
      throw new AppError(
        "Forbidden: Only admins can view deleted records",
        403,
      );
    }

    const { type, category, from, to, page, limit, sortBy, sortOrder } =
      filters;
    const skip = (page - 1) * limit;

    const where: Prisma.FinancialRecordWhereInput = {
      deletedAt: { not: null },
    };

    if (type) where.type = type;
    if (category) where.category = { contains: category, mode: "insensitive" };
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(from);
      if (to) where.date.lte = new Date(to);
    }

    const orderBy = { [sortBy]: sortOrder };

    const [total, rawRecords] = await Promise.all([
      prisma.financialRecord.count({ where }),
      prisma.financialRecord.findMany({
        where,
        skip,
        take: limit,
        orderBy,
      }),
    ]);

    const records = rawRecords.map((r) => ({
      ...r,
      amount: r.amount.toNumber(),
    }));

    const totalPages = Math.ceil(total / limit);

    return {
      data: records,
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    };
  }

  static async aiSearchRecords(
    query: string,
    user: Requester,
    page: number = 1,
    limit: number = 20,
  ) {
    const { generateAiResponse } = await import("../../utils/ai.utils");

    const cleanJsonText = (text: string) => {
      const trimmed = text
        .trim()
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "");
      const start = trimmed.indexOf("{");
      const end = trimmed.lastIndexOf("}");
      return start >= 0 && end > start
        ? trimmed.slice(start, end + 1)
        : trimmed;
    };

    const startOfDay = (date: Date) => {
      const result = new Date(date);
      result.setUTCHours(0, 0, 0, 0);
      return result.toISOString();
    };

    const endOfDay = (date: Date) => {
      const result = new Date(date);
      result.setUTCHours(23, 59, 59, 999);
      return result.toISOString();
    };

    const buildFallbackFilters = (rawQuery: string) => {
      const normalized = rawQuery.toLowerCase();
      const filters: ParsedAiFilters = {};

      if (/\b(income|revenue|salary|earnings|credited)\b/.test(normalized)) {
        filters.type = "INCOME";
      } else if (
        /\b(expense|expenses|spending|spent|purchase|purchased|debit|cost)\b/.test(
          normalized,
        )
      ) {
        filters.type = "EXPENSE";
      }

      const categoryMatch =
        normalized.match(/\b(?:in|for|category|on)\s+([a-z0-9 &-]{2,50})/) ??
        normalized.match(
          /\b(food|travel|transport|rent|shopping|health|salary|bills|entertainment|education)\b/,
        );
      if (categoryMatch?.[1]) {
        filters.category = categoryMatch[1].trim();
      }

      const amountMatch = normalized.match(
        /(?:over|above|more than|greater than|at least|min(?:imum)?)\s*\$?([0-9]+(?:\.[0-9]+)?)/,
      );
      if (amountMatch?.[1]) {
        filters.amountRange = {
          ...(filters.amountRange ?? {}),
          min: Number(amountMatch[1]),
        };
      }

      const maxAmountMatch = normalized.match(
        /(?:under|below|less than|at most|max(?:imum)?)\s*\$?([0-9]+(?:\.[0-9]+)?)/,
      );
      if (maxAmountMatch?.[1]) {
        filters.amountRange = {
          ...(filters.amountRange ?? {}),
          max: Number(maxAmountMatch[1]),
        };
      }

      const now = new Date();
      if (/\blast month\b/.test(normalized)) {
        const from = new Date(
          Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1),
        );
        const to = new Date(
          Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0),
        );
        filters.from = startOfDay(from);
        filters.to = endOfDay(to);
      } else if (/\bthis month\b/.test(normalized)) {
        const from = new Date(
          Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
        );
        const to = new Date(
          Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0),
        );
        filters.from = startOfDay(from);
        filters.to = endOfDay(to);
      } else if (/\blast week\b/.test(normalized)) {
        const day = now.getUTCDay() || 7;
        const end = new Date(now);
        end.setUTCDate(now.getUTCDate() - day);
        const from = new Date(end);
        from.setUTCDate(end.getUTCDate() - 6);
        filters.from = startOfDay(from);
        filters.to = endOfDay(end);
      } else if (/\bthis year\b/.test(normalized)) {
        const from = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
        const to = new Date(Date.UTC(now.getUTCFullYear(), 11, 31));
        filters.from = startOfDay(from);
        filters.to = endOfDay(to);
      }

      filters.keywords = rawQuery;
      return filters;
    };

    const systemPrompt = `You are a financial records filter analyzer. Parse the user's natural language query and return a JSON object with filter criteria.
Return ONLY valid JSON, with no markdown and no explanation.
Use this structure:
{
  "type": "INCOME" | "EXPENSE" | null,
  "category": "category name or keywords" | null,
  "fromDate": "YYYY-MM-DD" | null,
  "toDate": "YYYY-MM-DD" | null,
  "minAmount": number | null,
  "maxAmount": number | null,
  "keywords": "search terms" | null
}
Prefer these rules:
- infer type from income/expense wording
- extract category if mentioned
- infer dates from phrases like last month, this month, this year, last week
- infer minAmount/maxAmount from phrases like over, under, above, below
- if unsure, set values to null`;

    let filters: ParsedAiFilters = buildFallbackFilters(query);

    try {
      const aiResponse = await generateAiResponse(systemPrompt, query, 512);
      const parsed = JSON.parse(cleanJsonText(aiResponse));

      if (parsed.type) filters.type = parsed.type;
      if (parsed.category) filters.category = parsed.category;
      if (parsed.minAmount !== null || parsed.maxAmount !== null) {
        filters.amountRange = {
          ...(filters.amountRange ?? {}),
          min:
            parsed.minAmount !== null && parsed.minAmount !== undefined
              ? parsed.minAmount
              : (filters.amountRange?.min ?? null),
          max:
            parsed.maxAmount !== null && parsed.maxAmount !== undefined
              ? parsed.maxAmount
              : (filters.amountRange?.max ?? null),
        };
      }
      if (parsed.fromDate) {
        filters.from = new Date(
          `${parsed.fromDate}T00:00:00.000Z`,
        ).toISOString();
      }
      if (parsed.toDate) {
        filters.to = new Date(`${parsed.toDate}T23:59:59.999Z`).toISOString();
      }
      if (parsed.keywords) {
        filters.keywords = parsed.keywords;
      }
    } catch {
      // Keep the fallback filters when Gemini returns loose or invalid JSON.
    }

    const skip = (page - 1) * limit;
    const where: Prisma.FinancialRecordWhereInput = { deletedAt: null };

    if (user.role !== Role.ADMIN) {
      where.createdById = user.userId;
    }

    if (filters.type) where.type = filters.type;
    if (filters.category)
      where.category = { contains: filters.category, mode: "insensitive" };
    const minAmount = filters.amountRange?.min;
    const maxAmount = filters.amountRange?.max;

    if (minAmount != null || maxAmount != null) {
      where.amount = {};
      if (minAmount != null) where.amount.gte = new Prisma.Decimal(minAmount);
      if (maxAmount != null) where.amount.lte = new Prisma.Decimal(maxAmount);
    }
    if (filters.from || filters.to) {
      where.date = {};
      if (filters.from) where.date.gte = new Date(filters.from);
      if (filters.to) where.date.lte = new Date(filters.to);
    }

    const [total, rawRecords] = await Promise.all([
      prisma.financialRecord.count({ where }),
      prisma.financialRecord.findMany({
        where,
        skip,
        take: limit,
        orderBy: { date: "desc" },
      }),
    ]);

    const records = rawRecords.map((r) => ({
      ...r,
      amount: r.amount.toNumber(),
    }));

    const totalPages = Math.ceil(total / limit);

    return {
      data: records,
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
      query,
      parsedFilters: filters,
    };
  }
}
