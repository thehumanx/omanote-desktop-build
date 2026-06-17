"use node";

import { isIP } from "node:net";
import { lookup } from "node:dns/promises";
import { action } from "../_generated/server";
import { v } from "convex/values";

const FETCH_TIMEOUT_MS = 7_000; // #4: reduced from 10s to cut cascading timeout cost
const MAX_HTML_BYTES = 5 * 1024 * 1024; // 5 MB

// #8: in-memory TTL cache (ephemeral per Convex instance, still prevents redundant fetches within a warm instance)
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const previewCache = new Map<string, { preview: LinkPreview; expiresAt: number }>();

function getCachedPreview(url: string): LinkPreview | null {
  const cached = previewCache.get(url);
  if (!cached || Date.now() > cached.expiresAt) {
    previewCache.delete(url);
    return null;
  }
  return cached.preview;
}

function setCachedPreview(url: string, preview: LinkPreview): void {
  if (previewCache.size >= 500) {
    const now = Date.now();
    for (const [key, entry] of previewCache) {
      if (now > entry.expiresAt) previewCache.delete(key);
    }
    if (previewCache.size >= 500) {
      // Evict oldest 100 entries by insertion order
      const oldest = [...previewCache.keys()].slice(0, 100);
      for (const key of oldest) previewCache.delete(key);
    }
  }
  previewCache.set(url, { preview, expiresAt: Date.now() + CACHE_TTL_MS });
}

const MAX_REDIRECTS = 5;

const BLOCKED_HOSTNAMES = new Set(["localhost", "localhost.localdomain", "ip6-localhost"]);

function isPrivateIpv4(ip: string): boolean {
  const octets = ip.split(".").map(Number);
  if (octets.length !== 4 || octets.some((o) => !Number.isInteger(o) || o < 0 || o > 255)) {
    return true; // malformed — treat as unsafe
  }
  const [a, b] = octets;
  return (
    a === 0 || // 0.0.0.0/8
    a === 10 || // 10.0.0.0/8
    a === 127 || // loopback
    (a === 100 && b >= 64 && b <= 127) || // 100.64.0.0/10 (CGNAT)
    (a === 169 && b === 254) || // link-local / cloud metadata
    (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12
    (a === 192 && b === 168) // 192.168.0.0/16
  );
}

function isPrivateIp(ip: string): boolean {
  if (isIP(ip) === 4) return isPrivateIpv4(ip);
  const lower = ip.toLowerCase();
  // IPv4-mapped IPv6 (::ffff:a.b.c.d)
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIpv4(mapped[1]);
  if (lower === "::" || lower === "::1") return true; // unspecified / loopback
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // fc00::/7 unique local
  if (/^fe[89ab]/.test(lower)) return true; // fe80::/10 link-local
  return false;
}

/**
 * Rejects URLs whose host is (or resolves to) a private, loopback, or
 * link-local address so the preview fetcher can't be used to probe internal
 * infrastructure (SSRF). Called on the initial URL and on every redirect hop.
 */
async function assertPublicUrl(url: URL): Promise<void> {
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  if (BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith(".local") || hostname.endsWith(".internal")) {
    throw new Error("URL host is not allowed");
  }
  if (isIP(hostname)) {
    if (isPrivateIp(hostname)) throw new Error("URL host is not allowed");
    return;
  }
  let addresses;
  try {
    addresses = await lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new Error("URL host could not be resolved");
  }
  if (addresses.length === 0 || addresses.some((entry) => isPrivateIp(entry.address))) {
    throw new Error("URL host is not allowed");
  }
}

function fetchOnceWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

/**
 * Fetch that validates every hop against private networks. Redirects are
 * followed manually so a public URL can't bounce the request to an internal
 * address.
 */
async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const parsed = new URL(current);
    validateUrl(parsed);
    await assertPublicUrl(parsed);

    const response = await fetchOnceWithTimeout(current, { ...init, redirect: "manual" });
    const location = response.headers.get("location");
    if ([301, 302, 303, 307, 308].includes(response.status) && location) {
      current = new URL(location, current).toString();
      continue;
    }
    return response;
  }
  throw new Error("Too many redirects");
}

