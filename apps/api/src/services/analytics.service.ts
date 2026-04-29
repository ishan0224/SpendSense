import mongoose from "mongoose";
import type {
  CategoryAnalyticsItem,
  DailyAnalyticsItem,
  ImpactTransaction,
  MerchantAnalyticsItem,
  MoneySummary
} from "@spendsense/shared";
import { BudgetModel } from "../models/budget.model";
import { TransactionModel } from "../models/transaction.model";
import { formatIsoDateOnly } from "../utils/date";
import { listInMemoryTransactionsForAnalytics } from "./transaction.service";

type AnalyticsList<T> = {
  month: string;
  items: T[];
};

function usingMongo(): boolean {
  return mongoose.connection.readyState === 1;
}

function daysInMonth(month: string): number {
  const [yearRaw, monthRaw] = month.split("-");
  const year = Number(yearRaw);
  const monthIndex = Number(monthRaw);
  return new Date(Date.UTC(year, monthIndex, 0)).getUTCDate();
}

function monthDays(month: string): string[] {
  const totalDays = daysInMonth(month);
  return Array.from({ length: totalDays }, (_unused, index) => {
    const day = String(index + 1).padStart(2, "0");
    return `${month}-${day}`;
  });
}

function elapsedDaysForAverage(month: string): number {
  const now = new Date();
  const currentMonth = now.toISOString().slice(0, 7);
  if (month === currentMonth) {
    return Math.min(now.getUTCDate(), daysInMonth(month));
  }
  return daysInMonth(month);
}

function percentage(part: number, total: number): number {
  if (total <= 0) {
    return 0;
  }
  return Number(((part / total) * 100).toFixed(2));
}

async function getMonthlyBudgetMinor(userId: string, month: string): Promise<number | null> {
  if (!usingMongo()) {
    return null;
  }
  const budget = await BudgetModel.findOne({
    userId: new mongoose.Types.ObjectId(userId),
    month
  }).lean();
  return budget?.monthlyBudgetMinor ?? null;
}

export async function getCategoryAnalytics(
  userId: string,
  month: string
): Promise<AnalyticsList<CategoryAnalyticsItem>> {
  if (usingMongo()) {
    const rows = await TransactionModel.aggregate<{
      _id: string;
      totalMinor: number;
      count: number;
    }>([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          month,
          direction: "debit",
          isIgnored: false
        }
      },
      {
        $group: {
          _id: "$categoryName",
          totalMinor: { $sum: "$amountMinor" },
          count: { $sum: 1 }
        }
      },
      { $sort: { totalMinor: -1 } }
    ]);

    const total = rows.reduce((sum, row) => sum + row.totalMinor, 0);
    return {
      month,
      items: rows.map((row) => ({
        categoryName: row._id,
        totalMinor: row.totalMinor,
        count: row.count,
        percentage: percentage(row.totalMinor, total)
      }))
    };
  }

  const groups = new Map<string, { totalMinor: number; count: number }>();
  for (const transaction of listInMemoryTransactionsForAnalytics(userId, month)) {
    if (transaction.direction !== "debit") {
      continue;
    }
    const current = groups.get(transaction.categoryName) ?? { totalMinor: 0, count: 0 };
    groups.set(transaction.categoryName, {
      totalMinor: current.totalMinor + transaction.amountMinor,
      count: current.count + 1
    });
  }

  const total = [...groups.values()].reduce((sum, row) => sum + row.totalMinor, 0);
  return {
    month,
    items: [...groups.entries()]
      .map(([categoryName, row]) => ({
        categoryName,
        totalMinor: row.totalMinor,
        count: row.count,
        percentage: percentage(row.totalMinor, total)
      }))
      .sort((a, b) => b.totalMinor - a.totalMinor)
  };
}

export async function getSummaryAnalytics(userId: string, month: string): Promise<MoneySummary> {
  const [categoryAnalytics, monthlyBudgetMinor] = await Promise.all([
    getCategoryAnalytics(userId, month),
    getMonthlyBudgetMinor(userId, month)
  ]);

  let totalSpentMinor = 0;
  let totalCreditedMinor = 0;

  if (usingMongo()) {
    const rows = await TransactionModel.aggregate<{
      _id: "debit" | "credit";
      totalMinor: number;
    }>([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          month,
          isIgnored: false
        }
      },
      {
        $group: {
          _id: "$direction",
          totalMinor: { $sum: "$amountMinor" }
        }
      }
    ]);
    for (const row of rows) {
      if (row._id === "debit") {
        totalSpentMinor = row.totalMinor;
      }
      if (row._id === "credit") {
        totalCreditedMinor = row.totalMinor;
      }
    }
  } else {
    for (const transaction of listInMemoryTransactionsForAnalytics(userId, month)) {
      if (transaction.direction === "debit") {
        totalSpentMinor += transaction.amountMinor;
      } else {
        totalCreditedMinor += transaction.amountMinor;
      }
    }
  }

  const elapsedDays = elapsedDaysForAverage(month);
  const topCategory = categoryAnalytics.items[0] ?? null;

  return {
    month,
    totalSpentMinor,
    totalCreditedMinor,
    netCashflowMinor: totalCreditedMinor - totalSpentMinor,
    dailyAverageMinor: Math.round(totalSpentMinor / elapsedDays),
    elapsedDays,
    monthlyBudgetMinor,
    budgetUsedPercentage:
      monthlyBudgetMinor && monthlyBudgetMinor > 0
        ? percentage(totalSpentMinor, monthlyBudgetMinor)
        : null,
    topCategory: topCategory
      ? {
          categoryName: topCategory.categoryName,
          totalMinor: topCategory.totalMinor
        }
      : null
  };
}

