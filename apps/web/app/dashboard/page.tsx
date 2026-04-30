"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  CategoryAnalyticsItem,
  DailyAnalyticsItem,
  ImpactTransaction,
  MerchantAnalyticsItem,
  MoneySummary,
  TransactionResponse
} from "@spendsense/shared";
import {
  fetchCategoryAnalytics,
  fetchDailyAnalytics,
  fetchImpactAnalytics,
  fetchMerchantAnalytics,
  fetchSummary,
  fetchTransactions
} from "../../lib/api";
import {
  CategoryPieChart,
  DailyLineChart,
  MerchantBarChart
} from "../../components/dashboard-charts";

function defaultMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function rupees(amountMinor: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(amountMinor / 100);
}

function StatCard({
  label,
  value,
  detail,
  accent
}: {
  label: string;
  value: string;
  detail: string;
  accent: string;
}) {
  return (
    <div className="rounded border border-slate-200 bg-white p-4 shadow-sm">
      <div className={`mb-3 h-1 w-10 rounded ${accent}`} />
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
      <p className="mt-1 text-sm text-slate-600">{detail}</p>
    </div>
  );
}

function ChartPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default function DashboardPage() {
  const [month, setMonth] = useState(defaultMonth);
  const [summary, setSummary] = useState<MoneySummary | null>(null);
  const [categories, setCategories] = useState<CategoryAnalyticsItem[]>([]);
  const [daily, setDaily] = useState<DailyAnalyticsItem[]>([]);
  const [merchants, setMerchants] = useState<MerchantAnalyticsItem[]>([]);
  const [impact, setImpact] = useState<ImpactTransaction[]>([]);
  const [recent, setRecent] = useState<TransactionResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const hasData = useMemo(
    () => (summary?.totalSpentMinor ?? 0) > 0 || (summary?.totalCreditedMinor ?? 0) > 0,
    [summary]
  );

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [summaryResult, categoryResult, dailyResult, merchantResult, impactResult, recentResult] =
        await Promise.all([
          fetchSummary(month),
          fetchCategoryAnalytics(month),
          fetchDailyAnalytics(month),
          fetchMerchantAnalytics(month),
          fetchImpactAnalytics(month),
          fetchTransactions({ month, page: 1, pageSize: 8 })
        ]);

      setSummary(summaryResult);
      setCategories(categoryResult.items);
      setDaily(dailyResult.items);
      setMerchants(merchantResult.items);
      setImpact(impactResult.items);
      setRecent(recentResult.items);
    } catch (dashboardError) {
      const message =
        dashboardError instanceof Error ? dashboardError.message : "Unable to load dashboard";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [month]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto w-full max-w-7xl px-5 py-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-950">Dashboard</h1>
            <p className="mt-1 text-sm text-slate-600">Monthly spend, cashflow, and category patterns.</p>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="month"
              className="rounded border border-slate-300 bg-white px-3 py-2 text-sm"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
            />
            <Link href="/import" className="rounded border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900">
              Import Statement
            </Link>
            <Link href="/rules" className="rounded border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900">
              Rules
            </Link>
            <Link href="/budgets" className="rounded border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900">
              Budgets
            </Link>
            <Link href="/settings" className="rounded border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900">
              Settings
            </Link>
            <Link href="/transactions/new" className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white">
              Add Transaction
            </Link>
          </div>
        </div>

        {error ? (
          <div className="mt-5 rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
        ) : null}

        {isLoading ? (
          <div className="mt-8 rounded border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
            Loading dashboard...
          </div>
        ) : null}

        {!isLoading && summary ? (
          <>
            <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <StatCard
                label="Total Spent"
                value={rupees(summary.totalSpentMinor)}
                detail={`${summary.elapsedDays} day average: ${rupees(summary.dailyAverageMinor)}`}
                accent="bg-teal-700"
              />
              <StatCard
                label="Budget Used"
                value={
                  summary.budgetUsedPercentage === null
                    ? "Not set"
                    : `${summary.budgetUsedPercentage.toFixed(1)}%`
                }
                detail={
                  summary.monthlyBudgetMinor === null
                    ? "Add a budget in Phase 06"
                    : `${rupees(summary.monthlyBudgetMinor)} monthly budget`
                }
                accent="bg-amber-600"
              />
              <StatCard
                label="Net Cashflow"
                value={rupees(summary.netCashflowMinor)}
                detail={`Credited ${rupees(summary.totalCreditedMinor)}`}
                accent="bg-blue-600"
              />
              <StatCard
                label="Top Category"
                value={summary.topCategory?.categoryName ?? "None"}
                detail={summary.topCategory ? rupees(summary.topCategory.totalMinor) : "No debits this month"}
                accent="bg-rose-700"
              />
            </section>

            {!hasData ? (
              <div className="mt-6 rounded border border-slate-200 bg-white p-8 text-center">
                <p className="text-sm font-medium text-slate-900">No analytics for this month yet</p>
                <p className="mt-1 text-sm text-slate-600">Create transactions or switch months to see charts.</p>
              </div>
            ) : null}

            <section className="mt-6 grid gap-4 xl:grid-cols-2">
              <ChartPanel title="Category Spend">
                <CategoryPieChart data={categories} />
              </ChartPanel>
              <ChartPanel title="Daily Spend">
                <DailyLineChart data={daily} />
              </ChartPanel>
              <ChartPanel title="Top Merchants">
                <MerchantBarChart data={merchants} />
              </ChartPanel>
              <ChartPanel title="Largest Impact">
                {impact.length === 0 ? (
                  <div className="flex h-64 items-center justify-center text-sm text-slate-500">
                    No impact transactions
                  </div>
                ) : (
                  <div className="space-y-3">
                    {impact.map((item) => (
                      <div key={item.id} className="rounded border border-slate-200 bg-slate-50 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-slate-900">{item.merchantOriginal}</p>
                            <p className="text-xs text-slate-500">
                              {item.categoryName} · {item.transactionDate}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-slate-950">{rupees(item.amountMinor)}</p>
                            <p className="text-xs text-slate-500">{item.impactPercentage.toFixed(1)}%</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ChartPanel>
            </section>

            <section className="mt-6 rounded border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold text-slate-900">Recent Transactions</h2>
                <Link href="/transactions" className="text-sm font-medium text-slate-900 underline">
                  View all
                </Link>
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="py-2 pr-4">Date</th>
                      <th className="py-2 pr-4">Merchant</th>
                      <th className="py-2 pr-4">Category</th>
                      <th className="py-2 pr-4">Direction</th>
                      <th className="py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-slate-500">
                          No recent transactions
                        </td>
                      </tr>
                    ) : null}
                    {recent.map((item) => (
                      <tr key={item.id} className="border-b border-slate-100">
                        <td className="py-3 pr-4 text-slate-600">{item.transactionDate}</td>
                        <td className="py-3 pr-4 font-medium text-slate-900">{item.merchantOriginal}</td>
                        <td className="py-3 pr-4 text-slate-600">{item.categoryName}</td>
                        <td className="py-3 pr-4 capitalize text-slate-600">{item.direction}</td>
                        <td className="py-3 text-right font-medium text-slate-950">{rupees(item.amountMinor)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}
