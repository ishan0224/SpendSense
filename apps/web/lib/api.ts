import type {
  CategoryAnalyticsItem,
  CreateTransactionInput,
  DailyAnalyticsItem,
  ImpactTransaction,
  MerchantAnalyticsItem,
  MoneySummary,
  PaginatedTransactionsResponse,
  TransactionResponse,
  UpdateTransactionInput
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
