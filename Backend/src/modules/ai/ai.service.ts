import prisma from "../../lib/prisma";
import { DashboardService } from "../dashboard/dashboard.service";
import { generateAiResponse } from "../../utils/ai.utils";
import { Role } from "@prisma/client";
import { RecordsService } from "../records/records.service";
import { AiSearchInput, ListRecordsInput } from "../records/records.schema";
import { cache } from "../../lib/redis";
import { env } from "../../config/env";
import { runAiQueryJob } from "../../lib/aiQueue";

interface Requester {
  userId: string;
  role: Role;
}

interface QueryRecord {
  amount: number;
  category: string;
  type: string;
  date: Date;
}

interface AnomalyRecord {
  amount: number;
  category: string;
  type: string;
  date: Date;
  notes: string | null;
}

const monthLabel = (date: Date) =>
  date.toLocaleString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

const getMonthRange = (date: Date) => {
  const from = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  const to = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 23, 59, 59, 999),
  );
  return { from, to };
};

const getLastNMonthsRange = (date: Date, months: number) => {
  const from = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - (months - 1), 1),
  );
  const to = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 23, 59, 59, 999),
  );
  return { from, to };
};

const getLastNDaysRange = (date: Date, days: number) => {
  const to = new Date(date);
  to.setUTCHours(23, 59, 59, 999);
  const from = new Date(date);
  from.setUTCDate(from.getUTCDate() - (days - 1));
  from.setUTCHours(0, 0, 0, 0);
  return { from, to };
};

const inRange = (date: Date, from: Date, to: Date) =>
  date.getTime() >= from.getTime() && date.getTime() <= to.getTime();

const extractCategory = (
  question: string,
  records: QueryRecord[],
): string | null => {
  const normalized = question.toLowerCase();
  const knownCategories = Array.from(
    new Set(records.map((r) => r.category.trim()).filter(Boolean)),
  );

  const matched = knownCategories.find((cat) =>
    normalized.includes(cat.toLowerCase()),
  );
  if (matched) return matched;

  const regexMatch = normalized.match(
    /(?:on|for|of)\s+([a-z][a-z\s&-]{1,30})/i,
  );
  if (!regexMatch?.[1]) return null;
  return regexMatch[1].trim();
};

