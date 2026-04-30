"use client";

import { useEffect, useState } from "react";
import type { CategoryRuleResponse } from "@spendsense/shared";
import {
  createCategoryRule,
  deleteCategoryRule,
  fetchCategoryRules,
  updateCategoryRule
} from "../../lib/api";

export default function RulesPage() {
  const [items, setItems] = useState<CategoryRuleResponse[]>([]);
  const [priorityDrafts, setPriorityDrafts] = useState<Record<string, string>>({});
  const [keyword, setKeyword] = useState("");
  const [categoryName, setCategoryName] = useState("Uncategorized");
  const [priority, setPriority] = useState("100");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const result = await fetchCategoryRules();
      setItems(result.items);
      setPriorityDrafts(
        Object.fromEntries(result.items.map((item) => [item.id, String(item.priority)]))
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load rules");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleCreate() {
    setError(null);
    try {
      await createCategoryRule({
        keyword,
        categoryName,
        priority: Number(priority),
        isActive: true
      });
      setKeyword("");
      await load();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Unable to create rule");
    }
  }

  async function toggleActive(item: CategoryRuleResponse) {
    setError(null);
    try {
      await updateCategoryRule(item.id, { isActive: !item.isActive });
      await load();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Unable to update rule");
    }
  }

  async function remove(item: CategoryRuleResponse) {
    setError(null);
    try {
      await deleteCategoryRule(item.id);
      await load();
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Unable to disable rule");
    }
  }

  async function savePriority(item: CategoryRuleResponse) {
    setError(null);
    const draft = priorityDrafts[item.id];
    const nextPriority = Number(draft);
    if (!Number.isFinite(nextPriority)) {
      setError("Priority must be a valid number");
      return;
    }
    try {
      await updateCategoryRule(item.id, { priority: nextPriority });
      await load();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Unable to update priority");
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl p-6">
      <section className="rounded border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Category Rules</h1>
        <p className="mt-1 text-sm text-slate-600">
          Rules are applied by priority for future SMS/statement categorization.
        </p>

        <div className="mt-6 grid gap-3 md:grid-cols-4">
          <input
            className="rounded border border-slate-300 px-3 py-2 text-sm"
            placeholder="Keyword e.g. SWIGGY"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
          />
          <input
            className="rounded border border-slate-300 px-3 py-2 text-sm"
            placeholder="Category"
            value={categoryName}
            onChange={(event) => setCategoryName(event.target.value)}
          />
          <input
            type="number"
            className="rounded border border-slate-300 px-3 py-2 text-sm"
            value={priority}
            onChange={(event) => setPriority(event.target.value)}
          />
          <button
            type="button"
            className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white"
            onClick={() => void handleCreate()}
          >
            Add Rule
          </button>
        </div>

        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-4">Keyword</th>
                <th className="py-2 pr-4">Category</th>
                <th className="py-2 pr-4">Priority</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-slate-100">
                  <td className="py-3 pr-4 text-slate-900">{item.keyword}</td>
                  <td className="py-3 pr-4 text-slate-700">{item.categoryName}</td>
                  <td className="py-3 pr-4 text-slate-700">
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        className="w-20 rounded border border-slate-300 px-2 py-1 text-xs"
                        value={priorityDrafts[item.id] ?? String(item.priority)}
                        onChange={(event) =>
                          setPriorityDrafts((previous) => ({
                            ...previous,
                            [item.id]: event.target.value
                          }))
                        }
                      />
                      <button
                        type="button"
                        className="rounded border border-slate-300 px-2 py-1 text-xs"
                        onClick={() => void savePriority(item)}
                      >
                        Save
                      </button>
                    </div>
                  </td>
                  <td className="py-3 pr-4 text-slate-700">{item.isActive ? "Active" : "Disabled"}</td>
                  <td className="py-3 pr-4">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="rounded border border-slate-300 px-2 py-1 text-xs"
                        onClick={() => void toggleActive(item)}
                      >
                        {item.isActive ? "Disable" : "Enable"}
                      </button>
                      <button
                        type="button"
                        className="rounded border border-slate-300 px-2 py-1 text-xs"
                        onClick={() => void remove(item)}
                      >
                        Soft Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-500">
                    No rules found
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
