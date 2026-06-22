import { parseFeed, type ParsedFeed } from "../../convex/lib/rssParser";

const PROXY_URL = "https://omanote-rss-proxy.iambishistha.workers.dev";
const FETCH_TIMEOUT_MS = 15_000;
const MAX_BODY_BYTES = 5 * 1024 * 1024;

export class RssFetchError extends Error {
  constructor(
    message: string,
    public code: "network" | "parse" | "unknown",
  ) {
    super(message);
    this.name = "RssFetchError";
  }
}

/**
 * Fetches and parses an RSS/Atom feed via the CORS proxy.
 * @param feedUrl - The URL of the RSS/Atom feed
 * @returns Parsed feed with title, description, and items
 */
export async function fetchRssFeed(feedUrl: string): Promise<ParsedFeed> {
  if (!feedUrl?.trim()) {
    throw new RssFetchError("Feed URL is required", "unknown");
  }

  const trimmedUrl = feedUrl.trim();
  const proxyUrl = `${PROXY_URL}/proxy?url=${encodeURIComponent(trimmedUrl)}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(proxyUrl, { signal: controller.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new RssFetchError("Request timed out", "network");
    }
    throw new RssFetchError(
      `Network error: ${error instanceof Error ? error.message : "Unknown error"}`,
      "network",
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new RssFetchError(
      `HTTP ${response.status}: ${response.statusText}`,
      "network",
    );
  }

  let xml: string;
  try {
    const contentLength = Number(response.headers.get("content-length"));
    if (!isNaN(contentLength) && contentLength > MAX_BODY_BYTES) {
      throw new RssFetchError(
        `Response too large (${(contentLength / 1024 / 1024).toFixed(1)}MB)`,
        "network",
      );
    }

    const reader = response.body?.getReader();
    if (!reader) {
      xml = await response.text();
    } else {
      const decoder = new TextDecoder();
      let result = "";
      let received = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        received += value.byteLength;
        result += decoder.decode(value, { stream: true });
        if (received > MAX_BODY_BYTES) {
          await reader.cancel();
          throw new RssFetchError(
            `Response too large (${(received / 1024 / 1024).toFixed(1)}MB)`,
            "network",
          );
        }
      }
      xml = result + decoder.decode();
    }
  } catch (error) {
    if (error instanceof RssFetchError) throw error;
    throw new RssFetchError(
      `Failed to read response: ${error instanceof Error ? error.message : "Unknown error"}`,
      "network",
    );
  }

  const feed = parseFeed(xml);
  if (!feed) {
    throw new RssFetchError("Failed to parse RSS/Atom feed", "parse");
  }

  return feed;
}

/**
 * Fetches a feed and returns it with metadata for display.
 */
export async function fetchFeedForDisplay(feedUrl: string) {
  const feed = await fetchRssFeed(feedUrl);
  return {
    feedUrl,
    title: feed.title,
    description: feed.description,
    siteUrl: feed.siteUrl,
    itemCount: feed.items.length,
    items: feed.items,
  };
}