const tryDirectAnswer = (
  question: string,
  records: QueryRecord[],
): string | null => {
  const normalized = question.toLowerCase();
  const expenseRecords = records.filter((r) => r.type === "EXPENSE");
  const now = new Date();

  const asksTrendComparison =
    /compare.*trend|trend.*compare|top changes?|changes?.*categories?|category.*changes?/.test(
      normalized,
    );
  if (asksTrendComparison) {
    const daysMatch = normalized.match(/last\s+(\d+)\s+days?/);
    const days = Math.min(Math.max(Number(daysMatch?.[1] ?? 7), 1), 30);

    const current = getLastNDaysRange(now, days);
    const previousEnd = new Date(current.from);
    previousEnd.setUTCDate(previousEnd.getUTCDate() - 1);
    previousEnd.setUTCHours(23, 59, 59, 999);
    const previousStart = new Date(previousEnd);
    previousStart.setUTCDate(previousStart.getUTCDate() - (days - 1));
    previousStart.setUTCHours(0, 0, 0, 0);

    const currentByCategory = new Map<string, number>();
    const previousByCategory = new Map<string, number>();

    for (const record of expenseRecords) {
      if (inRange(record.date, current.from, current.to)) {
        currentByCategory.set(
          record.category,
          (currentByCategory.get(record.category) ?? 0) + record.amount,
        );
      } else if (inRange(record.date, previousStart, previousEnd)) {
        previousByCategory.set(
          record.category,
          (previousByCategory.get(record.category) ?? 0) + record.amount,
        );
      }
    }

    const categories = new Set([
      ...currentByCategory.keys(),
      ...previousByCategory.keys(),
    ]);

    if (categories.size === 0) {
      return `No expense records were found for the last ${days} days or the previous ${days}-day window, so trend changes cannot be computed.`;
    }

    const changes = Array.from(categories)
      .map((category) => {
        const currentTotal = currentByCategory.get(category) ?? 0;
        const previousTotal = previousByCategory.get(category) ?? 0;
        const delta = currentTotal - previousTotal;
        return { category, currentTotal, previousTotal, delta };
      })
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      .slice(0, 3);

    const lines = changes.map((item, index) => {
      const direction =
        item.delta > 0
          ? `increased by ${item.delta}`
          : item.delta < 0
            ? `decreased by ${Math.abs(item.delta)}`
            : "stayed unchanged";
      return `${index + 1}. ${item.category}: ${direction} (current ${days} days: ${item.currentTotal}, previous ${days} days: ${item.previousTotal}).`;
    });

    return `Top spending changes over the last ${days} days compared with the previous ${days}-day window:\n${lines.join("\n")}`;
  }

  const asksHighestExpense =
    /highest\s+expense|most\s+expensive|biggest\s+expense/.test(normalized);
  if (asksHighestExpense) {
    const { from, to } = normalized.includes("last month")
      ? getMonthRange(
          new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)),
        )
      : getMonthRange(now);

    const filtered = expenseRecords.filter((r) => inRange(r.date, from, to));
    if (filtered.length === 0) {
      return `No expense records found for ${monthLabel(from)}.`;
    }

    const categoryTotals = new Map<string, number>();
    for (const record of filtered) {
      categoryTotals.set(
        record.category,
        (categoryTotals.get(record.category) ?? 0) + record.amount,
      );
    }

    const [topCategory, total] = Array.from(categoryTotals.entries()).sort(
      (a, b) => b[1] - a[1],
    )[0];
    return `Your highest expense category for ${monthLabel(from)} is ${topCategory} with a total of ${total}.`;
  }

  const asksCategoryCost =
    /how much|what is.*cost|what.*spend|spent.*on|cost of/.test(normalized);
  if (!asksCategoryCost) return null;

  const category = extractCategory(question, expenseRecords);
  if (!category) return null;

  let range = getMonthRange(now);
  let rangeText = monthLabel(now);

  const lastMonthsMatch = normalized.match(/last\s+(\d+)\s+months?/);
  if (lastMonthsMatch?.[1]) {
    const months = Number(lastMonthsMatch[1]);
    range = getLastNMonthsRange(now, months);
    rangeText = `the last ${months} months`;
  } else if (normalized.includes("last month")) {
    range = getMonthRange(
      new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)),
    );
    rangeText = monthLabel(range.from);
  }

  const filtered = expenseRecords.filter(
    (r) =>
      inRange(r.date, range.from, range.to) &&
      r.category.toLowerCase().includes(category.toLowerCase()),
  );

  if (filtered.length === 0) {
    return `No ${category} expense records were found for ${rangeText}.`;
  }

  const total = filtered.reduce((sum, r) => sum + r.amount, 0);
  return `You spent ${total} on ${category} in ${rangeText}.`;
};

const ensureCoherentQueryAnswer = (
  answer: string,
  recordCount: number,
): string => {
  const normalized = answer.trim();
  if (!normalized) {
    return `I could not generate a complete answer from the available data. There are ${recordCount} recent records right now. Add more records and try the same question again.`;
  }

  const danglingEnding = /\b(your|the|a|an|to|of|for|with|and|or|but)\.$/i.test(
    normalized,
  );
  const tooShort = normalized.length < 35;

  if (danglingEnding || tooShort) {
    return `The available data is limited (${recordCount} recent records), so I could not produce a reliable detailed answer for that question. Try adding more records for the requested period and ask again.`;
  }

  return normalized;
};

const buildRuleBasedAnomalySummary = (records: AnomalyRecord[]): string => {
  const expenses = records.filter((r) => r.type === "EXPENSE");
  if (expenses.length === 0) {
    return "No clear anomalies detected from the provided records.";
  }

  const sortedAmounts = expenses.map((r) => r.amount).sort((a, b) => a - b);
  const mid = Math.floor(sortedAmounts.length / 2);
  const median =
    sortedAmounts.length % 2 === 0
      ? (sortedAmounts[mid - 1] + sortedAmounts[mid]) / 2
      : sortedAmounts[mid];

  const spikeThreshold = Math.max(median * 3, 2000);
  const spikes = expenses
    .filter((r) => r.amount >= spikeThreshold)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 2);

  const sameDayByAmount = new Map<string, AnomalyRecord[]>();
  for (const entry of expenses) {
    const day = entry.date.toISOString().slice(0, 10);
    const key = `${day}:${entry.amount}`;
    const bucket = sameDayByAmount.get(key) ?? [];
    bucket.push(entry);
    sameDayByAmount.set(key, bucket);
  }

  const duplicatePattern = Array.from(sameDayByAmount.values()).find(
    (items) =>
      items.length >= 2 && new Set(items.map((i) => i.category)).size >= 2,
  );

  const lines: string[] = [];

  if (spikes.length > 0) {
    const top = spikes[0];
    lines.push(
      `1. High-value spike detected: ${top.amount} in ${top.category} on ${top.date.toISOString().slice(0, 10)}, which is significantly above the typical expense median (${median.toFixed(2)}).`,
    );
  }

  if (duplicatePattern) {
    const sample = duplicatePattern[0];
    lines.push(
      `2. Same-day duplicate amount pattern detected: ${duplicatePattern.length} expense entries of ${sample.amount} on ${sample.date.toISOString().slice(0, 10)} across multiple categories.`,
    );
  }

  if (spikes.length > 1) {
    const second = spikes[1];
    lines.push(
      `3. Additional unusual expense observed: ${second.amount} in ${second.category} on ${second.date.toISOString().slice(0, 10)}; review supporting notes/receipts for confirmation.`,
    );
  }

  if (lines.length === 0) {
    return "No clear anomalies detected from the provided records.";
  }

  return lines.join("\n");
};

