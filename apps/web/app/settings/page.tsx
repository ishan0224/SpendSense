"use client";

import { useEffect, useState } from "react";
import type { BankMappingResponse, WebhookKeyResponse } from "@spendsense/shared";
import {
  createBankMapping,
  createWebhookKey,
  disableWebhookKey,
  fetchBankMappings,
  fetchWebhookKeys,
  rotateWebhookKey,
  updateBankMapping
} from "../../lib/api";

export default function SettingsPage() {
  const appTimezone = process.env.NEXT_PUBLIC_APP_TIMEZONE ?? "Asia/Kolkata";
  const defaultCurrency = process.env.NEXT_PUBLIC_DEFAULT_CURRENCY ?? "INR";

  const [mappings, setMappings] = useState<BankMappingResponse[]>([]);
  const [keys, setKeys] = useState<WebhookKeyResponse[]>([]);
  const [senderCode, setSenderCode] = useState("");
  const [bankName, setBankName] = useState("");
  const [keyName, setKeyName] = useState("Tasker Phone");
  const [latestSecret, setLatestSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const [mappingResult, keyResult] = await Promise.all([fetchBankMappings(), fetchWebhookKeys()]);
      setMappings(mappingResult.items);
      setKeys(keyResult.items);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load settings");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleAddMapping() {
    setError(null);
    try {
      await createBankMapping({
        senderCode,
        bankName,
        isActive: true
      });
      setSenderCode("");
      setBankName("");
      await load();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Unable to create mapping");
    }
  }

  async function handleCreateKey() {
    setError(null);
    setLatestSecret(null);
    try {
      const result = await createWebhookKey({ name: keyName });
      setLatestSecret(result.plaintextSecret);
      await load();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Unable to create webhook key");
    }
  }

  async function handleRotateKey(id: string) {
    setError(null);
    setLatestSecret(null);
    try {
      const result = await rotateWebhookKey(id);
      setLatestSecret(result.plaintextSecret);
      await load();
    } catch (rotateError) {
      setError(rotateError instanceof Error ? rotateError.message : "Unable to rotate webhook key");
    }
  }

  async function handleDisableKey(id: string) {
    setError(null);
    try {
      await disableWebhookKey(id);
      await load();
    } catch (disableError) {
      setError(disableError instanceof Error ? disableError.message : "Unable to disable key");
    }
  }

  async function toggleMapping(item: BankMappingResponse) {
    setError(null);
    try {
      await updateBankMapping(item.id, { isActive: !item.isActive });
      await load();
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : "Unable to update mapping");
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl p-6">
      <section className="rounded border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Settings</h1>
        <p className="mt-1 text-sm text-slate-600">Personal setup for bank mappings and webhook automation keys.</p>
        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Default Currency</p>
            <p className="mt-1 text-sm font-medium text-slate-900">{defaultCurrency}</p>
          </div>
          <div className="rounded border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">App Timezone</p>
            <p className="mt-1 text-sm font-medium text-slate-900">{appTimezone}</p>
          </div>
        </div>
      </section>

      <section className="mt-6 rounded border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Bank Sender Mappings</h2>
        <p className="mt-1 text-sm text-slate-600">Map normalized sender codes to friendly bank names.</p>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <input
            className="rounded border border-slate-300 px-3 py-2 text-sm"
            placeholder="Sender code (e.g. HDFCBK)"
            value={senderCode}
            onChange={(event) => setSenderCode(event.target.value)}
          />
          <input
            className="rounded border border-slate-300 px-3 py-2 text-sm"
            placeholder="Bank name"
            value={bankName}
            onChange={(event) => setBankName(event.target.value)}
          />
          <button
            type="button"
            className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white"
            onClick={() => void handleAddMapping()}
          >
            Add Mapping
          </button>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-4">Sender Code</th>
                <th className="py-2 pr-4">Bank Name</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Action</th>
              </tr>
            </thead>
            <tbody>
              {mappings.map((item) => (
                <tr key={item.id} className="border-b border-slate-100">
                  <td className="py-3 pr-4 text-slate-900">{item.senderCode}</td>
                  <td className="py-3 pr-4 text-slate-700">{item.bankName}</td>
                  <td className="py-3 pr-4 text-slate-700">{item.isActive ? "Active" : "Disabled"}</td>
                  <td className="py-3 pr-4">
                    <button
                      type="button"
                      className="rounded border border-slate-300 px-2 py-1 text-xs"
                      onClick={() => void toggleMapping(item)}
                    >
                      {item.isActive ? "Disable" : "Enable"}
                    </button>
                  </td>
                </tr>
              ))}
              {mappings.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-slate-500">
                    No mappings configured
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-6 rounded border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">Webhook Keys</h2>
        <p className="mt-1 text-sm text-slate-600">
          Plaintext secret is shown only once at creation/rotation. Save it in Tasker `%SS_SECRET`.
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <input
            className="rounded border border-slate-300 px-3 py-2 text-sm"
            placeholder="Key name"
            value={keyName}
            onChange={(event) => setKeyName(event.target.value)}
          />
          <button
            type="button"
            className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white"
            onClick={() => void handleCreateKey()}
          >
            Create Key
          </button>
          <div />
        </div>

        {latestSecret ? (
          <div className="mt-4 rounded border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-amber-800">Copy Secret Now</p>
            <p className="mt-1 break-all font-mono text-sm text-amber-900">{latestSecret}</p>
          </div>
        ) : null}

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Created</th>
                <th className="py-2 pr-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((item) => (
                <tr key={item.id} className="border-b border-slate-100">
                  <td className="py-3 pr-4 text-slate-900">{item.name}</td>
                  <td className="py-3 pr-4 text-slate-700">{item.isActive ? "Active" : "Disabled"}</td>
                  <td className="py-3 pr-4 text-slate-700">{new Date(item.createdAt).toLocaleString()}</td>
                  <td className="py-3 pr-4">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="rounded border border-slate-300 px-2 py-1 text-xs"
                        onClick={() => void handleRotateKey(item.id)}
                      >
                        Rotate
                      </button>
                      <button
                        type="button"
                        className="rounded border border-slate-300 px-2 py-1 text-xs"
                        onClick={() => void handleDisableKey(item.id)}
                      >
                        Disable
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {keys.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-slate-500">
                    No webhook keys configured
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
