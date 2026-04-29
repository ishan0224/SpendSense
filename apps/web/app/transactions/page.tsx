"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { TransactionResponse, UpdateTransactionInput } from "@spendsense/shared";
import { ignoreTransaction, fetchTransactions, restoreTransaction, updateTransaction } from "../../lib/api";
import { TransactionForm } from "../../components/transaction-form";

type Filters = {
  month: string;
  category: string;
  direction: "" | "debit" | "credit";
  includeIgnored: boolean;
  q: string;
};

function defaultMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function toDateInput(isoDate: string): string {
  return isoDate.slice(0, 10);
}

function formatCurrency(amountMinor: number, currency: string): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency
  }).format(amountMinor / 100);
}

export default function TransactionsPage() {
  const [items, setItems] = useState<TransactionResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeEditId, setActiveEditId] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [filters, setFilters] = useState<Filters>({
    month: defaultMonth(),
    category: "",
    direction: "",
    includeIgnored: false,
    q: ""
  });

  const selectedEdit = useMemo(
    () => items.find((item) => item.id === activeEditId) ?? null,
    [items, activeEditId]
  );

  const loadTransactions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchTransactions({
        month: filters.month || undefined,
        category: filters.category || undefined,
        direction: filters.direction || undefined,
        includeIgnored: filters.includeIgnored,
        q: filters.q || undefined,
        page: 1,
        pageSize: 50
      });
      setItems(response.items);
    } catch (fetchError) {
      const message =
        fetchError instanceof Error ? fetchError.message : "Unable to fetch transactions";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void loadTransactions();
  }, [loadTransactions, refreshTick]);

  function mutateFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((previous) => ({ ...previous, [key]: value }));
  }

  async function handleIgnoreToggle(transaction: TransactionResponse): Promise<void> {
    if (transaction.isIgnored) {
      await restoreTransaction(transaction.id);
    } else {
      await ignoreTransaction(transaction.id);
    }
    setRefreshTick((previous) => previous + 1);
  }

  async function handleEditSubmit(payload: UpdateTransactionInput): Promise<void> {
    if (!activeEditId) {
      return;
    }
    await updateTransaction(activeEditId, payload);
    setActiveEditId(null);
    setRefreshTick((previous) => previous + 1);
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl p-6">
      <section className="rounded border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Transactions</h1>
            <p className="mt-1 text-sm text-slate-600">
              Search, filter, edit, ignore, and restore manual records.
            </p>
          </div>
          <Link
            href="/transactions/new"
            className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white"
          >
            Add Transaction
          </Link>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-5">
          <label className="text-xs text-slate-600">
            Month
            <input
              type="month"
              className="mt-1 block w-full rounded border border-slate-300 px-2 py-2 text-sm"
              value={filters.month}
              onChange={(event) => mutateFilter("month", event.target.value)}
            />
          </label>

          <label className="text-xs text-slate-600">
            Category
            <input
              className="mt-1 block w-full rounded border border-slate-300 px-2 py-2 text-sm"
              value={filters.category}
              onChange={(event) => mutateFilter("category", event.target.value)}
              placeholder="Food"
            />
          </label>

          <label className="text-xs text-slate-600">
            Direction
            <select
              className="mt-1 block w-full rounded border border-slate-300 px-2 py-2 text-sm"
              value={filters.direction}
              onChange={(event) => mutateFilter("direction", event.target.value as Filters["direction"])}
            >
              <option value="">All</option>
              <option value="debit">Debit</option>
              <option value="credit">Credit</option>
            </select>
          </label>

          <label className="text-xs text-slate-600">
            Search
            <input
              className="mt-1 block w-full rounded border border-slate-300 px-2 py-2 text-sm"
              value={filters.q}
              onChange={(event) => mutateFilter("q", event.target.value)}
              placeholder="merchant or notes"
            />
          </label>

          <label className="mt-5 inline-flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={filters.includeIgnored}
              onChange={(event) => mutateFilter("includeIgnored", event.target.checked)}
            />
            Include ignored
          </label>
        </div>

        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-600">
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Merchant</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">Direction</th>
                <th className="px-3 py-2">Amount</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-slate-500">
                    Loading transactions...
                  </td>
                </tr>
              ) : null}

              {!loading && items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-slate-500">
                    No transactions found for current filters.
                  </td>
                </tr>
              ) : null}

              {!loading
                ? items.map((item) => (
                    <tr key={item.id} className="border-b border-slate-200">
                      <td className="px-3 py-3 text-slate-700">{item.transactionDate}</td>
                      <td className="px-3 py-3 text-slate-900">{item.merchantOriginal}</td>
                      <td className="px-3 py-3 text-slate-700">{item.categoryName}</td>
                      <td className="px-3 py-3 text-slate-700 capitalize">{item.direction}</td>
                      <td className="px-3 py-3 font-medium text-slate-900">
                        {formatCurrency(item.amountMinor, item.currency)}
                      </td>
                      <td className="px-3 py-3 text-slate-700">
                        {item.isIgnored ? "Ignored" : item.reconciliationStatus}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-800"
                            onClick={() =>
                              setActiveEditId((previous) => (previous === item.id ? null : item.id))
                            }
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-800"
                            onClick={() => void handleIgnoreToggle(item)}
                          >
                            {item.isIgnored ? "Restore" : "Ignore"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                : null}
            </tbody>
          </table>
        </div>

        {selectedEdit ? (
          <div className="mt-8 rounded border border-slate-200 bg-slate-50 p-4">
            <h2 className="text-base font-semibold text-slate-900">Edit Transaction</h2>
            <div className="mt-4">
              <TransactionForm
                mode="edit"
                submitLabel="Save Changes"
                initialValues={{
                  direction: selectedEdit.direction,
                  amountMajor: selectedEdit.amountMajor,
                  currency: selectedEdit.currency,
                  merchantOriginal: selectedEdit.merchantOriginal,
                  categoryName: selectedEdit.categoryName,
                  paymentMode: selectedEdit.paymentMode,
                  bankCode: selectedEdit.bankCode ?? "",
                  transactionDate: toDateInput(selectedEdit.transactionDate),
                  notes: selectedEdit.notes ?? ""
                }}
                onSubmit={handleEditSubmit}
              />
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