const ensureCoherentAnomalyAnswer = (
  answer: string,
  records: AnomalyRecord[],
): string => {
  const normalized = answer.trim();
  if (!normalized) {
    return buildRuleBasedAnomalySummary(records);
  }

  const danglingEnding =
    /\b(your|the|a|an|to|of|for|with|and|or|but)\.$/i.test(normalized) ||
    /:\.$/.test(normalized);
  const unfinishedListTail = /(?:^|\n)\s*\d+\.$/.test(normalized);
  const tooShort = normalized.length < 40;

  if (danglingEnding || unfinishedListTail || tooShort) {
    return buildRuleBasedAnomalySummary(records);
  }

  return normalized;
};

const isUsableAnomalyText = (text: string): boolean => {
  const normalized = text.trim();
  if (normalized.length < 40) return false;
  if (/\b(your|the|a|an|to|of|for|with|and|or|but)\.$/i.test(normalized)) {
    return false;
  }
  if (/:\.$/.test(normalized)) return false;
  if (/(?:^|\n)\s*\d+\.$/.test(normalized)) return false;
  return true;
};

export class AiService {
  static async getSpendingInsights(user: Requester, months: number) {
    const cacheKey = `ai:insights:${user.role}:${user.userId}:${months}`;
    const cachedInsights = await cache.get<string>(cacheKey);
    if (cachedInsights) {
      return {
        insights: cachedInsights,
        dataUsed: { months, recordCount: -1 },
      };
    }

    const fromDate = new Date();
    fromDate.setMonth(fromDate.getMonth() - months);

    const isAdmin = user.role === Role.ADMIN;
    const where: any = { deletedAt: null, date: { gte: fromDate } };
    if (!isAdmin) where.createdById = user.userId;

    const [groupedRecords, totals] = await Promise.all([
      prisma.financialRecord.groupBy({
        by: ["category", "type"],
        where,
        _sum: { amount: true },
      }),

      isAdmin
        ? prisma.$queryRaw<any[]>`
        SELECT TO_CHAR(date, 'YYYY-MM') AS month, type, SUM(amount)::float AS total
        FROM "FinancialRecord"
        WHERE "deletedAt" IS NULL AND date >= ${fromDate}
        GROUP BY month, type ORDER BY month ASC
      `
        : prisma.$queryRaw<any[]>`
        SELECT TO_CHAR(date, 'YYYY-MM') AS month, type, SUM(amount)::float AS total
        FROM "FinancialRecord"
        WHERE "createdById" = ${user.userId} AND "deletedAt" IS NULL AND date >= ${fromDate}
        GROUP BY month, type ORDER BY month ASC
      `,
    ]);

    const contextData = {
      groupedRecords: groupedRecords.map((g) => ({
        category: g.category,
        type: g.type,
        total: g._sum.amount?.toNumber(),
      })),
      monthlyTotals: totals,
    };

    const answer = await generateAiResponse(
      "You are a financial analyst assistant. Return exactly 3 numbered, actionable insights based only on the provided data. Keep the full response under 140 words. Each point must be one complete sentence and must end with punctuation. Focus on spending patterns, anomalies, and data-quality gaps.",
      JSON.stringify(contextData),
      320,
    );

    await cache.set(cacheKey, answer, env.AI_INSIGHTS_CACHE_TTL);

    return {
      insights: answer,
      dataUsed: { months, recordCount: groupedRecords.length },
    };
  }