function validateUrl(url: URL) {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http and https URLs are supported");
  }
}

type LinkPreview = {
  url: string;
  title: string;
  siteName?: string;
  description?: string;
  thumbnailUrl?: string;
  faviconUrl?: string;
};

type PreviewPatch = Partial<Omit<LinkPreview, "url">> & { url?: string };

type FetchDocumentResult = {
  response: Response;
  html: string;
};

// #3: expanded to handle numeric (decimal and hex) and additional named entities
function decodeHtmlEntities(value: string) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      try { return String.fromCodePoint(parseInt(hex, 16)); } catch { return _; }
    })
    .replace(/&#(\d+);/g, (_, dec) => {
      try { return String.fromCodePoint(parseInt(dec, 10)); } catch { return _; }
    })
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function extractMeta(html: string, key: string) {
  const metaPatterns = [
    new RegExp(`<meta[^>]+property=["']${key}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${key}["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+name=["']${key}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${key}["'][^>]*>`, "i"),
  ];

  for (const pattern of metaPatterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeHtmlEntities(match[1].trim());
  }
  return undefined;
}

// #7: handles both quoted and unquoted attribute values
function extractAttribute(tag: string, name: string) {
  const quotedMatch = tag.match(new RegExp(`${name}=["']([^"']+)["']`, "i"));
  if (quotedMatch?.[1]) return decodeHtmlEntities(quotedMatch[1].trim());
  const unquotedMatch = tag.match(new RegExp(`${name}=([^\\s"'>/][^\\s>]*)`, "i"));
  return unquotedMatch?.[1] ? decodeHtmlEntities(unquotedMatch[1].trim()) : undefined;
}

function extractLinkTags(html: string) {
  const linkPattern = /<link\b[^>]*>/gi;
  return [...html.matchAll(linkPattern)].map((match) => match[0]);
}

function extractLinkHref(html: string, predicate: (rel: string) => boolean) {
  const tags = extractLinkTags(html);
  for (const tag of tags) {
    const rel = extractAttribute(tag, "rel")?.toLowerCase();
    const href = extractAttribute(tag, "href");
    if (!rel || !href) continue;
    if (predicate(rel)) return href;
  }
  return undefined;
}

function parseIconSizes(value?: string) {
  if (!value) return 0;
  let best = 0;
  for (const token of value.split(/\s+/)) {
    const match = token.match(/^(\d+)[xX](\d+)$/);
    if (!match) continue;
    const width = Number.parseInt(match[1], 10);
    const height = Number.parseInt(match[2], 10);
    if (!Number.isFinite(width) || !Number.isFinite(height)) continue;
    best = Math.max(best, Math.min(width, height));
  }
  return best;
}

function scoreFaviconCandidate(tag: string) {
  const rel = extractAttribute(tag, "rel")?.toLowerCase() ?? "";
  const type = extractAttribute(tag, "type")?.toLowerCase() ?? "";
  const href = extractAttribute(tag, "href") ?? "";
  const sizes = parseIconSizes(extractAttribute(tag, "sizes"));

  if (!href) return -Infinity;
  if (!(rel.includes("icon") || rel.includes("apple-touch-icon") || rel.includes("shortcut"))) {
    return -Infinity;
  }

  let score = 0;
  if (rel.includes("apple-touch-icon")) score += 25;
  if (rel.includes("icon")) score += 20;
  if (rel.includes("shortcut")) score += 5;

  if (type.includes("svg")) score += 60;
  else if (type.includes("png")) score += 35;
  else if (type.includes("webp")) score += 30;
  else if (type.includes("jpeg") || type.includes("jpg")) score += 20;
  else if (type.includes("x-icon") || type.includes("icon")) score += 10;

  if (sizes >= 64) score += 40;
  else if (sizes >= 32) score += 30;
  else if (sizes >= 24) score += 15;
  else if (sizes > 0) score += 5;

  if (href.endsWith(".svg")) score += 25;
  else if (href.endsWith(".png")) score += 15;
  else if (href.endsWith(".webp")) score += 10;
  else if (href.endsWith(".ico")) score += 2;

  if (href.includes("logo")) score += 10;
  if (href.includes("icon")) score += 5;

  return score;
}

