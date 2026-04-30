"use client";

import { useEffect, useState } from "react";
import type { IngestionLogResponse, IngestionLogsQuery } from "@spendsense/shared";
import { fetchIngestionLogs } from "../../lib/api";

type PaginationMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export default function LogsPage() {
  const [items, setItems] = useState<IngestionLogResponse[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1
  });
  const [filters, setFilters] = useState<IngestionLogsQuery>({
    page: 1,
    pageSize: 20
  });
  const [error, setError] = useState<string | null>(null);

  async function load(nextFilters: IngestionLogsQuery) {
    setError(null);
    try {
      const result = await fetchIngestionLogs(nextFilters);
      setItems(result.items);
      setPagination(result.pagination);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load ingestion logs");
    }
  }

  useEffect(() => {
    void load(filters);
  }, [filters]);

  function updateFilters(patch: Partial<IngestionLogsQuery>) {
    setFilters((previous) => ({
      ...previous,
      ...patch,
      page: patch.page ?? 1
    }));
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl p-6">
      <section className="rounded border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Ingestion Logs</h1>
        <p className="mt-1 text-sm text-slate-600">Track created, duplicate, ignored, and failed ingestion events.</p>

        <div className="mt-6 grid gap-3 md:grid-cols-5">
          <label className="text-xs text-slate-600">
            Source
            <select
              className="mt-1 block w-full rounded border border-slate-300 px-2 py-2 text-sm"
              value={filters.source ?? ""}
              onChange={(event) => {
                const value = event.target.value;
                updateFilters({ source: value ? (value as IngestionLogsQuery["source"]) : undefined });
              }}
            >
              <option value="">All</option>
              <option value="sms">sms</option>
              <option value="notification">notification</option>
              <option value="statement">statement</option>
              <option value="manual">manual</option>
            </select>
          </label>
          <label className="text-xs text-slate-600">
            Status
            <select
              className="mt-1 block w-full rounded border border-slate-300 px-2 py-2 text-sm"
              value={filters.status ?? ""}
              onChange={(event) => {
                const value = event.target.value;
                updateFilters({ status: value ? (value as IngestionLogsQuery["status"]) : undefined });
              }}
            >
              <option value="">All</option>
              <option value="created">created</option>
              <option value="duplicate">duplicate</option>
              <option value="ignored">ignored</option>
              <option value="failed">failed</option>
              <option value="parsed">parsed</option>
              <option value="reconciled">reconciled</option>
            </select>
          </label>
          <label className="text-xs text-slate-600">
            From
            <input
              type="date"
              className="mt-1 block w-full rounded border border-slate-300 px-2 py-2 text-sm"
              value={filters.fromDate ?? ""}
              onChange={(event) => updateFilters({ fromDate: event.target.value || undefined })}
            />
          </label>
          <label className="text-xs text-slate-600">
            To
            <input
              type="date"
              className="mt-1 block w-full rounded border border-slate-300 px-2 py-2 text-sm"
              value={filters.toDate ?? ""}
              onChange={(event) => updateFilters({ toDate: event.target.value || undefined })}
            />
          </label>
          <div className="flex items-end">
            <button
              type="button"
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              onClick={() => setFilters({ page: 1, pageSize: 20 })}
            >
              Reset Filters
            </button>
          </div>
        </div>

        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-4">Created</th>
                <th className="py-2 pr-4">Source</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Reason</th>
                <th className="py-2 pr-4">Sender</th>
                <th className="py-2 pr-4">Transaction</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-slate-100">
                  <td className="py-3 pr-4 text-slate-600">{new Date(item.createdAt).toLocaleString()}</td>
                  <td className="py-3 pr-4 text-slate-700">{item.source}</td>
                  <td className="py-3 pr-4 text-slate-700">{item.status}</td>
                  <td className="py-3 pr-4 text-slate-700">{item.reason ?? "-"}</td>
                  <td className="py-3 pr-4 text-slate-700">{item.senderOriginal ?? "-"}</td>
                  <td className="py-3 pr-4 text-slate-700">{item.transactionId ?? "-"}</td>
                </tr>
              ))}
              {items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-500">
                    No logs found
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
          <p>
            Page {pagination.page} of {pagination.totalPages} · {pagination.total} total
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded border border-slate-300 px-2 py-1 disabled:opacity-50"
              disabled={pagination.page <= 1}
              onClick={() => updateFilters({ page: Math.max(1, pagination.page - 1) })}
            >
              Prev
            </button>
            <button
              type="button"
              className="rounded border border-slate-300 px-2 py-1 disabled:opacity-50"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => updateFilters({ page: Math.min(pagination.totalPages, pagination.page + 1) })}
            >
              Next
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
