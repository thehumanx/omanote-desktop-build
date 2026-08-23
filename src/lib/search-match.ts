const MIN_QUERY_LENGTH = 3;

/** Returns a lowercased, trimmed query once it's long enough to search with, otherwise null. */
export function normalizeSearchQuery(raw: string): string | null {
  const trimmed = raw.trim().toLowerCase();
  return trimmed.length >= MIN_QUERY_LENGTH ? trimmed : null;
}

/** Case-insensitive substring match against any of the given fields. */
export function matchesQuery(query: string, ...values: Array<string | undefined>): boolean {
  return values.some((value) => value?.toLowerCase().includes(query));
}
