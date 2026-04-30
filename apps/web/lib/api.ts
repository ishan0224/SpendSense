import type {
  BankMappingInput,
  BankMappingResponse,
  CategoryAnalyticsItem,
  CategoryRuleInput,
  CategoryRuleResponse,
  CreateTransactionInput,
  DailyAnalyticsItem,
  IngestionLogResponse,
  IngestionLogsQuery,
  ImpactTransaction,
  MerchantAnalyticsItem,
  MoneySummary,
  PaginatedTransactionsResponse,
  BudgetResponse,
  StatementColumnMapping,
  StatementCommitRequest,
  StatementCommitResult,
  StatementImportHistoryResponse,
  StatementPreviewResult,
  TransactionResponse,
  UpdateCategoryRuleInput,
  UpdateTransactionInput,
  WebhookKeyCreateResponse,
  WebhookKeyResponse
} from "@spendsense/shared";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:10000";

type QueryFilters = {
  month?: string;
  category?: string;
  direction?: "debit" | "credit";
  includeIgnored?: boolean;
  q?: string;
  page?: number;
  pageSize?: number;
};

type SettingsBudgetUpsert = {
  monthlyBudgetMajor: string;
  categoryBudgets: Array<{ categoryName: string; budgetMajor: string }>;
};

type AnalyticsList<T> = {
  month: string;
  items: T[];
};

function buildUrl(path: string, query?: QueryFilters): string {
  const url = new URL(path, API_BASE_URL);
  if (!query) {
    return url.toString();
  }

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}

async function parseJson<T>(response: Response): Promise<T> {
  const body = await response.json();
  if (!response.ok) {
    const message = body?.error?.message ?? "API request failed";
    throw new Error(message);
  }
  return body as T;
}

export async function fetchTransactions(query: QueryFilters): Promise<PaginatedTransactionsResponse> {
  const response = await fetch(buildUrl("/v1/transactions", query), {
    cache: "no-store"
  });
  return parseJson<PaginatedTransactionsResponse>(response);
}