function chooseBestFaviconUrl(html: string, baseUrl: string) {
  const candidates = extractLinkTags(html)
    .map((tag) => {
      const href = extractAttribute(tag, "href");
      if (!href) return null;
      return {
        href,
        score: scoreFaviconCandidate(tag),
      };
    })
    // #2: filter out null entries AND non-favicon tags (score === -Infinity)
    .filter((candidate): candidate is { href: string; score: number } =>
      candidate !== null && candidate.score !== -Infinity,
    )
    .sort((left, right) => right.score - left.score);

  const bestHref = candidates[0]?.href;
  if (bestHref) {
    return resolveUrl(baseUrl, bestHref);
  }

  return new URL("/favicon.ico", baseUrl).toString();
}

function extractOEmbedLink(html: string) {
  const linkPattern = /<link\b[^>]*>/gi;
  for (const match of html.matchAll(linkPattern)) {
    const tag = match[0];
    const rel = extractAttribute(tag, "rel")?.toLowerCase();
    const type = extractAttribute(tag, "type")?.toLowerCase();
    const href = extractAttribute(tag, "href");
    if (!rel || !type || !href) continue;
    if (rel.includes("alternate") && type === "application/json+oembed") {
      return href;
    }
  }
  return undefined;
}

function resolveUrl(base: string, maybeRelative?: string) {
  if (!maybeRelative) return undefined;
  try {
    return new URL(maybeRelative, base).toString();
  } catch {
    return maybeRelative;
  }
}

function prettyHostname(url: string) {
  return new URL(url).hostname.replace(/^www\./, "");
}

function mergePreview(base: PreviewPatch, patch?: PreviewPatch | null): PreviewPatch {
  if (!patch) return base;
  return {
    ...base,
    ...Object.fromEntries(
      Object.entries(patch).filter(([, value]) => value !== undefined && value !== ""),
    ),
  };
}

function fallbackPreview(url: string): LinkPreview {
  const parsed = new URL(url);
  return {
    url: parsed.toString(),
    title: prettyHostname(url),
    siteName: prettyHostname(url),
    description: undefined,
    thumbnailUrl: undefined,
    faviconUrl: undefined,
  };
}

function isYouTubeUrl(url: URL) {
  return (
    url.hostname === "youtu.be" ||
    url.hostname.endsWith("youtube.com") ||
    url.hostname.endsWith("youtube-nocookie.com")
  );
}

function isSpotifyUrl(url: URL) {
  return url.hostname === "open.spotify.com" || url.hostname === "spotify.link";
}

function isEmptyPreviewField(value?: string) {
  return !value || !value.trim();
}

// #9: well-known favicons for popular services to avoid an extra HTML round-trip
const KNOWN_FAVICONS: Record<string, string> = {
  "youtube.com": "https://www.youtube.com/s/desktop/b72beb2d/img/favicon_144x144.png",
  "youtu.be": "https://www.youtube.com/s/desktop/b72beb2d/img/favicon_144x144.png",
  "youtube-nocookie.com": "https://www.youtube.com/s/desktop/b72beb2d/img/favicon_144x144.png",
  "spotify.com": "https://open.spotifycdn.com/cdn/images/favicon.0f31d2ea.ico",
};

function getKnownFavicon(url: URL): string | undefined {
  const hostname = url.hostname.replace(/^www\./, "");
  for (const [domain, favicon] of Object.entries(KNOWN_FAVICONS)) {
    if (hostname === domain || hostname.endsWith(`.${domain}`)) return favicon;
  }
  return undefined;
}

