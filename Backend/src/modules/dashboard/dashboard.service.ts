import prisma from "../../lib/prisma";
import { cache } from "../../lib/redis";
import { AppError } from "../../lib/errors";
import { env } from "../../config/env";
import { RecordType, Role } from "@prisma/client";

export interface DashboardSummary {
  summary: { totalIncome: number; totalExpense: number; netBalance: number };
  recentActivity: any[];
  categoryBreakdown: any[];
  monthlyTrends: any[];
  fromCache?: boolean;
}

export class DashboardService {
  static async getSummary(user: { userId: string; role: Role }): Promise<DashboardSummary> {
    const isAdmin = user.role === Role.ADMIN;
    const CACHE_KEY = isAdmin ? "dashboard:summary:ADMIN" : `dashboard:summary:USER:${user.userId}`;

    const cached = await cache.get<DashboardSummary>(CACHE_KEY);
    if (cached) {
      return { ...cached, fromCache: true };
    }

    const where: any = { deletedAt: null };
    if (!isAdmin) {
      where.createdById = user.userId;
    }

    const [
      incomeAggr,
      expenseAggr,
      recentRecords,
      categoryGroup,
    ] = await Promise.all([
      prisma.financialRecord.aggregate({
        where: { ...where, type: RecordType.INCOME },
        _sum: { amount: true },
      }),
      prisma.financialRecord.aggregate({
        where: { ...where, type: RecordType.EXPENSE },
        _sum: { amount: true },
      }),
      prisma.financialRecord.findMany({
        where,
        orderBy: { date: "desc" },
        take: 10,
        include: { createdBy: { select: { name: true, email: true } } },
      }),
      prisma.financialRecord.groupBy({
        by: ["category", "type"],
        where,
        _sum: { amount: true },
        orderBy: { _sum: { amount: "desc" } },
      })
    ]);

    let monthlyRaw;
    const fromDate = new Date();
    fromDate.setMonth(fromDate.getMonth() - 6);

    if (isAdmin) {
      monthlyRaw = await prisma.$queryRaw<any[]>`
        SELECT TO_CHAR(date, 'YYYY-MM') AS month, type,
               SUM(amount)::float AS total
        FROM "FinancialRecord"
        WHERE "deletedAt" IS NULL
          AND date >= ${fromDate}
        GROUP BY month, type
        ORDER BY month ASC
      `;
    } else {
      monthlyRaw = await prisma.$queryRaw<any[]>`
        SELECT TO_CHAR(date, 'YYYY-MM') AS month, type,
               SUM(amount)::float AS total
        FROM "FinancialRecord"
        WHERE "deletedAt" IS NULL
          AND "createdById" = ${user.userId}
          AND date >= ${fromDate}
        GROUP BY month, type
        ORDER BY month ASC
      `;
    }

    const totalIncome = incomeAggr._sum.amount?.toNumber() || 0;
    const totalExpense = expenseAggr._sum.amount?.toNumber() || 0;

    const result: DashboardSummary = {
      summary: {
        totalIncome,
        totalExpense,
        netBalance: totalIncome - totalExpense,
      },
      recentActivity: recentRecords.map((r) => ({
        ...r,
        amount: r.amount.toNumber(),
      })),
      categoryBreakdown: categoryGroup.map((r) => ({
        category: r.category,
        type: r.type,
        total: r._sum.amount?.toNumber() || 0,
      })),
      monthlyTrends: monthlyRaw.map(row => ({
        month: row.month,
        type: row.type,
        total: row.total,
      })),
      fromCache: false,
    };

    await cache.set(CACHE_KEY, result, env.DASHBOARD_CACHE_TTL);

    return result;
  }
}
