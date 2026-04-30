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
const API_TIMEOUT_MS = readPositiveInt(process.env.NEXT_PUBLIC_API_TIMEOUT_MS, 10_000);
const API_RETRY_COUNT = readNonNegativeInt(process.env.NEXT_PUBLIC_API_RETRY_COUNT, 2);
const API_RETRY_BASE_DELAY_MS = readPositiveInt(
  process.env.NEXT_PUBLIC_API_RETRY_BASE_DELAY_MS,
  400
);

const TRANSIENT_STATUS_CODES = new Set([502, 503, 504]);

type ApiRequestOptions = {
  retry?: boolean;
  retries?: number;
  timeoutMs?: number;
};

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

function readPositiveInt(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function readNonNegativeInt(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return fallback;
  }
  return parsed;
}

function isRetryableMethod(method?: string): boolean {
  if (!method) {
    return true;
  }
  const upper = method.toUpperCase();
  return upper === "GET" || upper === "HEAD";
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function isLikelyNetworkError(error: unknown): boolean {
  if (error instanceof TypeError) {
    return true;
  }
  return error instanceof Error && /fetch failed/i.test(error.message);
}

function computeBackoffDelay(attempt: number): number {
  return API_RETRY_BASE_DELAY_MS * 2 ** attempt;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function apiRequest(
  path: string,
  init?: RequestInit,
  options?: ApiRequestOptions
): Promise<Response> {
  const method = init?.method?.toUpperCase() ?? "GET";
  const shouldRetry = options?.retry ?? isRetryableMethod(method);
  const retries = shouldRetry ? options?.retries ?? API_RETRY_COUNT : 0;
  const timeoutMs = options?.timeoutMs ?? API_TIMEOUT_MS;
  const url = path.startsWith("http://") || path.startsWith("https://") ? path : buildUrl(path);

  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const externalSignal = init?.signal;
    let externalAbortHandler: (() => void) | undefined;
    if (externalSignal?.aborted) {
      controller.abort();
    } else if (externalSignal) {
      externalAbortHandler = () => controller.abort();
      externalSignal.addEventListener("abort", externalAbortHandler, { once: true });
    }
    const timeout = setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal
      });

      if (attempt < retries && TRANSIENT_STATUS_CODES.has(response.status)) {
        await sleep(computeBackoffDelay(attempt));
        continue;
      }

      return response;
    } catch (error) {
      lastError = error;
      const canRetryError = isAbortError(error) || isLikelyNetworkError(error);
      if (attempt < retries && canRetryError) {
        await sleep(computeBackoffDelay(attempt));
        continue;
      }
      throw error;
    } finally {
      clearTimeout(timeout);
      if (externalSignal && externalAbortHandler) {
        externalSignal.removeEventListener("abort", externalAbortHandler);
      }
    }
  }

  if (lastError instanceof Error) {
    throw lastError;
  }
  throw new Error("API request failed");
}

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
  const response = await apiRequest(buildUrl("/v1/transactions", query), {
    cache: "no-store"
  });
  return parseJson<PaginatedTransactionsResponse>(response);
}

