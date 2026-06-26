import { XMLParser } from "fast-xml-parser";

// Parses RSS 2.0, RSS 1.0 (RDF) and Atom feeds into a common shape.
// Pure module — no Convex imports — so it can be unit tested directly.

export interface ParsedFeedItem {
  guid: string;
  url?: string;
  title: string;
  author?: string;
  summary?: string;
  contentHtml?: string;
  thumbnailUrl?: string;
  publishedAt: number;
}

export interface ParsedFeed {
  title: string;
  description?: string;
  siteUrl?: string;
  items: ParsedFeedItem[];
}

const MAX_ITEMS_PER_PARSE = 100;
const MAX_CONTENT_HTML_BYTES = 64 * 1024;
const MAX_SUMMARY_CHARS = 500;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: true,
  parseTagValue: false,
});

type XmlNode = Record<string, unknown>;

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

// Coerces a parsed XML value into a list of element nodes, dropping scalars.
function nodes(value: unknown): XmlNode[] {
  return asArray(value).filter((n): n is XmlNode => typeof n === "object" && n !== null);
}

// fast-xml-parser yields strings, or objects with #text when attributes exist.
function text(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "string") return value.trim() || undefined;
  if (typeof value === "number") return String(value);
  if (typeof value === "object") {
    const inner = (value as Record<string, unknown>)["#text"];
    return text(inner);
  }
  return undefined;
}

function attr(value: unknown, name: string): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = (value as Record<string, unknown>)[`@_${name}`];
  return typeof raw === "string" && raw.trim() ? raw.trim() : undefined;
}

export function decodeEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (match, hex) => {
      try { return String.fromCodePoint(parseInt(hex, 16)); } catch { return match; }
    })
    .replace(/&#(\d+);/g, (match, dec) => {
      try { return String.fromCodePoint(parseInt(dec, 10)); } catch { return match; }
    })
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

