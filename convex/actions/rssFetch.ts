"use node";

import { ConvexError, v } from "convex/values";
import { action, internalAction } from "../_generated/server";
import type { ActionCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { requireUserId } from "../utils";
import { extractFeedLinks, looksLikeFeed, parseFeed, type ParsedFeed } from "../lib/rssParser";

const FETCH_TIMEOUT_MS = 10_000;
const MAX_BODY_BYTES = 5 * 1024 * 1024;
const USER_AGENT = "omanote-rss/1.0 (+https://omanote.iambishistha.com)";

function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  return fetch(url, {
    redirect: "follow",
    headers: { "user-agent": USER_AGENT, accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, text/html;q=0.8, */*;q=0.5" },
    signal: controller.signal,
  }).finally(() => clearTimeout(timer));
}

function validateUrl(raw: string): URL {
  const url = new URL(raw);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http and https URLs are supported");
  }
  return url;
}

async function readBody(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return response.text();
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
      break;
    }
  }
  return result + decoder.decode();
}

function defaultFavicon(siteUrl: string | undefined, feedUrl: string): string {
  try {
    const origin = new URL(siteUrl ?? feedUrl).origin;
    return `${origin}/favicon.ico`;
  } catch {
    return "";
  }
}

interface FeedFetchResult {
  feedUrl: string;
  feed: ParsedFeed;
  etag?: string;
  lastModified?: string;
}

async function fetchAndParseFeed(feedUrl: string, headers?: Record<string, string>): Promise<FeedFetchResult | "not_modified"> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(feedUrl, {
      redirect: "follow",
      headers: {
        "user-agent": USER_AGENT,
        accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*;q=0.5",
        ...headers,
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
  if (response.status === 304) return "not_modified";
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const body = await readBody(response);
  const feed = parseFeed(body);
  if (!feed) throw new Error("Could not parse feed");
  return {
    feedUrl: response.url || feedUrl,
    feed,
    etag: response.headers.get("etag") ?? undefined,
    lastModified: response.headers.get("last-modified") ?? undefined,
  };
}

// Thrown codes are mapped to friendly copy on the client — never shown raw.
function discoveryError(code: "bad_url" | "unreachable" | "no_feed_found" | "unparseable"): never {
  throw new ConvexError({ code });
}

// Common feed locations to probe when the homepage is unreachable (some sites,
// e.g. Medium, serve feeds to bots but 403 their HTML pages) or advertises no
// feed links. Each hit must parse as a feed, so error pages can't false-positive.
const WELL_KNOWN_FEED_PATHS = ["/feed", "/rss", "/feed.xml", "/atom.xml", "/rss.xml", "/index.xml"];

async function probeWellKnownFeeds(origin: string): Promise<FeedFetchResult | null> {
  for (const path of WELL_KNOWN_FEED_PATHS) {
    try {
      const result = await fetchAndParseFeed(`${origin}${path}`);
      if (result !== "not_modified") return result;
    } catch {
      // Try the next path.
    }
  }
  return null;
}

// Given any URL (a feed URL or a site homepage), finds and previews the feed.
export const discoverFeed = action({
  args: { url: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    requireUserId(identity);

    const raw = args.url.trim();
    const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    let url: URL;
    try {
      url = validateUrl(withScheme);
    } catch {
      discoveryError("bad_url");
    }

    let response: Response | null = null;
    try {
      response = await fetchWithTimeout(url.toString());
    } catch {
      response = null;
    }

    let feedUrl: string;
    let feed: ParsedFeed | null;

    if (!response || !response.ok) {
      const probed = await probeWellKnownFeeds(url.origin);
      if (!probed) discoveryError("unreachable");
      feedUrl = probed.feedUrl;
      feed = probed.feed;
    } else {
      const body = await readBody(response);
      const contentType = response.headers.get("content-type");

      if (looksLikeFeed(contentType, body)) {
        feedUrl = response.url || url.toString();
        feed = parseFeed(body);
      } else {
        const pageUrl = response.url || url.toString();
        const candidates = extractFeedLinks(body, pageUrl);
        let result: FeedFetchResult | null = null;
        for (const candidate of candidates) {
          try {
            const fetched = await fetchAndParseFeed(candidate);
            if (fetched !== "not_modified") {
              result = fetched;
              break;
            }
          } catch {
            // Try the next advertised feed link.
          }
        }
        if (!result) result = await probeWellKnownFeeds(new URL(pageUrl).origin);
        if (!result) discoveryError(candidates.length ? "unparseable" : "no_feed_found");
        feedUrl = result.feedUrl;
        feed = result.feed;
      }
    }

    if (!feed) discoveryError("unparseable");

    return {
      feedUrl,
      title: feed.title,
      description: feed.description,
      siteUrl: feed.siteUrl,
      faviconUrl: defaultFavicon(feed.siteUrl, feedUrl) || undefined,
      itemCount: feed.items.length,
      latestItemTitle: feed.items[0]?.title,
    };
  },
});

async function refreshOneFeed(ctx: ActionCtx, feedId: Id<"rssFeeds">): Promise<void> {
  const feedDoc: Doc<"rssFeeds"> | null = await ctx.runQuery(internal.rss.getFeedForFetch, { feedId });
  if (!feedDoc || !feedDoc.active) return;

  const conditionalHeaders: Record<string, string> = {};
  if (feedDoc.etag) conditionalHeaders["if-none-match"] = feedDoc.etag;
  if (feedDoc.lastModified) conditionalHeaders["if-modified-since"] = feedDoc.lastModified;

  try {
    const result = await fetchAndParseFeed(feedDoc.url, conditionalHeaders);
    if (result === "not_modified") {
      await ctx.runMutation(internal.rss.markFetchResult, { feedId, status: "not_modified" });
      return;
    }
    await ctx.runMutation(internal.rss.applyFetchSuccess, {
      feedId,
      etag: result.etag,
      lastModified: result.lastModified,
      title: result.feed.title,
      description: result.feed.description,
      siteUrl: result.feed.siteUrl,
      faviconUrl: defaultFavicon(result.feed.siteUrl, feedDoc.url) || undefined,
      items: result.feed.items,
    });
  } catch (error) {
    await ctx.runMutation(internal.rss.markFetchResult, {
      feedId,
      status: "error",
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// User-triggered refresh of a single subscribed feed, e.g. from the empty
// state when the subscribe-time fetch failed. Runs synchronously so the
// client can sync as soon as it resolves.
export const refreshFeedNow = action({
  args: { feedId: v.id("rssFeeds") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    const subscribed = await ctx.runQuery(internal.rss.userIsSubscribed, { userId, feedId: args.feedId });
    if (!subscribed) throw new ConvexError({ code: "not_subscribed" });
    await refreshOneFeed(ctx, args.feedId);
    return null;
  },
});

export const refreshFeed = internalAction({
  args: { feedId: v.id("rssFeeds") },
  handler: async (ctx, args) => {
    await refreshOneFeed(ctx, args.feedId);
    return null;
  },
});

