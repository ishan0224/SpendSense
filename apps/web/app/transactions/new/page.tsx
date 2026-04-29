"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CreateTransactionInput } from "@spendsense/shared";
import { TransactionForm } from "../../../components/transaction-form";
import { createTransaction } from "../../../lib/api";

export default function NewTransactionPage() {
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(payload: CreateTransactionInput): Promise<void> {
    await createTransaction(payload);
    setSuccessMessage("Transaction saved");
    router.push("/transactions");
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl p-6">
      <section className="rounded border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Add Manual Transaction</h1>
        <p className="mt-1 text-sm text-slate-600">
          Record debit or credit entries that are not auto-ingested yet.
        </p>
        <div className="mt-6">
          <TransactionForm mode="create" submitLabel="Create Transaction" onSubmit={handleSubmit} />
        </div>
        {successMessage ? <p className="mt-4 text-sm text-emerald-700">{successMessage}</p> : null}
      </section>
    </main>
  );
}
