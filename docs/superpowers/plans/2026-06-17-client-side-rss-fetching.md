# Client-Side RSS Fetching Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move RSS feed fetching from Convex server-side cron to client-side browser fetching via a Cloudflare Worker CORS proxy, eliminating Convex data egress.

**Architecture:** Browser fetches RSS feeds through a Cloudflare Worker proxy (solving CORS), parses XML client-side using existing parser, and stores items via Convex mutations. No background cron job.

**Tech Stack:** Cloudflare Workers (Wrangler), TypeScript, existing `fast-xml-parser` via `convex/lib/rssParser.ts`

---

## File Structure

| File | Purpose |
|------|---------|
| `workers/rss-proxy/wrangler.toml` | Cloudflare Worker configuration |
| `workers/rss-proxy/src/index.ts` | CORS proxy Worker implementation |
| `workers/rss-proxy/package.json` | Worker dependencies |
| `src/lib/rssFetcher.ts` | Client-side RSS fetcher using Worker |
| `src/screens/reader/ReaderScreen.tsx` | Update to use client-side fetcher |
| `convex/rss.ts` | Add applyClientFetch mutation |
| `convex/crons.ts` | Remove cron job |

---

### Task 1: Create Cloudflare Worker CORS Proxy

**Files:**
- Create: `workers/rss-proxy/package.json`
- Create: `workers/rss-proxy/wrangler.toml`
- Create: `workers/rss-proxy/src/index.ts`

- [ ] **Step 1: Create Worker directory and package.json**

```bash
mkdir -p workers/rss-proxy/src
```

```json
// workers/rss-proxy/package.json
{
  "name": "omanote-rss-proxy",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20240512.0",
    "typescript": "^5.4.0",
    "wrangler": "^3.57.0"
  }
}
```

- [ ] **Step 2: Create wrangler.toml**

```toml
# workers/rss-proxy/wrangler.toml
name = "omanote-rss-proxy"
main = "src/index.ts"
compatibility_date = "2024-05-01"

[env]
WORKERS_RSSTOJSON_API = "https://api.rss2json.com"
```

- [ ] **Step 3: Create Worker implementation**

```typescript
// workers/rss-proxy/src/index.ts
export interface Env {
  // Add any environment variables here if needed
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    // Only allow GET requests
    if (request.method !== "GET") {
      return new Response("Method not allowed", { status: 405 });
    }

    const url = new URL(request.url);

    // Only handle /proxy path
    if (url.pathname !== "/proxy") {
      return new Response("Not found", { status: 404 });
    }

    const targetUrl = url.searchParams.get("url");
    if (!targetUrl) {
      return new Response("Missing url parameter", { status: 400 });
    }

    // Validate URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(targetUrl);
    } catch {
      return new Response("Invalid URL", { status: 400 });
    }

    // Only allow http/https
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return new Response("Only http/https URLs allowed", { status: 400 });
    }

    try {
      // Fetch the target URL
      const response = await fetch(parsedUrl.toString(), {
        headers: {
          "User-Agent": "omanote-rss/1.0 (+https://omanote.iambishistha.com)",
          Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
        },
        redirect: "follow",
      });

      // Create response with CORS headers
      const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": response.headers.get("Content-Type") || "application/xml",
      };

      return new Response(response.body, {
        status: response.status,
        headers: corsHeaders,
      });
    } catch (error) {
      return new Response("Failed to fetch target URL", { status: 502 });
    }
  },
};
```

- [ ] **Step 4: Create tsconfig.json for Worker**

```json
// workers/rss-proxy/tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "types": ["@cloudflare/workers-types"],
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 5: Test Worker locally**

```bash
cd workers/rss-proxy && npm install && npm run dev
```

Test: `curl "http://localhost:8787/proxy?url=https://hnrss.org/frontpage"`
Expected: Returns RSS XML with CORS headers

- [ ] **Step 6: Commit Worker**

```bash
git add workers/rss-proxy/
git commit -m "feat: add Cloudflare Worker CORS proxy for RSS fetching"
```

---

### Task 2: Create Client-Side RSS Fetcher

**Files:**
- Create: `src/lib/rssFetcher.ts`

- [ ] **Step 1: Create client-side RSS fetcher**

```typescript
// src/lib/rssFetcher.ts
import { parseFeed, type ParsedFeed } from "../../convex/lib/rssParser";