async function fetchYouTubePreview(url: URL) {
  const oEmbedUrl = new URL("https://www.youtube.com/oembed");
  oEmbedUrl.searchParams.set("url", url.toString());
  oEmbedUrl.searchParams.set("format", "json");

  const response = await fetchWithTimeout(oEmbedUrl.toString(), {
    headers: {
      accept: "application/json",
    },
    redirect: "follow",
  });

  if (!response.ok) return null;

  const data = (await response.json()) as {
    title?: string;
    author_name?: string;
    thumbnail_url?: string;
  };

  return {
    url: url.toString(),
    title: data.title || prettyHostname(url.toString()),
    siteName: prettyHostname(url.toString()),
    description: data.author_name || undefined,
    thumbnailUrl: data.thumbnail_url || undefined,
    faviconUrl: getKnownFavicon(url), // #9: no extra HTML fetch needed
  };
}

async function fetchSpotifyPreview(url: URL) {
  const oEmbedUrl = new URL("https://open.spotify.com/oembed");
  oEmbedUrl.searchParams.set("url", url.toString());

  const response = await fetchWithTimeout(oEmbedUrl.toString(), {
    headers: {
      accept: "application/json",
    },
    redirect: "follow",
  });

  if (!response.ok) return null;

  const data = (await response.json()) as {
    title?: string;
    author_name?: string;
    thumbnail_url?: string;
  };

  return {
    url: url.toString(),
    title: data.title || data.author_name || prettyHostname(url.toString()),
    siteName: prettyHostname(url.toString()),
    description: data.author_name || undefined,
    thumbnailUrl: data.thumbnail_url || undefined,
    faviconUrl: getKnownFavicon(url), // #9: no extra HTML fetch needed
  };
}

async function fetchOEmbedPreview(url: string, oEmbedUrl: string) {
  const response = await fetchWithTimeout(oEmbedUrl, {
    headers: {
      accept: "application/json",
    },
    redirect: "follow",
  });

  if (!response.ok) return null;

  const data = (await response.json()) as {
    title?: string;
    author_name?: string;
    thumbnail_url?: string;
  };

  const faviconUrl = await fetchSiteFavicon(new URL(url)).catch(() => undefined);

  return {
    url,
    title: data.title || data.author_name || prettyHostname(url),
    siteName: prettyHostname(url),
    description: data.author_name || undefined,
    thumbnailUrl: data.thumbnail_url || undefined,
    faviconUrl,
  };
}

type JsonLdNode = Record<string, unknown> & {
  headline?: unknown;
  name?: unknown;
  description?: unknown;
  image?: unknown;
  thumbnailUrl?: unknown;
  url?: unknown;
  contentUrl?: unknown;
  "@type"?: unknown;
  "@graph"?: unknown;
};

function coerceString(value: unknown): string | undefined {
  return typeof value === "string" ? decodeHtmlEntities(value.trim()) : undefined;
}

function pickString(value: unknown): string | undefined {
  if (typeof value === "string") return decodeHtmlEntities(value.trim());
  if (Array.isArray(value)) {
    for (const item of value) {
      const selected: string | undefined = pickString(item);
      if (selected) return selected;
    }
    return undefined;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return (
      coerceString(record.url) ||
      coerceString(record.contentUrl) ||
      coerceString(record["@id"]) ||
      coerceString(record["contentUrl"])
    );
  }
  return undefined;
}