export function stripHtml(value: string): string {
  return decodeEntities(value.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

function toSummary(html: string | undefined): string | undefined {
  if (!html) return undefined;
  const plain = stripHtml(html);
  if (!plain) return undefined;
  return plain.length > MAX_SUMMARY_CHARS ? `${plain.slice(0, MAX_SUMMARY_CHARS - 1)}…` : plain;
}

function capContentHtml(html: string | undefined): string | undefined {
  if (!html) return undefined;
  let result = html;
  while (new TextEncoder().encode(result).length > MAX_CONTENT_HTML_BYTES) {
    result = result.slice(0, Math.floor(result.length * 0.8));
  }
  return result || undefined;
}

function parseDate(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? undefined : ms;
}

function firstImageSrc(html: string | undefined): string | undefined {
  if (!html) return undefined;
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return match ? match[1] : undefined;
}

function mediaThumbnail(node: Record<string, unknown>): string | undefined {
  for (const key of ["media:thumbnail", "media:content"]) {
    for (const media of asArray(node[key])) {
      const url = attr(media, "url");
      if (url) return url;
    }
  }
  const enclosure = asArray(node["enclosure"]).find((e) => {
    const type = attr(e, "type") ?? "";
    return type.startsWith("image/") || !type;
  });
  return enclosure ? attr(enclosure, "url") : undefined;
}

function parseRssItem(node: Record<string, unknown>): ParsedFeedItem | null {
  const link = text(node["link"]);
  const guid = text(node["guid"]) ?? link;
  const title = text(node["title"]) ?? toSummary(text(node["description"]))?.slice(0, 80);
  if (!guid || !title) return null;
  const contentHtml = text(node["content:encoded"]) ?? undefined;
  const description = text(node["description"]);
  return {
    guid,
    url: link,
    title: stripHtml(title),
    author: text(node["dc:creator"]) ?? text(node["author"]),
    summary: toSummary(description ?? contentHtml),
    contentHtml: capContentHtml(contentHtml ?? description),
    thumbnailUrl: mediaThumbnail(node) ?? firstImageSrc(contentHtml) ?? firstImageSrc(description),
    publishedAt: parseDate(text(node["pubDate"]) ?? text(node["dc:date"])) ?? Date.now(),
  };
}

function atomLink(node: Record<string, unknown>, rel: string): string | undefined {
  const links = asArray(node["link"]);
  const match = links.find((l) => (attr(l, "rel") ?? "alternate") === rel);
  return match ? attr(match, "href") : undefined;
}

function parseAtomEntry(node: Record<string, unknown>): ParsedFeedItem | null {
  const url = atomLink(node, "alternate");
  const guid = text(node["id"]) ?? url;
  const title = text(node["title"]);
  if (!guid || !title) return null;
  const contentHtml = text(node["content"]);
  const summary = text(node["summary"]);
  const author = asArray(node["author"])
    .map((a) => text((a as Record<string, unknown>)["name"]) ?? text(a))
    .find(Boolean);
  return {
    guid,
    url,
    title: stripHtml(title),
    author,
    summary: toSummary(summary ?? contentHtml),
    contentHtml: capContentHtml(contentHtml ?? summary),
    thumbnailUrl: mediaThumbnail(node) ?? firstImageSrc(contentHtml),
    publishedAt:
      parseDate(text(node["published"]) ?? text(node["updated"])) ?? Date.now(),
  };
}

export function parseFeed(xml: string): ParsedFeed | null {
  let doc: Record<string, unknown>;
  try {
    doc = parser.parse(xml) as Record<string, unknown>;
  } catch {
    return null;
  }

  const rss = doc["rss"] as Record<string, unknown> | undefined;
  const rdf = doc["rdf:RDF"] as Record<string, unknown> | undefined;
  const atom = doc["feed"] as Record<string, unknown> | undefined;

  if (rss || rdf) {
    const root = rss ?? rdf!;
    const channel = nodes(root["channel"])[0];
    if (!channel) return null;
    const title = text(channel["title"]);
    if (!title) return null;
    // RSS 1.0 puts items beside the channel; RSS 2.0 puts them inside it.
    const itemNodes = [...nodes(channel["item"]), ...nodes(root["item"])];
    const items = itemNodes
      .slice(0, MAX_ITEMS_PER_PARSE)
      .map(parseRssItem)
      .filter((item): item is ParsedFeedItem => item !== null);
    return {
      title: stripHtml(title),
      description: toSummary(text(channel["description"])),
      siteUrl: text(channel["link"]),
      items,
    };
  }

  if (atom) {
    const title = text(atom["title"]);
    if (!title) return null;
    const items = nodes(atom["entry"])
      .slice(0, MAX_ITEMS_PER_PARSE)
      .map(parseAtomEntry)
      .filter((item): item is ParsedFeedItem => item !== null);
    return {
      title: stripHtml(title),
      description: toSummary(text(atom["subtitle"])),
      siteUrl: atomLink(atom, "alternate"),
      items,
    };
  }

  return null;
}

// Finds feed URLs advertised in an HTML page's <link rel="alternate"> tags.
export function extractFeedLinks(html: string, baseUrl: string): string[] {
  const results: string[] = [];
  const linkTags = html.match(/<link\b[^>]*>/gi) ?? [];
  for (const tag of linkTags) {
    if (!/rel=["']?alternate["']?/i.test(tag)) continue;
    if (!/type=["']?application\/(rss|atom)\+xml/i.test(tag)) continue;
    const href = tag.match(/href=["']([^"']+)["']/i)?.[1];
    if (!href) continue;
    try {
      results.push(new URL(decodeEntities(href), baseUrl).toString());
    } catch {
      // Skip malformed URLs.
    }
  }
  return [...new Set(results)];
}

export function looksLikeFeed(contentType: string | null, body: string): boolean {
  if (contentType && /(rss|atom|xml)/i.test(contentType)) {
    return /<(rss|feed|rdf:RDF)[\s>]/i.test(body.slice(0, 2000));
  }
  return /^\s*(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*<(rss|feed|rdf:RDF)[\s>]/i.test(body.slice(0, 2000));
}