  static async detectAnomalies(user: Requester) {
    const cacheKey = `ai:anomalies:${user.role}:${user.userId}`;
    const cachedAnomalies = await cache.get<string>(cacheKey);
    if (cachedAnomalies && isUsableAnomalyText(cachedAnomalies)) {
      return {
        anomalies: cachedAnomalies,
        checkedRecords: -1,
      };
    }

    const fromDate = new Date();
    fromDate.setMonth(fromDate.getMonth() - 6);

    const isAdmin = user.role === Role.ADMIN;
    const where: any = { deletedAt: null, date: { gte: fromDate } };
    if (!isAdmin) where.createdById = user.userId;

    const records = await prisma.financialRecord.findMany({
      where,
      select: {
        amount: true,
        category: true,
        type: true,
        date: true,
        notes: true,
      },
      orderBy: { date: "desc" },
    });

    const parsedRecords: AnomalyRecord[] = records.map((r) => ({
      ...r,
      amount: r.amount.toNumber(),
    }));

    const answer = await generateAiResponse(
      "You are a financial fraud and anomaly detection assistant. Return up to 3 numbered anomalies based only on the provided records. Keep the full response under 160 words. Each anomaly must be one complete sentence with a short reason. If no anomaly exists, return exactly: 'No clear anomalies detected from the provided records.'",
      JSON.stringify(parsedRecords),
      360,
    );

    const safeAnomalyAnswer = ensureCoherentAnomalyAnswer(
      answer,
      parsedRecords,
    );

    await cache.set(cacheKey, safeAnomalyAnswer, env.AI_ANOMALIES_CACHE_TTL);

    return {
      anomalies: safeAnomalyAnswer,
      checkedRecords: records.length,
    };
  }

  static async naturalLanguageQuery(question: string, user: Requester) {
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - 90);

    const isAdmin = user.role === Role.ADMIN;
    const where: any = { deletedAt: null, date: { gte: fromDate } };
    if (!isAdmin) where.createdById = user.userId;

    const records = await prisma.financialRecord.findMany({
      where,
      orderBy: { date: "desc" },
    });

    const recentRecords: QueryRecord[] = records.map((r) => ({
      amount: r.amount.toNumber(),
      category: r.category,
      type: r.type,
      date: r.date,
    }));

    const directAnswer = tryDirectAnswer(question, recentRecords);
    if (directAnswer) {
      await cache.set(
        `ai:query:${user.userId}:${question.trim().toLowerCase()}`,
        directAnswer,
        env.AI_QUERY_CACHE_TTL,
      );
      return { answer: directAnswer };
    }

    const cacheKey = `ai:query:${user.userId}:${question.trim().toLowerCase()}`;
    const cachedAnswer = await cache.get<string>(cacheKey);
    if (cachedAnswer) {
      return { answer: cachedAnswer };
    }

    const summary = await DashboardService.getSummary(user);

    const contextData = {
      recentRecords,
      dashboardSummary: summary,
    };

    const promptContext = `Context Data: ${JSON.stringify(contextData)}\nQuestion: ${question}`;

    let answer: string;

    try {
      answer = await runAiQueryJob(user.userId, question, {
        systemPrompt:
          "You are a financial data assistant. Answer the user's finance question using ONLY the provided data. Keep the response to 12-40 complete sentences. If data is insufficient, explicitly state what is missing and suggest one short next step (for example: add records for prior months). Never fabricate values.",
        promptContext,
        maxTokens: 320,
      });
    } catch (error) {
      answer = await generateAiResponse(
        "You are a financial data assistant. Answer the user's finance question using ONLY the provided data. Keep the response to 12-40 complete sentences. If data is insufficient, explicitly state what is missing and suggest one short next step (for example: add records for prior months). Never fabricate values.",
        promptContext,
        320,
      );
    }

    const safeAnswer = ensureCoherentQueryAnswer(answer, recentRecords.length);

    await cache.set(cacheKey, safeAnswer, env.AI_QUERY_CACHE_TTL);

    return {
      answer: safeAnswer,
    };
  }

  static async normalRecordSearch(filters: ListRecordsInput, user: Requester) {
    return RecordsService.listRecords(filters, user);
  }

  static async aiRecordSearch(filters: AiSearchInput, user: Requester) {
    return RecordsService.aiSearchRecords(
      filters.query,
      user,
      filters.page,
      filters.limit,
    );
  }
}