export async function createTransaction(
  payload: CreateTransactionInput
): Promise<TransactionResponse> {
  const response = await apiRequest("/v1/transactions", {
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
  const response = await apiRequest(`/v1/transactions/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  return parseJson<TransactionResponse>(response);
}

export async function ignoreTransaction(id: string): Promise<TransactionResponse> {
  const response = await apiRequest(`/v1/transactions/${id}/ignore`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({})
  });
  return parseJson<TransactionResponse>(response);
}

export async function restoreTransaction(id: string): Promise<TransactionResponse> {
  const response = await apiRequest(`/v1/transactions/${id}/restore`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({})
  });
  return parseJson<TransactionResponse>(response);
}

export async function fetchSummary(month: string): Promise<MoneySummary> {
  const response = await apiRequest(buildUrl("/v1/analytics/summary", { month }), {
    cache: "no-store"
  });
  return parseJson<MoneySummary>(response);
}

export async function fetchCategoryAnalytics(
  month: string
): Promise<AnalyticsList<CategoryAnalyticsItem>> {
  const response = await apiRequest(buildUrl("/v1/analytics/categories", { month }), {
    cache: "no-store"
  });
  return parseJson<AnalyticsList<CategoryAnalyticsItem>>(response);
}

export async function fetchDailyAnalytics(month: string): Promise<AnalyticsList<DailyAnalyticsItem>> {
  const response = await apiRequest(buildUrl("/v1/analytics/daily", { month }), {
    cache: "no-store"
  });
  return parseJson<AnalyticsList<DailyAnalyticsItem>>(response);
}

export async function fetchMerchantAnalytics(
  month: string
): Promise<AnalyticsList<MerchantAnalyticsItem>> {
  const response = await apiRequest(buildUrl("/v1/analytics/merchants", { month }), {
    cache: "no-store"
  });
  return parseJson<AnalyticsList<MerchantAnalyticsItem>>(response);
}

export async function fetchImpactAnalytics(
  month: string
): Promise<AnalyticsList<ImpactTransaction>> {
  const response = await apiRequest(buildUrl("/v1/analytics/impact", { month }), {
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

  const response = await apiRequest("/v1/imports/statements/preview", {
    method: "POST",
    body: form
  });
  return parseJson<StatementPreviewResult>(response);
}

export async function commitStatementImport(
  payload: StatementCommitRequest
): Promise<StatementCommitResult> {
  const response = await apiRequest("/v1/imports/statements/commit", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  return parseJson<StatementCommitResult>(response);
}

export async function fetchStatementImportHistory(): Promise<StatementImportHistoryResponse> {
  const response = await apiRequest("/v1/imports/statements", {
    cache: "no-store"
  });
  return parseJson<StatementImportHistoryResponse>(response);
}

export async function fetchCategoryRules(): Promise<{ items: CategoryRuleResponse[] }> {
  const response = await apiRequest("/v1/category-rules", { cache: "no-store" });
  return parseJson<{ items: CategoryRuleResponse[] }>(response);
}

export async function createCategoryRule(
  payload: CategoryRuleInput
): Promise<CategoryRuleResponse> {
  const response = await apiRequest("/v1/category-rules", {
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
  const response = await apiRequest(`/v1/category-rules/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return parseJson<CategoryRuleResponse>(response);
}

export async function deleteCategoryRule(id: string): Promise<CategoryRuleResponse> {
  const response = await apiRequest(`/v1/category-rules/${id}`, {
    method: "DELETE"
  });
  return parseJson<CategoryRuleResponse>(response);
}

export async function fetchBudgets(month?: string): Promise<{ items: BudgetResponse[] }> {
  const response = await apiRequest(buildUrl("/v1/budgets", month ? { month } : undefined), {
    cache: "no-store"
  });
  return parseJson<{ items: BudgetResponse[] }>(response);
}

export async function upsertBudget(month: string, payload: SettingsBudgetUpsert): Promise<BudgetResponse> {
  const response = await apiRequest(`/v1/budgets/${month}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return parseJson<BudgetResponse>(response);
}

export async function fetchBankMappings(): Promise<{ items: BankMappingResponse[] }> {
  const response = await apiRequest("/v1/bank-mappings", { cache: "no-store" });
  return parseJson<{ items: BankMappingResponse[] }>(response);
}

export async function createBankMapping(payload: BankMappingInput): Promise<BankMappingResponse> {
  const response = await apiRequest("/v1/bank-mappings", {
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
  const response = await apiRequest(`/v1/bank-mappings/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return parseJson<BankMappingResponse>(response);
}

export async function fetchIngestionLogs(
  query: IngestionLogsQuery
): Promise<{ items: IngestionLogResponse[]; pagination: { page: number; pageSize: number; total: number; totalPages: number } }> {
  const response = await apiRequest(buildUrl("/v1/ingestion-logs", query), { cache: "no-store" });
  return parseJson<{
    items: IngestionLogResponse[];
    pagination: { page: number; pageSize: number; total: number; totalPages: number };
  }>(response);
}

export async function fetchWebhookKeys(): Promise<{ items: WebhookKeyResponse[] }> {
  const response = await apiRequest("/v1/webhook-keys", { cache: "no-store" });
  return parseJson<{ items: WebhookKeyResponse[] }>(response);
}

export async function createWebhookKey(payload: {
  name: string;
}): Promise<WebhookKeyCreateResponse> {
  const response = await apiRequest("/v1/webhook-keys", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return parseJson<WebhookKeyCreateResponse>(response);
}

export async function rotateWebhookKey(id: string): Promise<WebhookKeyCreateResponse> {
  const response = await apiRequest(`/v1/webhook-keys/${id}/rotate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({})
  });
  return parseJson<WebhookKeyCreateResponse>(response);
}

export async function disableWebhookKey(id: string): Promise<WebhookKeyResponse> {
  const response = await apiRequest(`/v1/webhook-keys/${id}/disable`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({})
  });
  return parseJson<WebhookKeyResponse>(response);
}
