# Client-Side RSS Fetching

## Problem

Convex data egress from RSS feed fetching costs ~120 MB/day. The cron job fetches RSS feeds server-side, causing outbound HTTP traffic that counts against the Convex plan.

## Solution

Move RSS fetching to the client side using a Cloudflare Worker as a CORS proxy. Feeds are fetched only when the user opens them, eliminating background egress.

## Architecture

```
Browser ──[fetch via Worker]──> RSS Server
   │
   └──[parse XML client-side]──> Mutation ──> Convex DB
```

## Components

### 1. Cloudflare Worker (CORS Proxy)

**Location:** `workers/rss-proxy/src/index.ts`

Simple worker that:
- Accepts GET requests with `url` query parameter
- Fetches the target URL
- Returns response with CORS headers

**Deployed URL:** `omanote-proxy.<your-subdomain>.workers.dev/proxy?url=<rss-feed-url>`

### 2. Client-Side Fetcher

**Location:** `src/lib/rssFetcher.ts`

Functions:
- `fetchRssFeed(feedUrl: string): Promise<ParsedFeed>` - Fetches and parses RSS/Atom feed
- Uses existing `parseFeed()` from `convex/lib/rssParser.ts`
- Handles errors gracefully (network, parse, CORS)

### 3. Updated UI Flow

**Modified:** `src/screens/reader/ReaderScreen.tsx`

- `fetchFeedNow()` calls client-side fetcher instead of Convex action
- Fetches only the selected feed
- Stores items via mutation

## Files to Create

1. `workers/rss-proxy/wrangler.toml` - Cloudflare Worker config
2. `workers/rss-proxy/src/index.ts` - Worker implementation
3. `src/lib/rssFetcher.ts` - Client-side RSS fetcher

## Files to Modify

1. `convex/crons.ts` - Remove cron job
2. `src/screens/reader/ReaderScreen.tsx` - Use client-side fetcher

## Files to Keep (no changes)

- `convex/lib/rssParser.ts` - Reused by client-side fetcher
- `convex/actions/rssFetch.ts` - Keep `discoverFeed` action (used during subscription)
- `convex/rss.ts` - Keep mutations for storing items

## Migration

1. Deploy Cloudflare Worker
2. Add `VITE_RSS_PROXY_URL` env var
3. Update ReaderScreen to use client fetcher
4. Remove cron job

## Tradeoffs

| Aspect | Before (Server-side) | After (Client-side) |
|--------|---------------------|---------------------|
| Background updates | Yes (every 2 hours) | No (only when open) |
| Convex egress | ~15 MB/day | 0 |
| CORS issues | None (server-side) | Solved by Worker |
| Offline support | Limited | Better (can cache) |
| Setup complexity | None | Worker deployment |
