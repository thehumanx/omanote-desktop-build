# Design System Changelog

Machine-readable log of breaking and deprecating changes to design-system
**tokens, shared primitives, and their props** — not the product. For
user-facing history, see [`CHANGELOG.md`](../../CHANGELOG.md) at the repo
root; that file is written for end users and should stay that way.

This file exists so a coding agent (or a human) can answer "is X still
valid?" by reading one place, without cross-referencing git history or
guessing from a prose changelog. Entries are append-only, most recent first.

## Format

Each entry is one of:

- `Renamed`: old identifier no longer exists; type errors immediately if used.
- `Deprecated`: old identifier still works but is scheduled for removal;
  source carries a `@deprecated` JSDoc tag pointing here.
- `Removed`: old identifier no longer exists and had no direct replacement.

```
## YYYY-MM-DD
- **Renamed** `Component.propName` → `Component.newPropName`. <why>. <migration note>.
```

## 2026-09-12

- **Added** `[data-body-font="serif"] { letter-spacing: -0.02em }`
  (`src/index.css`). Serif *body* text now tracks the same as serif headings,
  which already set `-0.02em`. Previously only the headings tightened, so pure
  Serif mode left the body copy beneath them looking loose. Inherited from the
  attribute host, so it reaches serif text carrying no weight utility; the
  neighbouring `font-weight: 400` rule still enumerates
  `.font-medium`/`.font-semibold`/`.font-bold` because it exists to override
  them. Landing page unaffected — `.font-serif-heading` and
  `.omanote-preview-type` declare their own weight and tracking.
- **Added** `VirtualList` (`src/components/VirtualList.tsx`) — windowed
  rendering for long lists, on `@tanstack/react-virtual`. Renders every row
  unchanged below `threshold` (60). Note that windowing breaks
  adjacent-sibling CSS (`space-y-*`, `divide-y`, `> * + *`) and flow-layout
  animations; see AGENTS.md "Long lists".
- **Added** `HorizontalSwipeOptions` on `useHorizontalSwipe`
  (`src/lib/useHorizontalSwipe.ts`) — `skipWithin` and `skipScrollableX`, both
  off by default so existing call sites are unchanged. Needed by the
  page-wide nav swipe in `AppShell`, which calls `preventDefault` on
  horizontal moves and would otherwise freeze every horizontal scroller
  beneath it.
- **Removed** `IconButton` (`src/components/ui.tsx`). Zero JSX usages anywhere
  in the app; the only mention was a comment in `ProductTour.tsx` explaining
  why it was deliberately *not* used there. A primitive nothing renders is a
  trap — the next person reaches for it, finds it unstyled for their surface,
  and either fights it or quietly forks it. Migration: none needed; style icon
  buttons per surface, as every existing call site already did.
- **Added** `src/lib/editable-target.ts` — `isEditableTarget(eventTarget)` and
  `isEditableElement(element)`. Replaces four local copies (`ToastHost`,
  `useGlobalCaptureShortcut`, `useGlobalNavShortcuts`,
  `useMobileKeyboardState`) that had drifted into **three different
  definitions** of "the user is typing". Now unified on the strictest reading:
  ancestor-walking, `[role="textbox"]`-aware, and `disabled`/`readOnly`-aware.
  Behaviour change: global shortcuts are now correctly suppressed inside
  `[role="textbox"]` and nested contenteditable, where they previously fired
  mid-sentence.
- **Added** `src/lib/share-url.ts` — `buildShareUrl()` and `SHARE_DOMAIN`.
  Replaces four identical local `buildShareUrl` helpers and three separate
  `const DOMAIN = "omanote.com"` declarations.
- **Added** `src/lib/auto-resize.ts` — `autoResizeTextArea()`. Replaces five
  copies of the same grow-to-fit textarea helper.

## 2026-09-10

- **Removed** `.font-serif-heading-smooth` (`src/index.css`). It set
  `font-weight`, `letter-spacing` and `font-optical-sizing` — all three
  identical to `.font-serif-heading` once the landing headings moved to the
  regular weight, and it was never used without that class (all 10 call sites
  paired the two). Migration: drop it; `.font-serif-heading` alone gives the
  same result. Landing heading weight and tracking are now controlled solely
  by `.font-serif-heading`.
