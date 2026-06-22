# Launch-readiness review (Product Hunt & co.)

Date: 2026-06-12 · Scope: web app + Convex backend + public endpoints, reviewed as-is with no code changes. Findings verified against the live site at omanote.iambishistha.com where possible.

## Verdict

The app is in good shape for a public launch — SEO, share previews, encryption story, auth coverage, and secrets hygiene are all solid. There are **two issues worth fixing before launch day** (missing security headers in production, and an unprotected feedback endpoint that emails your personal inbox), plus a handful of smaller polish items.

---

## 🔴 Fix before launch

> **Status update (2026-06-12):** all findings (#1–#8) have been fixed in the working tree. #1/#2: vercel.json migrated to `rewrites` with the Clerk production domain added to the CSP. #3: feedback endpoint now requires auth, caps message length, rate-limits per user, and escapes all user input in the notification email. #4: counted share views are capped per share per hour regardless of viewer tokens. #5: link-preview fetcher blocks private/loopback/link-local hosts (literal IPs and DNS-resolved) and re-validates every redirect hop. #6: a real `favicon.ico` was added and all notification icons now use the 192px PNG. #7: sitemap lists /privacy and /terms with a fresh lastmod. #8: an explicit `Access-Control-Allow-Origin` header pinned to the canonical origin overrides the wildcard. Pending deploy.

### 1. None of the security headers in `vercel.json` are actually shipping

`vercel.json` defines CSP, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, and `Permissions-Policy` — but the live site serves **none of them** (verified with `curl -D -` on 2026-06-12; only `strict-transport-security` from Vercel itself is present).

Cause: `vercel.json` uses the legacy `routes` array together with `headers`. Vercel does not apply `headers` (or errors) when `routes` is present — the two config styles can't be mixed. The `routes` entries need to be migrated to `rewrites` for the `headers` block to take effect.

File: `vercel.json`

### 2. The CSP, once it does ship, will break production sign-in

The CSP's `script-src` / `connect-src` / `frame-src` only allow `clerk.com` and `*.clerk.accounts.dev` (Clerk's **dev** instance domains). The production Clerk publishable key points the frontend API at `clerk.omanote.iambishistha.com`, which is not covered by `'self'` (different origin) and not in the list.

Today this is masked by finding #1 — the CSP never reaches the browser. The moment #1 is fixed naively, **sign-in breaks in production**. Add `https://clerk.omanote.iambishistha.com` to `script-src`, `connect-src`, and `frame-src` in the same change.

File: `vercel.json`

### 3. Feedback endpoint: unauthenticated, unlimited, and emails your inbox

`feedback.submit` (`convex/feedback.ts:5`) is a public Convex mutation with:

- **No auth requirement** — anyone who finds the Convex deployment URL can call it directly, no app needed.
- **No rate limiting** — a loop can insert unlimited rows and fire unlimited emails.
- **No length cap** — `message` is unbounded (the client form at `src/components/FeedbackModal.tsx` doesn't cap it either).
- **Every call sends a Resend email to `namaste@iambishistha.com`** — this turns the endpoint into a spam cannon aimed at your personal inbox (and your Resend quota/reputation).
- **HTML injection into the email** — `message`, `email` (as `sender`), and `userAgent` are interpolated into the email HTML unescaped (`convex/feedback.ts:56–74`). An attacker can inject arbitrary HTML/links into mail you implicitly trust ("from my own app"), a credible phishing vector.

A Product Hunt launch is exactly when bots and curious users probe these endpoints. Suggested mitigations (any subset): require auth or at least cap message length and escape HTML; add a simple per-user/per-time rate limit; batch/digest emails instead of one per submission.

---

## 🟡 Worth fixing soon (not launch blockers)

### 4. Share view counts are trivially inflatable

`recordShareView` (`convex/sharedFolders.ts:181`) deduplicates views per `viewerToken` with a 6-hour window, but the token is client-supplied — a script can mint a new token per request and inflate counts without bound. Cosmetic metric, but if you ever surface "X views" publicly it's gameable.

### 5. Link preview fetcher has no private-network guard (SSRF)

`fetchLinkPreview` (`convex/actions/linkPreview.ts:613`) requires auth and restricts to http/https, but will fetch any URL — including private/internal IPs and link-local addresses — from Convex's infrastructure, following redirects. Blast radius is limited (Convex's network, response only partially reflected as preview metadata), but a hostname/IP denylist (RFC 1918, 169.254.0.0/16, localhost) on the initial URL *and* after redirects would close it.

### 6. `/favicon.ico` serves the SPA's HTML

There is no `favicon.ico` in `public/`, so the SPA fallback serves `index.html` as `text/html` at that path (verified live). Two consequences: crawlers/legacy clients that request `/favicon.ico` get HTML, and the push-notification service worker (`public/sw.js`) uses `/favicon.ico` as its **default notification icon**, which will render broken. Add a real `favicon.ico` or change the sw.js default to an existing PNG.

### 7. Sitemap only lists the homepage

`public/sitemap.xml` contains a single URL with `lastmod` 2026-04-29. `/privacy` and `/terms` are indexable, linked pages and should be listed; refresh `lastmod` for launch.

### 8. `access-control-allow-origin: *` on document responses

The live site sends `access-control-allow-origin: *` on the HTML document. Harmless for a static SPA today, but it's broader than needed and worth removing while touching the headers config (#1).

---

## ✅ What looks good (launch assets you can lean on)

- **SEO/social is genuinely launch-ready**: `index.html` has canonical URL, robots meta, full OpenGraph + Twitter cards, a 1200×630 `og.png` (serving live), and structured data (WebSite + SoftwareApplication + a 10-question FAQPage) — better than most launches.
- **Share links unfurl properly**: `api/s/[shareCode].ts` injects per-share OG titles server-side, escapes all injected values, and hardcodes the origin instead of trusting the Host header.
- **Backend auth coverage is consistent**: every user-data module (notes, todos, bookmarks, canvas, events, hashtags, rss, settings, devices, encryption keys) checks identity via `requireUserId`; the only intentionally public functions are share lookups and feedback (#3).
- **Public share data model is sound**: shared folders serve owner-pushed plaintext snapshots, so E2E-encrypted content is never decryptable server-side.
- **Reader XSS is handled**: RSS article HTML goes through DOMPurify with an `afterSanitizeAttributes` hook before `dangerouslySetInnerHTML`.
- **Secrets hygiene is clean**: no keys in the repo; only `.env.example` is tracked; `.env.local` / `.env.production` are gitignored and contain only public client-side values.
- **App polish basics are present**: 404 route, top-level ErrorBoundary, privacy + terms pages (live, HTTP 200), PWA manifest + full icon set, account data deletion (`convex/account.ts`), desktop sign-in tokens are auth-gated and expire in 300 s.
- **RSS paid gating is safely off** (`RSS_GATING_ENABLED = false` in `convex/plans.ts`) — free users get the full reader at launch, no half-wired paywall to trip over.