const PROXY_URL = import.meta.env.VITE_RSS_PROXY_URL || "http://localhost:8787";

export class RssFetchError extends Error {
  constructor(
    message: string,
    public code: "network" | "parse" | "cors" | "unknown",
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
  const proxyUrl = `${PROXY_URL}/proxy?url=${encodeURIComponent(feedUrl)}`;

  let response: Response;
  try {
    response = await fetch(proxyUrl);
  } catch (error) {
    throw new RssFetchError(
      `Network error: ${error instanceof Error ? error.message : "Unknown error"}`,
      "network",
    );
  }

  if (!response.ok) {
    throw new RssFetchError(
      `HTTP ${response.status}: ${response.statusText}`,
      response.status === 0 ? "cors" : "network",
    );
  }

  let xml: string;
  try {
    xml = await response.text();
  } catch (error) {
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
```

- [ ] **Step 2: Commit client-side fetcher**

```bash
git add src/lib/rssFetcher.ts
git commit -m "feat: add client-side RSS fetcher via CORS proxy"
```

---

### Task 3: Create Mutation for Storing Client-Fetched Items

**Files:**
- Create: `convex/rss.ts` (add new mutation)

- [ ] **Step 1: Add applyClientFetch mutation to rss.ts**

Read `convex/rss.ts` to find the end of the file, then add:

```typescript
export const applyClientFetch = mutation({
  args: {
    feedId: v.id("rssFeeds"),
    title: v.string(),
    description: v.optional(v.string()),
    siteUrl: v.optional(v.string()),
    items: v.array(
      v.object({
        guid: v.string(),
        url: v.optional(v.string()),
        title: v.string(),
        author: v.optional(v.string()),
        summary: v.optional(v.string()),
        contentHtml: v.optional(v.string()),
        thumbnailUrl: v.optional(v.string()),
        publishedAt: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Unauthorized");

    const feed = await ctx.db.get(args.feedId);
    if (!feed) throw new ConvexError("Feed not found");

    const timestamp = Date.now();

    // Insert new items (skip duplicates)
    let inserted = 0;
    for (const item of args.items) {
      const existing = await ctx.db
        .query("rssItems")
        .withIndex("by_feed_guid", (q) =>
          q.eq("feedId", args.feedId).eq("guid", item.guid),
        )
        .unique();
      if (existing) continue;
      await ctx.db.insert("rssItems", {
        feedId: args.feedId,
        ...item,
        createdAt: timestamp,
      });
      inserted++;
    }

    // Update feed metadata
    await ctx.db.patch(args.feedId, {
      title: args.title,
      description: args.description ?? feed.description,
      siteUrl: args.siteUrl ?? feed.siteUrl,
      lastFetchedAt: timestamp,
      lastFetchStatus: "ok",
      lastFetchError: undefined,
      updatedAt: timestamp,
    });

    return inserted;
  },
});
```

- [ ] **Step 2: Commit new mutation**

```bash
git add convex/rss.ts
git commit -m "feat: add applyClientFetch mutation for client-side RSS fetching"
```

---

### Task 4: Update ReaderScreen to Use Client-Side Fetcher

**Files:**
- Modify: `src/screens/reader/ReaderScreen.tsx:319-329`
- Modify: `src/screens/reader/ReaderScreen.tsx:1962-1979`

- [ ] **Step 1: Add import for client-side fetcher**

Read `src/screens/reader/ReaderScreen.tsx` to find the imports section, then add:

```typescript
import { fetchRssFeed, RssFetchError } from "../lib/rssFetcher";
```

- [ ] **Step 2: Update fetchFeedNow function**

Replace the current `fetchFeedNow` implementation (around line 322-329) with:

```typescript
const fetchFeedNow = async () => {
  if (!selectedFeedId || fetchingFeedNow) return;
  setFetchingFeedNow(true);
  try {
    // Get the feed URL from the subscription
    const subscription = subscriptions?.find(
      (s) => String(s.feedId) === String(selectedFeedId),
    );
    if (!subscription?.feedUrl) return;

    // Fetch and parse via client-side fetcher
    const feed = await fetchRssFeed(subscription.feedUrl);

    // Store items via mutation
    await applyClientFetch({
      feedId: selectedFeedId,
      items: feed.items,
      title: feed.title,
      description: feed.description,
      siteUrl: feed.siteUrl,
    });

    await scheduleSync();
  } catch (error) {
    console.error("Failed to refresh feed:", error);
    // Show user-friendly error
    if (error instanceof RssFetchError) {
      // Handle specific error types
    }
  } finally {
    setFetchingFeedNow(false);
  }
};
```

- [ ] **Step 3: Update discoverFeed to use client-side fetcher**

Replace the `discoverFeed` handler (around line 1962-1979) with:

```typescript
const discoverFeedHandler = async (url: string) => {
  try {
    const result = await fetchFeedForDisplay(url);
    return {
      feedUrl: result.feedUrl,
      title: result.title,
      description: result.description,
      siteUrl: result.siteUrl,
      faviconUrl: undefined, // Can be added later
      itemCount: result.itemCount,
      latestItemTitle: result.items[0]?.title,
    };
  } catch (error) {
    console.error("Failed to discover feed:", error);
    throw error;
  }
};
```

- [ ] **Step 4: Commit updated ReaderScreen**

```bash
git add src/screens/reader/ReaderScreen.tsx
git commit -m "feat: use client-side RSS fetcher in ReaderScreen"
```

---

### Task 5: Remove Cron Job

**Files:**
- Modify: `convex/crons.ts`

- [ ] **Step 1: Remove cron job**

Replace `convex/crons.ts` content with:

```typescript
import { cronJobs } from "convex/server";

const crons = cronJobs();

// RSS feeds are now fetched client-side via Cloudflare Worker proxy.
// No background cron job needed.

export default crons;
```

- [ ] **Step 2: Commit cron removal**

```bash
git add convex/crons.ts
git commit -m "refactor: remove RSS cron job (client-side fetching)"
```

---

### Task 6: Add Environment Variable

**Files:**
- Modify: `.env.local` (or `.env`)

- [ ] **Step 1: Add proxy URL to env**

Add to `.env.local`:

```
VITE_RSS_PROXY_URL=http://localhost:8787
```

For production, update to the deployed Worker URL:

```
VITE_RSS_PROXY_URL=https://omanote-rss-proxy.<your-subdomain>.workers.dev
```

- [ ] **Step 2: Commit env changes**

```bash
git add .env.local
git commit -m "chore: add VITE_RSS_PROXY_URL environment variable"
```

---

### Task 7: Deploy Worker to Cloudflare

**Files:**
- None (deployment step)

- [ ] **Step 1: Install Wrangler CLI (if not installed)**

```bash
npm install -g wrangler
```

- [ ] **Step 2: Login to Cloudflare**

```bash
wrangler login
```

- [ ] **Step 3: Deploy Worker**

```bash
cd workers/rss-proxy && npm run deploy
```

Note the deployed URL from the output.

- [ ] **Step 4: Update production env**

Update `.env.production` or your deployment platform with:

```
VITE_RSS_PROXY_URL=https://omanote-rss-proxy.<your-subdomain>.workers.dev
```

- [ ] **Step 5: Test deployed Worker**

```bash
curl "https://omanote-rss-proxy.<your-subdomain>.workers.dev/proxy?url=https://hnrss.org/frontpage"
```

Expected: Returns RSS XML with CORS headers

---

### Task 8: Verify and Clean Up

**Files:**
- None (verification)

- [ ] **Step 1: Run linter/typecheck**

```bash
npm run lint && npm run typecheck
```

Expected: No errors

- [ ] **Step 2: Test RSS refresh in app**

1. Open the RSS reader screen
2. Select a feed
3. Click refresh
4. Verify feed updates correctly

- [ ] **Step 3: Check Convex dashboard**

After using the app for a few minutes, check the Convex dashboard:
- Data Egress should be 0 for new requests
- Database writes should still work (items being stored)

- [ ] **Step 4: Remove unused imports (if any)**

Check if any imports in `convex/actions/rssFetch.ts` are now unused after removing cron. Clean up if needed.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete client-side RSS fetching migration"
```