function extractJsonLdPreview(html: string, baseUrl: string): PreviewPatch {
  const scripts = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  let title: string | undefined;
  let description: string | undefined;
  let thumbnailUrl: string | undefined;

  for (const script of scripts) {
    const raw = script[1]?.trim();
    if (!raw) continue;
    const cleaned = raw.replace(/^\s*<!\[CDATA\[/i, "").replace(/\]\]>\s*$/i, "").trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      continue;
    }

    const nodes: JsonLdNode[] = [];
    const enqueue = (node: unknown) => {
      if (!node || typeof node !== "object") return;
      const record = node as JsonLdNode;
      if (Array.isArray(record["@graph"])) {
        for (const entry of record["@graph"] as unknown[]) enqueue(entry);
      }
      nodes.push(record);
    };

    if (Array.isArray(parsed)) {
      for (const entry of parsed) enqueue(entry);
    } else {
      enqueue(parsed);
    }

    for (const node of nodes) {
      title ||= pickString(node.headline) || pickString(node.name);
      description ||= pickString(node.description);
      thumbnailUrl ||= pickString(node.thumbnailUrl) || pickString(node.image);

      if (title && description && thumbnailUrl) break;
    }

    if (title && description && thumbnailUrl) break;
  }

  return {
    title,
    description,
    thumbnailUrl: resolveUrl(baseUrl, thumbnailUrl),
  };
}

function extractMetaPreview(html: string, baseUrl: string): PreviewPatch {
  const siteName = extractMeta(html, "og:site_name");
  const ogTitle = extractMeta(html, "og:title");
  const twitterTitle = extractMeta(html, "twitter:title");
  // pageTitle comes from direct regex — extractMeta is not used here, so decode entities explicitly.
  // #1: ogTitle/twitterTitle/siteName are already decoded by extractMeta; only pageTitle needs decoding here.
  const pageTitle = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim();
  const title =
    ogTitle ||
    twitterTitle ||
    (pageTitle ? decodeHtmlEntities(pageTitle) : undefined) ||
    siteName ||
    prettyHostname(baseUrl);

  // #1: extractMeta already decodes entities — no outer decodeHtmlEntities needed
  const description =
    extractMeta(html, "og:description") ||
    extractMeta(html, "twitter:description") ||
    extractMeta(html, "description") ||
    undefined;

  const thumbnailUrl =
    resolveUrl(baseUrl, extractMeta(html, "og:image")) ??
    resolveUrl(baseUrl, extractMeta(html, "twitter:image")) ??
    resolveUrl(baseUrl, extractMeta(html, "twitter:image:src"));

  const faviconUrl = chooseBestFaviconUrl(html, baseUrl);

  return {
    title,
    siteName,
    description,
    thumbnailUrl,
    faviconUrl,
  };
}

// #6: only trigger AMP/extra fetches when the title itself is missing — description and
// thumbnailUrl being absent is common and legitimate; chasing them via AMP wastes a round-trip.
function isPreviewIncomplete(preview: PreviewPatch) {
  return isEmptyPreviewField(preview.title);
}

// #10: detect bot-challenge responses so they don't pollute preview data
function isBotChallengeResponse(html: string, response: Response): boolean {
  if (response.headers.get("cf-mitigated") === "challenge") return true;
  if (html.includes("cf-browser-verification") && html.includes("Just a moment")) return true;
  if (html.includes("Enable JavaScript and cookies to continue")) return true;
  if (html.includes("Checking if the site connection is secure")) return true;
  if (html.includes("_Incapsula_Resource")) return true;
  return false;
}

async function fetchHtmlDocument(url: string, headersList: Record<string, string>[]): Promise<FetchDocumentResult | null> {
  for (const headers of headersList) {
    try {
      const response = await fetchWithTimeout(url, {
        headers,
        redirect: "follow",
      });

      const contentType = response.headers.get("content-type") ?? "";
      if (!response.ok || !contentType.includes("text/html")) {
        continue;
      }

      const contentLength = response.headers.get("content-length");
      if (contentLength && parseInt(contentLength, 10) > MAX_HTML_BYTES) {
        continue;
      }

      const html = await response.text();
      if (html.length > MAX_HTML_BYTES) {
        continue;
      }

      // #10: treat bot-challenge pages as failed fetches and try next UA profile
      if (isBotChallengeResponse(html, response)) {
        continue;
      }

      return { response, html };
    } catch (error) {
      // #5: only retry the next UA profile on timeouts (AbortError) — a lighter mobile
      // page may load where the desktop one timed out.  For DNS/TLS/network errors
      // (TypeError) the host is unreachable regardless of UA, so fail fast.
      if (error instanceof Error && error.name !== "AbortError") {
        return null;
      }
    }
  }

  return null;
}

