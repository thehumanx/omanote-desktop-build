import { normalizeLinkUrl } from "@omanote/shared";

const LINK_TOKEN_PATTERN =
  /\[[^\]]+\]\(([^)]+)\)|(https?:\/\/[^\s<]+|(?:www\.)?[a-z0-9.-]+\.[a-z]{2,}(?:\/[^\s<]*)?)/gi;

function countChar(value: string, char: string) {
  let count = 0;
  for (const token of value) {
    if (token === char) count += 1;
  }
  return count;
}

function stripLinkPunctuation(value: string) {
  let next = value.trim();

  while (next && (next.startsWith("(") || next.startsWith("[") || next.startsWith("<") || next.startsWith('"') || next.startsWith("'"))) {
    next = next.slice(1).trimStart();
  }

  while (next && /[.,!?;:'"]$/.test(next)) {
    next = next.slice(0, -1).trimEnd();
  }

  while (next.endsWith(")") && countChar(next, ")") > countChar(next, "(")) {
    next = next.slice(0, -1).trimEnd();
  }

  while (next.endsWith("]") && countChar(next, "]") > countChar(next, "[")) {
    next = next.slice(0, -1).trimEnd();
  }

  while (next.endsWith(">")) {
    next = next.slice(0, -1).trimEnd();
  }

  return next;
}

function toPreviewableUrl(candidate: string) {
  const cleaned = stripLinkPunctuation(candidate);
  if (!cleaned) return undefined;
  const normalized = normalizeLinkUrl(cleaned);
  if (!normalized) return undefined;
  if (!normalized.startsWith("http://") && !normalized.startsWith("https://")) return undefined;
  return normalized;
}

export function extractFirstPreviewableUrl(...values: Array<string | undefined | null>) {
  for (const value of values) {
    if (!value) continue;
    for (const match of value.matchAll(LINK_TOKEN_PATTERN)) {
      const candidate = match[1] ?? match[2];
      if (!candidate) continue;
      if (match[2]) {
        const tokenStart = match.index ?? -1;
        if (tokenStart > 0) {
          const previousChar = value[tokenStart - 1];
          if (previousChar === "@") continue;
        }
      }
      const normalized = toPreviewableUrl(candidate);
      if (normalized) return normalized;
    }
  }
  return undefined;
}

export function extractAllPreviewableUrls(...values: Array<string | undefined | null>): string[] {
  const seen = new Set<string>();
  const results: string[] = [];
  for (const value of values) {
    if (!value) continue;
    for (const match of value.matchAll(LINK_TOKEN_PATTERN)) {
      const candidate = match[1] ?? match[2];
      if (!candidate) continue;
      if (match[2]) {
        const tokenStart = match.index ?? -1;
        if (tokenStart > 0) {
          const previousChar = value[tokenStart - 1];
          if (previousChar === "@") continue;
        }
      }
      const normalized = toPreviewableUrl(candidate);
      if (normalized && !seen.has(normalized)) {
        seen.add(normalized);
        results.push(normalized);
      }
    }
  }
  return results;
}
