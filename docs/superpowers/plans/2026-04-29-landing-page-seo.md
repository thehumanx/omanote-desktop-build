# Landing Page SEO Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Improve the omanote landing page metadata, crawlability, structured data, content, accessibility, and technical SEO files while preserving the personal daily workspace positioning.

**Architecture:** Keep the Vite/React landing page in `src/screens/LandingScreen.tsx` and static document metadata in `index.html`. Add root-served SEO files under `public/`. Avoid new internal SEO routes until there is enough useful standalone content for them.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind CSS, static HTML metadata, JSON-LD, XML sitemap.

---

### Task 1: Static Metadata And Structured Data

**Files:**
- Modify: `index.html`

- [x] **Step 1: Update title and core metadata**

Replace the current title and meta description with:

```html
<title>omanote | Opinionated daily workspace</title>
<meta
  name="description"
  content="omanote is a personal daily workspace for capturing notes, todos, bookmarks, events, and small moments before the day disappears."
/>
<meta name="robots" content="index, follow" />
<link rel="canonical" href="https://omanote.iambishistha.com/" />
```

- [x] **Step 2: Update social metadata**

Ensure `index.html` contains:

```html
<meta property="og:title" content="omanote | Capture the day before it disappears" />
<meta
  property="og:description"
  content="A personal daily workspace for capturing notes, todos, bookmarks, events, and small moments in one calm place."
/>
<meta property="og:url" content="https://omanote.iambishistha.com/" />
<meta property="og:type" content="website" />
<meta property="og:image" content="https://omanote.iambishistha.com/og.png" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:alt" content="omanote daily workspace preview" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="omanote | Personal daily workspace" />
<meta
  name="twitter:description"
  content="Capture the day before it disappears with notes, todos, bookmarks, events, and hashtags in one personal daily workspace."
/>
<meta name="twitter:image" content="https://omanote.iambishistha.com/og.png" />
```

- [x] **Step 3: Add JSON-LD**

Add one `<script type="application/ld+json">` block containing an `@graph` with `WebSite`, `SoftwareApplication`, and `FAQPage` entries. FAQ questions and answers must match the visible FAQ content in `LandingScreen.tsx`.

### Task 2: Landing Page Content And Semantics

**Files:**
- Modify: `src/screens/LandingScreen.tsx`

- [x] **Step 1: Update hero copy and CTAs**

Use:
- H1: `Your opinionated daily workspace.`
- Subheading: `omanote gives you one calm place for notes, todos, bookmarks, events, and the small fragments that usually get lost.`
- Primary CTA: `Start your daily workspace`
- Secondary CTA: `See how it works`

- [x] **Step 2: Tighten section copy**

Keep the existing layout but update headings and paragraphs so the page naturally covers:
- personal daily workspace
- day-first capture
- simple note taking app
- notes, todos, bookmarks, events, hashtags, and Explore
- offline capture
- client-side encryption

- [x] **Step 3: Replace FAQ content with concise visible answers**

Use FAQ questions covering:
- what omanote is
- whether it is an AI note-taking app
- what the canvas is
- whether slash commands are required
- how todos, event, notes, and bookmarks relate
- how hashtags and Explore work
- offline support
- privacy and encryption
- passphrase recovery
- data export/import

- [x] **Step 4: Improve accessible labels**

Add descriptive `aria-label` values for icon-only or symbol-heavy preview buttons in the landing mockup where needed. Keep decorative preview avatars with `alt=""`.

### Task 3: Robots And Sitemap

**Files:**
- Create: `public/robots.txt`
- Create: `public/sitemap.xml`

- [x] **Step 1: Add robots.txt**

```txt
User-agent: *
Allow: /

Sitemap: https://omanote.iambishistha.com/sitemap.xml
```

- [x] **Step 2: Add sitemap.xml**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://omanote.iambishistha.com/</loc>
    <lastmod>2026-04-29</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
```

### Task 4: Verification

**Files:**
- Inspect: `index.html`
- Inspect: `src/screens/LandingScreen.tsx`
- Inspect: `public/robots.txt`
- Inspect: `public/sitemap.xml`

- [x] **Step 1: Build**

Run:

```bash
npm run build
```

Expected: build succeeds. If Vite still warns about a large main chunk, report it as a remaining performance task unless code-splitting is implemented in this pass.

- [x] **Step 2: Metadata checks**

Run focused searches:

```bash
rg -n "canonical|robots|application/ld\\+json|og:url|twitter:card|Opinionated daily workspace" index.html
rg -n "Your opinionated daily workspace|Start your daily workspace|FAQ_ITEMS" src/screens/LandingScreen.tsx
```

Expected: required metadata and landing copy are present.

- [x] **Step 3: Static SEO files**

Run:

```bash
sed -n '1,80p' public/robots.txt
sed -n '1,120p' public/sitemap.xml
```

Expected: robots allows crawling and sitemap includes the homepage.