- **Removed** the `--app-font-bold-weight`, `--app-font-variation-settings`
  and `--app-font-letter-spacing` writes from `applyTypographySettings`
  (`src/design-system/theme.ts`). None varied with the font setting — each
  re-asserted the same constant on every call. Because they were written as
  *inline* styles on `documentElement`, they beat the `:root` declarations in
  `src/index.css` and made those three variables impossible to change from
  CSS at all. They are now declared only in `:root`, which is where a default
  belongs. `applyTypographySettings` still writes the two font stacks, which
  do vary. Covered by a test in `theme.test.ts` so it can't silently return.
- **Added** `data-heading-font="serif" | "sans"` on the document root, written
  by `applyTypographySettings`. CSS cannot read a custom property in a
  selector, so this is how `src/index.css` targets the serif heading modes —
  see the `[data-heading-font="serif"]` rule that sets heading weight and
  tracking for Solway. Sans mode is deliberately left unstyled by it.
- **Added** `motion.easing.in` (`--motion-easing-in`, `ease-app-in`,
  easeInCubic) alongside the existing `out`/`inOut`/`drawer`. For entrances
  that accelerate away from their starting position; pairs with
  `motion.easing.out` for the return leg.

## 2026-09-09

- **Removed** `DateStripHighlight` (`src/components/ui.tsx`), its
  `.omanote-date-active-highlight` rule in `src/index.css`, and the
  `--motion-duration-date-strip-active` CSS variable that only that rule
  read. No replacement: the primitive was never adopted by any component
  (its only caller was its own test in `ui.test.tsx`), and nothing in the
  app hand-rolls an equivalent, so there was no migration to make. If a
  measured active-day highlight is needed again, `useMeasuredHighlight` +
  `SegmentedHighlight` is the pattern the rest of the app actually uses.

## 2026-09-08

- **Added** `radius.app.badge` (`rounded-app-badge`, 4px) for compact inline
  metadata pills — due-date/time chips, `HashtagChip`, `MentionChip`. These
  previously used a mix of raw `rounded-full`/`rounded-md`/`rounded-lg`, with
  no token of their own.
- **Value changed** `radius.app.card` (`rounded-app-card`): 16px → 8px.
  `radius.app.dialog`/`radius.app.drawer`: 16px → 12px (now equal to
  `radius.app.panel`). No identifiers changed, only the CSS variable values
  in `src/index.css` — existing `rounded-app-card`/`-dialog`/`-drawer` usage
  needs no source changes, but anything that assumed the old pixel values
  (screenshots, visual regression baselines) is stale.
- **Fixed** `cn()` (`src/components/ui.tsx`) previously used bare `twMerge`,
  whose default config doesn't know custom `app-*` radius tokens belong to
  the same conflict group as the built-in Tailwind radius scale. A
  `className="rounded-app-badge ..."` passed to a component with its own
  hardcoded `rounded-app-chip` (e.g. `Badge`) silently failed to override it
  — both classes survived the merge, and Tailwind's stylesheet generation
  order (not JSX class order) decided which one applied. `cn()` now uses
  `extendTailwindMerge` with every `app-*` radius token registered under the
  `rounded` group. If you're chasing a `className` override that "should"
  work but doesn't, check this list before assuming the override syntax is
  wrong.

## 2026-09-04

- **Renamed** `Button.tone` → `Button.variant`. Values unchanged
  (`"default" | "plain" | "ghost" | "soft" | "danger" | "dangerGhost"`).
  `tone` no longer exists on `Button`'s prop type — passing it is a
  compile-time error, not a silent no-op. Renamed to align with the
  `variant` convention used by shadcn/MUI/Chakra, which is what most
  AI-generated code reaches for by default; see `AGENTS.md`.
- **Renamed** `Badge.tone` → `Badge.variant`. Values unchanged
  (`"muted" | "outline" | "success" | "danger"`).
- **Renamed** `Chip.tone` → `Chip.variant`. Values unchanged, shares
  `Badge`'s variant set.
- Not affected by the above, despite the name collision: `Toast.tone`
  (`src/app/types.ts`) and `InsightSeverity.tone`
  (`src/screens/admin/pmf-insights.ts`) — these describe notification/insight
  *severity*, not a component visual style, and were intentionally left as
  `tone`.
