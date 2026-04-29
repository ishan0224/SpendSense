export type CategoryRule = {
  keywordNormalized: string;
  categoryName: string;
  priority: number;
};

export function resolveCategory(
  merchantNormalized: string,
  rules: CategoryRule[],
  fallback = "Uncategorized"
): string {
  const ordered = [...rules].sort((a, b) => b.priority - a.priority);
  const rule = ordered.find((entry) => merchantNormalized.includes(entry.keywordNormalized));
  return rule?.categoryName ?? fallback;
}
