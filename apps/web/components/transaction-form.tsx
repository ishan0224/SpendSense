"use client";

import { useMemo, useState } from "react";
import type { CreateTransactionInput, UpdateTransactionInput } from "@spendsense/shared";

type TransactionFormValues = {
  direction: "debit" | "credit";
  amountMajor: string;
  currency: string;
  merchantOriginal: string;
  categoryName: string;
  paymentMode: string;
  bankCode: string;
  transactionDate: string;
  notes: string;
};

type TransactionFormProps = {
  initialValues?: Partial<TransactionFormValues>;
  submitLabel: string;
};

type CreateModeProps = TransactionFormProps & {
  mode: "create";
  onSubmit: (payload: CreateTransactionInput) => Promise<void>;
};

type EditModeProps = TransactionFormProps & {
  mode: "edit";
  onSubmit: (payload: UpdateTransactionInput) => Promise<void>;
};

const today = new Date().toISOString().slice(0, 10);

export function TransactionForm({
  initialValues,
  submitLabel,
  onSubmit,
  mode
}: CreateModeProps | EditModeProps) {
  const defaults: TransactionFormValues = useMemo(
    () => ({
      direction: initialValues?.direction ?? "debit",
      amountMajor: initialValues?.amountMajor ?? "",
      currency: initialValues?.currency ?? "INR",
      merchantOriginal: initialValues?.merchantOriginal ?? "",
      categoryName: initialValues?.categoryName ?? "Uncategorized",
      paymentMode: initialValues?.paymentMode ?? "Unknown",
      bankCode: initialValues?.bankCode ?? "",
      transactionDate: initialValues?.transactionDate ?? today,
      notes: initialValues?.notes ?? ""
    }),
    [initialValues]
  );

  const [values, setValues] = useState<TransactionFormValues>(defaults);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function update<K extends keyof TransactionFormValues>(key: K, next: TransactionFormValues[K]) {
    setValues((previous) => ({ ...previous, [key]: next }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (mode === "create") {
        const payload: CreateTransactionInput = {
          direction: values.direction,
          amountMajor: values.amountMajor,
          currency: values.currency,
          merchantOriginal: values.merchantOriginal,
          categoryName: values.categoryName,
          paymentMode: values.paymentMode,
          transactionDate: values.transactionDate,
          ...(values.bankCode ? { bankCode: values.bankCode } : {}),
          ...(values.notes ? { notes: values.notes } : {})
        };
        await onSubmit(payload);
      } else {
        const payload: UpdateTransactionInput = {
          direction: values.direction,
          amountMajor: values.amountMajor,
          currency: values.currency,
          merchantOriginal: values.merchantOriginal,
          categoryName: values.categoryName,
          paymentMode: values.paymentMode,
          transactionDate: values.transactionDate,
          ...(values.bankCode ? { bankCode: values.bankCode } : {}),
          ...(values.notes ? { notes: values.notes } : {})
        };
        await onSubmit(payload);
      }
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Unable to save transaction";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-sm text-slate-700">
          Direction
          <select
            className="mt-1 block w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
            value={values.direction}
            onChange={(event) => update("direction", event.target.value as "debit" | "credit")}
          >
            <option value="debit">Debit</option>
            <option value="credit">Credit</option>
          </select>
        </label>

        <label className="text-sm text-slate-700">
          Amount
          <input
            className="mt-1 block w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
            value={values.amountMajor}
            onChange={(event) => update("amountMajor", event.target.value)}
            placeholder="500.00"
            required
          />
        </label>

        <label className="text-sm text-slate-700">
          Merchant
          <input
            className="mt-1 block w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
            value={values.merchantOriginal}
            onChange={(event) => update("merchantOriginal", event.target.value)}
            placeholder="Zomato"
            required
          />
        </label>

        <label className="text-sm text-slate-700">
          Date
          <input
            type="date"
            className="mt-1 block w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
            value={values.transactionDate}
            onChange={(event) => update("transactionDate", event.target.value)}
            required
          />
        </label>

        <label className="text-sm text-slate-700">
          Category
          <input
            className="mt-1 block w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
            value={values.categoryName}
            onChange={(event) => update("categoryName", event.target.value)}
            required
          />
        </label>

        <label className="text-sm text-slate-700">
          Payment Mode
          <input
            className="mt-1 block w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
            value={values.paymentMode}
            onChange={(event) => update("paymentMode", event.target.value)}
            required
          />
        </label>

        <label className="text-sm text-slate-700">
          Bank Code
          <input
            className="mt-1 block w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
            value={values.bankCode}
            onChange={(event) => update("bankCode", event.target.value)}
            placeholder="HDFCBK"
          />
        </label>

        <label className="text-sm text-slate-700">
          Currency
          <input
            className="mt-1 block w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm uppercase"
            value={values.currency}
            onChange={(event) => update("currency", event.target.value.toUpperCase())}
            required
          />
        </label>
      </div>

      <label className="block text-sm text-slate-700">
        Notes
        <textarea
          className="mt-1 block w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
          rows={3}
          value={values.notes}
          onChange={(event) => update("notes", event.target.value)}
        />
      </label>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {isSubmitting ? "Saving..." : submitLabel}
      </button>
    </form>
  );
}