export async function getDailyAnalytics(
  userId: string,
  month: string
): Promise<AnalyticsList<DailyAnalyticsItem>> {
  const totals = new Map<string, { totalMinor: number; count: number }>();

  if (usingMongo()) {
    const rows = await TransactionModel.aggregate<{
      _id: string;
      totalMinor: number;
      count: number;
    }>([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          month,
          direction: "debit",
          isIgnored: false
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              date: "$transactionDate",
              format: "%Y-%m-%d",
              timezone: process.env.APP_TIMEZONE ?? "Asia/Kolkata"
            }
          },
          totalMinor: { $sum: "$amountMinor" },
          count: { $sum: 1 }
        }
      }
    ]);
    for (const row of rows) {
      totals.set(row._id, { totalMinor: row.totalMinor, count: row.count });
    }
  } else {
    for (const transaction of listInMemoryTransactionsForAnalytics(userId, month)) {
      if (transaction.direction !== "debit") {
        continue;
      }
      const date = formatIsoDateOnly(transaction.transactionDate);
      const current = totals.get(date) ?? { totalMinor: 0, count: 0 };
      totals.set(date, {
        totalMinor: current.totalMinor + transaction.amountMinor,
        count: current.count + 1
      });
    }
  }

  return {
    month,
    items: monthDays(month).map((date) => ({
      date,
      totalMinor: totals.get(date)?.totalMinor ?? 0,
      count: totals.get(date)?.count ?? 0
    }))
  };
}

export async function getMerchantAnalytics(
  userId: string,
  month: string
): Promise<AnalyticsList<MerchantAnalyticsItem>> {
  if (usingMongo()) {
    const rows = await TransactionModel.aggregate<{
      _id: string;
      merchantOriginal: string;
      totalMinor: number;
      count: number;
    }>([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          month,
          direction: "debit",
          isIgnored: false
        }
      },
      {
        $group: {
          _id: "$merchantNormalized",
          merchantOriginal: { $first: "$merchantOriginal" },
          totalMinor: { $sum: "$amountMinor" },
          count: { $sum: 1 }
        }
      },
      { $sort: { totalMinor: -1 } },
      { $limit: 10 }
    ]);

    return {
      month,
      items: rows.map((row) => ({
        merchantNormalized: row._id,
        merchantOriginal: row.merchantOriginal,
        totalMinor: row.totalMinor,
        count: row.count
      }))
    };
  }

  const groups = new Map<string, { merchantOriginal: string; totalMinor: number; count: number }>();
  for (const transaction of listInMemoryTransactionsForAnalytics(userId, month)) {
    if (transaction.direction !== "debit") {
      continue;
    }
    const current = groups.get(transaction.merchantNormalized) ?? {
      merchantOriginal: transaction.merchantOriginal,
      totalMinor: 0,
      count: 0
    };
    groups.set(transaction.merchantNormalized, {
      merchantOriginal: current.merchantOriginal,
      totalMinor: current.totalMinor + transaction.amountMinor,
      count: current.count + 1
    });
  }

  return {
    month,
    items: [...groups.entries()]
      .map(([merchantNormalized, row]) => ({
        merchantNormalized,
        merchantOriginal: row.merchantOriginal,
        totalMinor: row.totalMinor,
        count: row.count
      }))
      .sort((a, b) => b.totalMinor - a.totalMinor)
      .slice(0, 10)
  };
}

export async function getImpactAnalytics(
  userId: string,
  month: string
): Promise<AnalyticsList<ImpactTransaction>> {
  const summary = await getSummaryAnalytics(userId, month);

  if (usingMongo()) {
    const rows = await TransactionModel.find({
      userId: new mongoose.Types.ObjectId(userId),
      month,
      direction: "debit",
      isIgnored: false
    })
      .sort({ amountMinor: -1, transactionDate: -1 })
      .limit(5);

    return {
      month,
      items: rows.map((row) => ({
        id: row._id.toString(),
        merchantOriginal: row.merchantOriginal,
        categoryName: row.categoryName,
        amountMinor: row.amountMinor,
        transactionDate: formatIsoDateOnly(row.transactionDate),
        direction: row.direction,
        impactPercentage: percentage(row.amountMinor, summary.totalSpentMinor)
      }))
    };
  }

  return {
    month,
    items: listInMemoryTransactionsForAnalytics(userId, month)
      .filter((transaction) => transaction.direction === "debit")
      .sort((a, b) => b.amountMinor - a.amountMinor)
      .slice(0, 5)
      .map((transaction) => ({
        id: transaction._id.toString(),
        merchantOriginal: transaction.merchantOriginal,
        categoryName: transaction.categoryName,
        amountMinor: transaction.amountMinor,
        transactionDate: formatIsoDateOnly(transaction.transactionDate),
        direction: transaction.direction,
        impactPercentage: percentage(transaction.amountMinor, summary.totalSpentMinor)
      }))
  };
}