async function fetchPreviewFromHtml(url: string, html: string, allowFollowUps = true): Promise<LinkPreview> {
  const basePreview: PreviewPatch = { url };
  let preview = mergePreview(basePreview, extractMetaPreview(html, url));
  preview = mergePreview(preview, extractJsonLdPreview(html, url));

  const discoveredOEmbed = extractOEmbedLink(html);
  if (discoveredOEmbed) {
    try {
      const oEmbedPreview = await fetchOEmbedPreview(url, resolveUrl(url, discoveredOEmbed) ?? discoveredOEmbed);
      preview = mergePreview(preview, oEmbedPreview);
    } catch {
      // Fall through to other metadata sources.
    }
  }

  if (allowFollowUps && isPreviewIncomplete(preview)) {
    const ampHref = extractLinkHref(html, (rel) => rel.split(/\s+/).includes("amphtml"));
    if (ampHref) {
      const ampUrl = resolveUrl(url, ampHref);
      if (ampUrl && ampUrl !== url) {
        const ampDocument = await fetchHtmlDocument(ampUrl, PREVIEW_FETCH_PROFILES);
        if (ampDocument) {
          const ampPreview = await fetchPreviewFromHtml(ampDocument.response.url || ampUrl, ampDocument.html, false);
          preview = mergePreview(preview, ampPreview);
        }
      }
    }
  }

  return {
    url: preview.url || url,
    title: preview.title || prettyHostname(url),
    siteName: preview.siteName || prettyHostname(url),
    description: preview.description || undefined,
    thumbnailUrl: preview.thumbnailUrl || undefined,
    faviconUrl: preview.faviconUrl || undefined,
  };
}

const PREVIEW_FETCH_PROFILES: Record<string, string>[] = [
  {
    "user-agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36",
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "accept-language": "en-US,en;q=0.9",
  },
  {
    "user-agent":
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "accept-language": "en-US,en;q=0.9",
  },
];

async function fetchSiteFavicon(url: URL) {
  const document = await fetchHtmlDocument(url.toString(), PREVIEW_FETCH_PROFILES);
  if (!document) {
    return new URL("/favicon.ico", url).toString();
  }
  return chooseBestFaviconUrl(document.html, document.response.url || url.toString());
}

export const fetchLinkPreview = action({
  args: {
    url: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const parsed = new URL(args.url);
    validateUrl(parsed);
    await assertPublicUrl(parsed);

    // #8: return cached result when available
    const normalizedUrl = parsed.toString();
    const cached = getCachedPreview(normalizedUrl);
    if (cached) return cached;

    const specializedResolvers = [
      {
        match: isYouTubeUrl,
        fetch: fetchYouTubePreview,
      },
      {
        match: isSpotifyUrl,
        fetch: fetchSpotifyPreview,
      },
    ] as const;

    for (const resolver of specializedResolvers) {
      if (!resolver.match(parsed)) continue;
      try {
        const preview = await resolver.fetch(parsed);
        if (preview) {
          setCachedPreview(normalizedUrl, preview); // #8
          return preview;
        }
      } catch {
        // Fall back to the generic HTML pipeline below.
      }
    }

    const document = await fetchHtmlDocument(parsed.toString(), PREVIEW_FETCH_PROFILES);
    if (!document) {
      return fallbackPreview(args.url);
    }
    const preview = await fetchPreviewFromHtml(document.response.url || parsed.toString(), document.html);
    setCachedPreview(normalizedUrl, preview); // #8
    return preview;
  },
});
