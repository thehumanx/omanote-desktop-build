# Landing Page SEO Design

Date: 2026-04-29

## Goal

Improve the omanote landing page so it is crawlable, keyword-focused, conversion-friendly, and technically clear to search engines while keeping the product positioned as a personal daily workspace.

The page should not describe omanote as an AI note-taking app or use "free" as a primary promise.

## Positioning

Primary positioning: omanote is a personal daily workspace for capturing the day before it disappears.

Primary keyword: opinionated daily workspace.

Natural supporting keywords:
- personal daily workspace
- daily workspace app
- personal note taking app
- simple note taking app
- daily notes and todos
- personal productivity workspace
- capture notes todos and bookmarks
- day-first notes app

## Homepage Copy Structure

The homepage will keep the existing layout and app mockup, but tighten the copy around day-first capture and personal organization.

Hero:
- H1: "Your opinionated daily workspace."
- Subheading: "omanote gives you one calm place for notes, todos, bookmarks, events, and the small fragments that usually get lost."
- Primary CTA: "Start your daily workspace"
- Secondary CTA: "See how it works"

Sections:
- Why omanote: explain the omakase-inspired idea and the benefit of an already-structured workspace.
- What is inside: Canvas, Todos, Notes, Bookmarks, Event, and Explore.
- How capture works: plain text, slash commands, pasted links, and hashtags.
- Privacy and reliability: offline capture, client-side encryption, passphrase, and recovery key.
- FAQ: concise questions based on the existing landing content.
- Closing CTA: invite the visitor to open omanote as their daily workspace.

The final visible landing copy should be useful and natural, roughly 500-900 words, with the primary keyword used in the H1, intro copy, one H2, and meta title.

## Metadata

Static metadata will live in `index.html` because this Vite app currently does not use server rendering or a head manager.

Required values:
- Title: `omanote | Opinionated daily workspace`
- Meta description: `omanote is a personal daily workspace for capturing notes, todos, bookmarks, events, and small moments before the day disappears.`
- Canonical: `https://omanote.iambishistha.com/`
- Robots: `index, follow`
- Open Graph title: `omanote | Capture the day before it disappears`
- Open Graph description: a natural summary of the personal daily workspace.
- Open Graph URL: `https://omanote.iambishistha.com/`
- Open Graph type: `website`
- Twitter card: `summary_large_image`
- Twitter title and description aligned with Open Graph.

## Structured Data

Add valid JSON-LD in `index.html`:
- `WebSite`
- `SoftwareApplication`
- `FAQPage`

The FAQ schema must match questions and answers visible on the landing page.

## Technical SEO Files

Add static files in `public/` so Vite copies them to the deployment root:
- `robots.txt`
- `sitemap.xml`

The sitemap will include the homepage only. Placeholder SEO routes will not be added in this pass because thin pages would add little value until they have genuinely useful standalone content.

## Accessibility and Semantics

Keep one H1 on the landing page. Use semantic `section`, `nav`, `main`, and `footer` landmarks. Tighten CTA labels so they describe the action. Keep decorative avatars hidden from assistive tech and provide descriptive alt text for the product logo.

## Performance

Preserve existing lightweight static assets. Improve landing performance where low-risk by avoiding unnecessary above-the-fold layout shifts and preparing the app for code-splitting if straightforward. The build warning for the large main bundle should be reported if not fully resolved in this pass.

## Verification

Run:
- `npm run build`

Also manually inspect:
- `index.html` metadata and JSON-LD validity
- `public/robots.txt`
- `public/sitemap.xml`
- landing page heading structure and visible FAQ consistency
