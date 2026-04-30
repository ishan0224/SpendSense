"use client";

import { useEffect, useState } from "react";
import type { BudgetResponse } from "@spendsense/shared";
import { fetchBudgets, upsertBudget } from "../../lib/api";

type CategoryBudgetDraft = { categoryName: string; budgetMajor: string };

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

export default function BudgetsPage() {
  const [month, setMonth] = useState(currentMonth());
  const [monthlyBudgetMajor, setMonthlyBudgetMajor] = useState("0.00");
  const [categoryBudgets, setCategoryBudgets] = useState<CategoryBudgetDraft[]>([]);
  const [history, setHistory] = useState<BudgetResponse[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load(selectedMonth: string) {
    setError(null);
    try {
      const [current, all] = await Promise.all([fetchBudgets(selectedMonth), fetchBudgets()]);
      setHistory(all.items);
      const item = current.items[0];
      if (item) {
        setMonthlyBudgetMajor(item.monthlyBudgetMajor);
        setCategoryBudgets(item.categoryBudgets);
      } else {
        setMonthlyBudgetMajor("0.00");
        setCategoryBudgets([]);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load budgets");
    }
  }

  useEffect(() => {
    void load(month);
  }, [month]);

  async function handleSave() {
    setError(null);
    try {
      await upsertBudget(month, { monthlyBudgetMajor, categoryBudgets });
      await load(month);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save budget");
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl p-6">
      <section className="rounded border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Budgets</h1>
        <p className="mt-1 text-sm text-slate-600">Set monthly and category budgets used by analytics.</p>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <label className="text-xs text-slate-600">
            Month
            <input
              type="month"
              className="mt-1 block w-full rounded border border-slate-300 px-2 py-2 text-sm"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
            />
          </label>
          <label className="text-xs text-slate-600">
            Monthly Budget
            <input
              className="mt-1 block w-full rounded border border-slate-300 px-2 py-2 text-sm"
              value={monthlyBudgetMajor}
              onChange={(event) => setMonthlyBudgetMajor(event.target.value)}
              placeholder="50000.00"
            />
          </label>
          <div className="flex items-end">
            <button
              type="button"
              className="w-full rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white"
              onClick={() => void handleSave()}
            >
              Save Budget
            </button>
          </div>
        </div>

        <div className="mt-6 rounded border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Category Budgets</h2>
            <button
              type="button"
              className="rounded border border-slate-300 px-2 py-1 text-xs"
              onClick={() =>
                setCategoryBudgets((previous) => [...previous, { categoryName: "", budgetMajor: "0.00" }])
              }
            >
              Add Row
            </button>
          </div>
          <div className="mt-3 space-y-2">
            {categoryBudgets.map((item, index) => (
              <div key={`${item.categoryName}-${index}`} className="grid gap-2 md:grid-cols-3">
                <input
                  className="rounded border border-slate-300 px-2 py-2 text-sm"
                  placeholder="Category"
                  value={item.categoryName}
                  onChange={(event) =>
                    setCategoryBudgets((previous) =>
                      previous.map((entry, entryIndex) =>
                        entryIndex === index ? { ...entry, categoryName: event.target.value } : entry
                      )
                    )
                  }
                />
                <input
                  className="rounded border border-slate-300 px-2 py-2 text-sm"
                  placeholder="10000.00"
                  value={item.budgetMajor}
                  onChange={(event) =>
                    setCategoryBudgets((previous) =>
                      previous.map((entry, entryIndex) =>
                        entryIndex === index ? { ...entry, budgetMajor: event.target.value } : entry
                      )
                    )
                  }
                />
                <button
                  type="button"
                  className="rounded border border-slate-300 px-2 py-2 text-xs"
                  onClick={() =>
                    setCategoryBudgets((previous) => previous.filter((_entry, entryIndex) => entryIndex !== index))
                  }
                >
                  Remove
                </button>
              </div>
            ))}
            {categoryBudgets.length === 0 ? (
              <p className="text-sm text-slate-500">No category budgets for this month.</p>
            ) : null}
          </div>
        </div>

        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
      </section>

      <section className="mt-6 rounded border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Budget History</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-4">Month</th>
                <th className="py-2 pr-4">Monthly Budget</th>
                <th className="py-2 pr-4">Category Entries</th>
              </tr>
            </thead>
            <tbody>
              {history.map((item) => (
                <tr key={item.id} className="border-b border-slate-100">
                  <td className="py-3 pr-4 text-slate-700">{item.month}</td>
                  <td className="py-3 pr-4 text-slate-900">{item.monthlyBudgetMajor}</td>
                  <td className="py-3 pr-4 text-slate-700">{item.categoryBudgets.length}</td>
                </tr>
              ))}
              {history.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-6 text-center text-slate-500">
                    No budgets found
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
