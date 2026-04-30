"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  StatementColumnMapping,
  StatementCommitResult,
  StatementImportHistoryItem,
  StatementPreviewResult
} from "@spendsense/shared";
import {
  commitStatementImport,
  fetchStatementImportHistory,
  previewStatementImport
} from "../../lib/api";

const mappingFields: Array<keyof StatementColumnMapping> = [
  "transactionDate",
  "postedDate",
  "debitAmount",
  "creditAmount",
  "amount",
  "direction",
  "narration",
  "balance"
];

function rupees(amountMajor: string): string {
  const parsed = Number(amountMajor);
  if (!Number.isFinite(parsed)) {
    return amountMajor;
  }
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR"
  }).format(parsed);
}

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [bankCode, setBankCode] = useState("");
  const [statementMonth, setStatementMonth] = useState(new Date().toISOString().slice(0, 7));
  const [mapping, setMapping] = useState<Partial<StatementColumnMapping>>({});
  const [preview, setPreview] = useState<StatementPreviewResult | null>(null);
  const [history, setHistory] = useState<StatementImportHistoryItem[]>([]);
  const [commitResult, setCommitResult] = useState<StatementCommitResult | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    try {
      const result = await fetchStatementImportHistory();
      setHistory(result.items);
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : "Unable to load import history";
      setError(message);
    }
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  async function handlePreview(): Promise<void> {
    if (!file) {
      setError("Choose a CSV or XLSX statement file first");
      return;
    }
    setError(null);
    setIsPreviewing(true);
    setCommitResult(null);
    try {
      const result = await previewStatementImport({
        file,
        mapping,
        statementMonth: statementMonth || undefined,
        bankCode: bankCode || undefined
      });
      setPreview(result);
      setMapping(result.mapping);
    } catch (previewError) {
      const message = previewError instanceof Error ? previewError.message : "Unable to preview statement";
      setError(message);
    } finally {
      setIsPreviewing(false);
    }
  }

  async function handleCommit(): Promise<void> {
    if (!preview) {
      setError("Generate preview before commit");
      return;
    }
    setError(null);
    setIsCommitting(true);
    try {
      const result = await commitStatementImport({
        fileName: preview.fileName,
        fileType: preview.fileType,
        statementMonth: statementMonth || undefined,
        bankCode: bankCode || undefined,
        previewToken: preview.previewToken,
        rows: preview.rows
      });
      setCommitResult(result);
      await loadHistory();
    } catch (commitError) {
      const message = commitError instanceof Error ? commitError.message : "Unable to commit statement import";
      setError(message);
    } finally {
      setIsCommitting(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl p-6">
      <section className="rounded border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Statement Import</h1>
        <p className="mt-1 text-sm text-slate-600">
          Upload a statement, map columns, preview normalized rows, then commit reconciliation.
        </p>

        <div className="mt-6 grid gap-3 md:grid-cols-4">
          <label className="text-xs text-slate-600">
            Statement File
            <input
              type="file"
              accept=".csv,.xlsx"
              className="mt-1 block w-full rounded border border-slate-300 px-2 py-2 text-sm"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </label>
          <label className="text-xs text-slate-600">
            Statement Month
            <input
              type="month"
              className="mt-1 block w-full rounded border border-slate-300 px-2 py-2 text-sm"
              value={statementMonth}
              onChange={(event) => setStatementMonth(event.target.value)}
            />
          </label>
          <label className="text-xs text-slate-600">
            Bank Code
            <input
              className="mt-1 block w-full rounded border border-slate-300 px-2 py-2 text-sm"
              value={bankCode}
              onChange={(event) => setBankCode(event.target.value.toUpperCase())}
              placeholder="HDFCBK"
            />
          </label>
          <div className="flex items-end">
            <button
              type="button"
              className="w-full rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
              onClick={() => void handlePreview()}
              disabled={isPreviewing}
            >
              {isPreviewing ? "Previewing..." : "Preview Import"}
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-4">
          {mappingFields.map((field) => (
            <label key={field} className="text-xs text-slate-600">
              {field}
              <input
                className="mt-1 block w-full rounded border border-slate-300 px-2 py-2 text-sm"
                value={mapping[field] ?? ""}
                onChange={(event) =>
                  setMapping((previous) => ({
                    ...previous,
                    [field]: event.target.value
                  }))
                }
                placeholder="Column header"
              />
            </label>
          ))}
        </div>

        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

        {preview ? (
          <div className="mt-8 rounded border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-slate-900">{preview.fileName}</p>
                <p className="text-xs text-slate-600">
                  Total {preview.totalRows} · Valid {preview.validRows} · Failed {preview.failedRows}
                </p>
              </div>
              <button
                type="button"
                className="rounded bg-emerald-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                onClick={() => void handleCommit()}
                disabled={isCommitting || preview.rows.length === 0}
              >
                {isCommitting ? "Committing..." : "Commit Import"}
              </button>
            </div>

            {preview.errors.length > 0 ? (
              <div className="mt-4 rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                {preview.errors.slice(0, 8).map((item) => (
                  <p key={`${item.rowNumber}-${item.reason}`}>
                    Row {item.rowNumber}: {item.reason}
                  </p>
                ))}
              </div>
            ) : null}

            <div className="mt-4 max-h-80 overflow-auto rounded border border-slate-200 bg-white">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-600">
                    <th className="px-3 py-2">Row</th>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Direction</th>
                    <th className="px-3 py-2">Amount</th>
                    <th className="px-3 py-2">Merchant</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.slice(0, 120).map((row) => (
                    <tr key={row.sourceFingerprint ?? row.rowNumber} className="border-b border-slate-100">
                      <td className="px-3 py-2 text-slate-600">{row.rowNumber}</td>
                      <td className="px-3 py-2 text-slate-700">{row.transactionDate}</td>
                      <td className="px-3 py-2 capitalize text-slate-700">{row.direction}</td>
                      <td className="px-3 py-2 font-medium text-slate-900">{rupees(row.amountMajor)}</td>
                      <td className="px-3 py-2 text-slate-700">{row.merchantOriginal}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {commitResult ? (
          <div className="mt-6 rounded border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            Import completed: created {commitResult.summary.created}, matched {commitResult.summary.matchedWithSms},
            skipped {commitResult.summary.duplicatesSkipped}, failed {commitResult.summary.failed}.
          </div>
        ) : null}
      </section>

      <section className="mt-6 rounded border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Import History</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-4">Date</th>
                <th className="py-2 pr-4">File</th>
                <th className="py-2 pr-4">Month</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Summary</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-500">
                    No imports yet
                  </td>
                </tr>
              ) : null}
              {history.map((item) => (
                <tr key={item.id} className="border-b border-slate-100">
                  <td className="py-3 pr-4 text-slate-600">{new Date(item.createdAt).toLocaleString()}</td>
                  <td className="py-3 pr-4 text-slate-900">{item.fileName}</td>
                  <td className="py-3 pr-4 text-slate-600">{item.statementMonth ?? "-"}</td>
                  <td className="py-3 pr-4 capitalize text-slate-700">{item.status}</td>
                  <td className="py-3 pr-4 text-slate-600">
                    C:{item.summary.created} M:{item.summary.matchedWithSms} S:
                    {item.summary.duplicatesSkipped} F:{item.summary.failed}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