export async function createTransaction(
  payload: CreateTransactionInput
): Promise<TransactionResponse> {
  const response = await fetch(buildUrl("/v1/transactions"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  return parseJson<TransactionResponse>(response);
}

export async function updateTransaction(
  id: string,
  payload: UpdateTransactionInput
): Promise<TransactionResponse> {
  const response = await fetch(buildUrl(`/v1/transactions/${id}`), {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  return parseJson<TransactionResponse>(response);
}

export async function ignoreTransaction(id: string): Promise<TransactionResponse> {
  const response = await fetch(buildUrl(`/v1/transactions/${id}/ignore`), {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({})
  });
  return parseJson<TransactionResponse>(response);
}

export async function restoreTransaction(id: string): Promise<TransactionResponse> {
  const response = await fetch(buildUrl(`/v1/transactions/${id}/restore`), {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({})
  });
  return parseJson<TransactionResponse>(response);
}

export async function fetchSummary(month: string): Promise<MoneySummary> {
  const response = await fetch(buildUrl("/v1/analytics/summary", { month }), {
    cache: "no-store"
  });
  return parseJson<MoneySummary>(response);
}

export async function fetchCategoryAnalytics(
  month: string
): Promise<AnalyticsList<CategoryAnalyticsItem>> {
  const response = await fetch(buildUrl("/v1/analytics/categories", { month }), {
    cache: "no-store"
  });
  return parseJson<AnalyticsList<CategoryAnalyticsItem>>(response);
}

export async function fetchDailyAnalytics(month: string): Promise<AnalyticsList<DailyAnalyticsItem>> {
  const response = await fetch(buildUrl("/v1/analytics/daily", { month }), {
    cache: "no-store"
  });
  return parseJson<AnalyticsList<DailyAnalyticsItem>>(response);
}

export async function fetchMerchantAnalytics(
  month: string
): Promise<AnalyticsList<MerchantAnalyticsItem>> {
  const response = await fetch(buildUrl("/v1/analytics/merchants", { month }), {
    cache: "no-store"
  });
  return parseJson<AnalyticsList<MerchantAnalyticsItem>>(response);
}

export async function fetchImpactAnalytics(
  month: string
): Promise<AnalyticsList<ImpactTransaction>> {
  const response = await fetch(buildUrl("/v1/analytics/impact", { month }), {
    cache: "no-store"
  });
  return parseJson<AnalyticsList<ImpactTransaction>>(response);
}

export async function previewStatementImport(input: {
  file: File;
  mapping?: Partial<StatementColumnMapping>;
  statementMonth?: string;
  bankCode?: string;
}): Promise<StatementPreviewResult> {
  const form = new FormData();
  form.append("file", input.file);
  if (input.mapping && Object.keys(input.mapping).length > 0) {
    form.append("mapping", JSON.stringify(input.mapping));
  }
  if (input.statementMonth) {
    form.append("statementMonth", input.statementMonth);
  }
  if (input.bankCode) {
    form.append("bankCode", input.bankCode);
  }

  const response = await fetch(buildUrl("/v1/imports/statements/preview"), {
    method: "POST",
    body: form
  });
  return parseJson<StatementPreviewResult>(response);
}

export async function commitStatementImport(
  payload: StatementCommitRequest
): Promise<StatementCommitResult> {
  const response = await fetch(buildUrl("/v1/imports/statements/commit"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  return parseJson<StatementCommitResult>(response);
}

export async function fetchStatementImportHistory(): Promise<StatementImportHistoryResponse> {
  const response = await fetch(buildUrl("/v1/imports/statements"), {
    cache: "no-store"
  });
  return parseJson<StatementImportHistoryResponse>(response);
}

export async function fetchCategoryRules(): Promise<{ items: CategoryRuleResponse[] }> {
  const response = await fetch(buildUrl("/v1/category-rules"), { cache: "no-store" });
  return parseJson<{ items: CategoryRuleResponse[] }>(response);
}

export async function createCategoryRule(
  payload: CategoryRuleInput
): Promise<CategoryRuleResponse> {
  const response = await fetch(buildUrl("/v1/category-rules"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return parseJson<CategoryRuleResponse>(response);
}

export async function updateCategoryRule(
  id: string,
  payload: UpdateCategoryRuleInput
): Promise<CategoryRuleResponse> {
  const response = await fetch(buildUrl(`/v1/category-rules/${id}`), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return parseJson<CategoryRuleResponse>(response);
}

export async function deleteCategoryRule(id: string): Promise<CategoryRuleResponse> {
  const response = await fetch(buildUrl(`/v1/category-rules/${id}`), {
    method: "DELETE"
  });
  return parseJson<CategoryRuleResponse>(response);
}

export async function fetchBudgets(month?: string): Promise<{ items: BudgetResponse[] }> {
  const response = await fetch(buildUrl("/v1/budgets", month ? { month } : undefined), {
    cache: "no-store"
  });
  return parseJson<{ items: BudgetResponse[] }>(response);
}

export async function upsertBudget(month: string, payload: SettingsBudgetUpsert): Promise<BudgetResponse> {
  const response = await fetch(buildUrl(`/v1/budgets/${month}`), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return parseJson<BudgetResponse>(response);
}

export async function fetchBankMappings(): Promise<{ items: BankMappingResponse[] }> {
  const response = await fetch(buildUrl("/v1/bank-mappings"), { cache: "no-store" });
  return parseJson<{ items: BankMappingResponse[] }>(response);
}

export async function createBankMapping(payload: BankMappingInput): Promise<BankMappingResponse> {
  const response = await fetch(buildUrl("/v1/bank-mappings"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return parseJson<BankMappingResponse>(response);
}

export async function updateBankMapping(
  id: string,
  payload: Partial<BankMappingInput>
): Promise<BankMappingResponse> {
  const response = await fetch(buildUrl(`/v1/bank-mappings/${id}`), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return parseJson<BankMappingResponse>(response);
}

export async function fetchIngestionLogs(
  query: IngestionLogsQuery
): Promise<{ items: IngestionLogResponse[]; pagination: { page: number; pageSize: number; total: number; totalPages: number } }> {
  const response = await fetch(buildUrl("/v1/ingestion-logs", query), { cache: "no-store" });
  return parseJson<{
    items: IngestionLogResponse[];
    pagination: { page: number; pageSize: number; total: number; totalPages: number };
  }>(response);
}

export async function fetchWebhookKeys(): Promise<{ items: WebhookKeyResponse[] }> {
  const response = await fetch(buildUrl("/v1/webhook-keys"), { cache: "no-store" });
  return parseJson<{ items: WebhookKeyResponse[] }>(response);
}

export async function createWebhookKey(payload: {
  name: string;
}): Promise<WebhookKeyCreateResponse> {
  const response = await fetch(buildUrl("/v1/webhook-keys"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return parseJson<WebhookKeyCreateResponse>(response);
}

export async function rotateWebhookKey(id: string): Promise<WebhookKeyCreateResponse> {
  const response = await fetch(buildUrl(`/v1/webhook-keys/${id}/rotate`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({})
  });
  return parseJson<WebhookKeyCreateResponse>(response);
}

export async function disableWebhookKey(id: string): Promise<WebhookKeyResponse> {
  const response = await fetch(buildUrl(`/v1/webhook-keys/${id}/disable`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({})
  });
  return parseJson<WebhookKeyResponse>(response);
}
