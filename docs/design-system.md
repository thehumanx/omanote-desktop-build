# Design System Documentation

## Overview

Omanote's design system is token-driven, with semantic values defined in `src/design-system/tokens.ts` and applied through shared primitives in `src/components/ui.tsx` plus Tailwind aliases in `tailwind.config.ts`.

## Core Sources

- Tokens: `src/design-system/tokens.ts`
- CSS variables + light/dark theme values: `src/index.css`
- Tailwind semantic aliases: `tailwind.config.ts`
- Shared primitives: `src/components/ui.tsx`

## Component Inventory (Used)

This inventory is derived from JSX usage across `src/` and `extension/` (`.tsx/.jsx`, excluding test files), then mapped to each component import source.

### Custom Omanote Components

`App`, `AppProvider`, `AppShell`, `AttachmentLinkPreview`, `AuthProvider`, `AuthScreen`, `Badge`, `BaseModal`, `BookmarkCard`, `BookmarkEditorModal`, `BottomNav`, `Button`, `CanvasDraftBlock`, `CanvasEventBlock`, `CanvasNoteBlock`, `CanvasTodoBlock`, `CategoryActionMenu`, `CategoryCard`, `CategoryRow`, `ChangelogProductTabs`, `CheckboxField`, `Chip`, `CookieNotice`, `DateStripHighlight`, `PageHeader`, `DeviceActivityReporter`, `EmptyState`, `EncryptionGate`, `EncryptionProvider`, `ErrorBoundary`, `EventEditorModal`, `ExportDataPanel`, `ExtensionModal`, `FaviconBadgeSync`, `FolderActionMenu`, `FolderCard`, `FolderRow`, `HashtagChip`, `HashtagCombobox`, `HashtagGraph`, `HashtagPickerDropdown`, `ImportDataPanel`, `Input`, `LandingScreen`, `LoadingSpinner`, `MenuItem`, `MobileSaveButton`, `ModalPortal`, `NavLabelPreview`, `NoteCanvasEditor`, `NoteCard`, `NoteFolderPicker`, `NoteInlineEditor`, `NotificationPermissionBanner`, `OfflineStatusBanner`, `OptionCard`, `Popup`, `RecentItems`, `ReminderMonitor`, `RichTextPreview`, `RichTextToolbar`, `TiptapRichTextToolbar`, `TiptapLinkPopover`, `SaveForm`, `SaveModal`, `SaveShortcutHint`, `SearchResultsList`, `SegmentedHighlight`, `SegmentedItem`, `SegmentedItemLabel`, `SegmentedPill`, `SegmentedShell`, `SettingsView`, `ShareFolderModal`, `ShareNoteFolderModal`, `SuppressHashtagTooltipCtx`, `TextArea`, `ThemeProvider`, `ToastHost`, `TodoCheckmark`, `TodoEditorModal`, `TodoListRow`, `UpdateModal`, `UpdateNotificationBanner`, `UpdateProvider`, `UrlLinkPreview`, `UserSettingsProvider`.

### Library Components

- `lucide-react`: `AlertTriangle`, `ArrowDown`, `ArrowDownUp`, `ArrowRight`, `ArrowUp`, `ArrowUpDown`, `Bell`, `Bold`, `Bookmark`, `Calendar`, `CalendarClock`, `CalendarDays`, `Check`, `CheckCheck`, `CheckCircle2`, `CheckIcon`, `CheckSquare`, `ChevronDown`, `ChevronLeft`, `ChevronRight`, `CircleCheckBig`, `Clock`, `Clock3`, `ClockAlert`, `Code2`, `Compass`, `Copy`, `Download`, `Ellipsis`, `ExternalLink`, `Eye`, `FileJson`, `FileText`, `Folder`, `Globe`, `GripHorizontal`, `GripVertical`, `Info`, `Italic`, `LayoutGrid`, `LayoutList`, `Link` (icon), `Link2`, `List`, `ListOrdered`, `LogOut`, `Pencil`, `Plus`, `Puzzle`, `RefreshCw`, `RotateCcw`, `Search`, `Settings`, `Share2`, `Sparkles`, `Trash2`, `Upload`, `Wifi`, `WifiOff`, `X`, `XCircle`
- `react-day-picker`: `DayPicker`
- `react-router-dom`: `BrowserRouter`, `Link`, `Navigate`, `NavLink`, `Outlet`, `Route`, `Routes`
- `@clerk/react`: `ClerkProvider`, `SignInButton`, `SignUpButton`
- `convex/react-clerk`: `ConvexProviderWithClerk`
- `react`: `Suspense`, `React`

---

## Shadow Tokens

Shadow tokens are defined as CSS custom properties in `src/index.css` under the `:root` (light mode) block.

| Token | Light-mode value | Use |
|---|---|---|
| `--shadow-soft` | `0px 4px 16px 0px rgba(0,0,0,0.08)` | Cards, modals, and floating panels |
| `--shadow-nav` | `0 4px 16px rgba(0,0,0,0.06)` | Bottom navigation bar |
| `--shadow-nav-active` | _(tighter variant)_ | Active/pressed state of nav items |
| `--shadow-drawer` | _(drawer sheet)_ | Bottom drawer / side sheet |
| `--shadow-menu` | _(context menu)_ | Dropdown and context menus |

These are consumed via Tailwind aliases (`shadow-soft`, `shadow-nav`, etc.) defined in `tailwind.config.ts`.

### Mobile shadow constraint

The nav bar sits at `bottom-4` (16px from the screen edge) on mobile. A large Y-offset or blur radius causes the shadow to bleed off the bottom edge of the visible screen, creating an artefact that looks like a thick line at the very bottom. `--shadow-soft` and `--shadow-nav` deliberately use a tight `4px` Y-offset and `16px` blur for this reason. Do not increase these values without checking the result on a small-screen viewport.

---

## Typography System

### Semantic font tokens

The app uses two font-family tokens defined in `src/lib/user-settings.ts`:

| Token | Current font | Stack |
|---|---|---|
| `"sans"` | Lato | `"Lato", ui-sans-serif, system-ui, sans-serif` |
| `"serif"` | Aleo | `"Aleo", Georgia, ui-serif, serif` |

These are the only values the rest of the codebase ever sees. The concrete font name is an implementation detail — it lives in exactly one place.

### How it works

Two CSS custom properties on `:root` drive the global font:

```css
--app-font-family: "Lato", ui-sans-serif, system-ui, sans-serif;
--app-font-variation-settings: normal;
```

`body` in `src/index.css` consumes them:

```css
body {
  font-family: var(--app-font-family);
  font-variation-settings: var(--app-font-variation-settings);
}
```

`applyTypographySettings(fontFamily)` in `src/design-system/theme.ts` is the single function that writes these properties. It is called:

- On app load, from `ThemeContext` (reacts to Convex settings)
- Immediately when the user changes the draft in Settings (live preview before saving)

### Serif behavior

Aleo is a sturdier slab serif with a more grounded, note-taking-friendly feel. The app keeps `font-variation-settings: normal` for the serif stack so the browser uses standard font rendering without any custom axis configuration.

The current Google Fonts request loads `400`, `500`, `600`, and `700`, which lets the app use true medium and semibold Aleo instead of synthesizing those weights.

### Swapping the serif font

Change only `src/design-system/theme.ts` — the `"serif"` branch of `applyTypographySettings` — and update the Google Fonts import in `src/index.css`. No TypeScript types, schema, or UI strings need to change.

### Legacy normalization

Earlier iterations stored specific font names (`"fraunces"`, `"lora"`, `"literata"`, `"source-serif-4"`) in the database. `normalizeUserSettings` in `src/lib/user-settings.ts` maps all of these to `"serif"` on read. The Convex schema retains these literals so existing documents remain valid; writes only accept `"sans"` or `"serif"`.

---

## `SimpleRouteCloseNav` — pointer-events isolation

`BottomNav` renders a floating close button (`SimpleRouteCloseNav`) on Settings and Insights routes instead of the regular tab bar. The nav container is `position: fixed` and spans the full width, which would intercept pointer events across the bottom strip of the page even though it is visually transparent.

The fix uses pointer-events isolation:

```tsx
// Container is pointer-events-none — passes all clicks through
<nav className="... pointer-events-none ...">
  <div className="flex h-full items-center justify-end">
    {/* Only the button itself captures events */}
    <button className="pointer-events-auto ..." onClick={handleClose}>
      <X className="h-4 w-4" />
    </button>
  </div>
</nav>
```

`AppShell` adds bottom padding on these routes to keep page content clear of the floating button:

```tsx
paddingBottom: "calc(var(--omanote-bottom-nav-height, 64px) + 1.5rem)"
```

`--omanote-bottom-nav-height` is written by a `ResizeObserver` in `BottomNav` so the clearance is always accurate regardless of device safe-area insets.

---

## Input Styles — `<Input>` vs bare `<input>`

### When to use `<Input>` (the styled component)

The `<Input>` component from `src/components/ui.tsx` applies the `fieldBase` Tailwind class set, which includes a full border, rounded corners, and a background fill. Use it for standard form fields that need the full bordered treatment — inputs inside modals, settings panels, and standalone forms.

### When to use a bare `<input>`

Several inline fields in the app use a "naked" style: only a bottom border, no background, no rounded corners. Examples include the folder picker input in `NoteFolderPicker`, the bookmark category selector in `CanvasDraftBlock`, and the bookmark URL field in `CanvasDraftBlock`.

The `<Input>` component cannot be overridden to the naked style via `className`. Because `tailwind-merge` is applied inside the component, `fieldBase` wins over any `border-0 border-b` overrides you pass in. The solution is to drop down to a bare HTML `<input>` element and apply only the classes you want:

```tsx
<input
  className="border-b border-app-line bg-transparent outline-none w-full"
  ...
/>
```

**Rule of thumb:** full-border fields in forms and modals → `<Input>`. Inline, bottom-border-only fields that sit beside icons or inside list rows → bare `<input>`.

---

## Artifact Icon Container Sizing

All artifact icon containers (todo checkmark, event clock, bookmark icon) use a standard two-layer sizing scheme:

- **Outer wrapper:** `h-8` (32 px height) — sets the total footprint including any invisible bleed, and vertically centers the visual inside
- **Visual icon/control:** centered inside the wrapper

The motivation is alignment. `TodoCheckmark` at size `md` is 32 px total: the visual checkmark is 20 px, with 6 px of transparent padding on each side (bleed for the ripple animation). The event time chip in saved mode uses an `h-8 flex items-center` wrapper so the chip sits at the same baseline. Keeping all three at a consistent 32 px outer height keeps input rows horizontally aligned across all canvas artifact types.

The gap between the icon container and the text content is `gap-2` (8 px) across all artifact types — canvas todos, canvas events, canvas bookmarks, and the standalone Todos page.

```tsx
// Correct pattern — icon container
<div className="flex h-8 w-8 items-center justify-center flex-shrink-0">
  <SomeIcon className="h-5 w-5" />
</div>

// Event time chip (saved mode) — chip stays its natural size, wrapper provides the 32 px baseline
<div className="flex h-8 flex-none items-center">
  <button className="h-6 ...">10:39 AM</button>
</div>
```

### Canvas Artifact Row Layout

Canvas artifact rows (todos, notes, events, bookmarks in canvas surface) use a **flush-by-default with padded hover** pattern:

- The row container has padding (`px-2 py-1 pl-3`) and equal negative margins (`-ml-3 -mr-2 -my-1`) that cancel each other out. In the default state the content appears flush — no visible indentation.
- On hover or focus-within, the background fills the full padded area, producing a rounded highlight that surrounds the content with comfortable spacing — without any layout shift because the padding never changes.
- The delete/action buttons on each row are absolutely positioned at `right-1 top-1` with a `rounded-full` hover target, consistent across todos, notes, and events.

---

## Folder / Category Icon (`CategoryIconView`)

**Source:** `src/lib/bookmark-category-icon.tsx`

`CategoryIconView` renders the icon for a bookmark category or note folder. It accepts an `icon?: string` prop that can be either an emoji string or a Lucide icon name. When `icon` is `undefined`, the component renders the default `Folder` Lucide icon.

```tsx
<CategoryIconView icon={category.icon} className="h-5 w-5" />
```

Always render `CategoryIconView` unconditionally — do not gate it on `icon !== undefined`. The component handles the missing-icon case internally and always produces visible output. Gating on the prop leads to inconsistent layouts when a folder has no custom icon set.

---

## `PageHeader` — Unified Top Chrome

**Source:** `src/components/layout/PageHeader.tsx`

`PageHeader` is the single top-chrome component used by all five primary screens (Canvas, Todos, Notes, Bookmarks, Event). It replaces the old per-screen title blocks and the former `DateStrip` component.

### Layout (three-slot grid)

```
[ greeting ]   [ date nav · canvas only ]   [ stat → ]
    1fr                  auto                    1fr
```

The container is always `grid grid-cols-[1fr_auto_1fr]` so the center slot sits at the mathematical midpoint regardless of how wide the greeting or stat text is.

### Slot behavior by screen

| Slot | Canvas | All other pages |
|---|---|---|
| Left — greeting | Time-of-day phrase + first name, always visible | Same |
| Center — date | Desktop: `← Today · May 25 →` with chevrons; mobile: `May 25` (no arrows). The date label opens a calendar picker. | Empty (`<div>`) |
| Right — stat | 🔥 N day (canvas streak) | Page-specific weekly count |

### Per-page stats

| Page | `stat` prop | Label example |
|---|---|---|
| Canvas | `canvas_streak` | 🔥 5 day |
| Todos | `todos_done_this_week` | 3 done |
| Notes | `notes_this_week` | 2 notes |
| Bookmarks | `bookmarks_this_week` | 7 saved |
| Event | `events_this_week` | 4 events |

All stats are weekly. The label intentionally omits "this week" for brevity. Clicking the stat navigates to Insights.

### Props

```tsx
interface PageHeaderProps {
  showDateNav?: boolean; // true only on Canvas
  stat: PageStat;        // drives the Convex getDashboardStat query
}
```

### Canvas date picker

Canvas date selection uses `react-day-picker` inside `PageHeader`.

- The picker is opened from the center date label on both desktop and mobile.
- It is portaled to `document.body` with fixed positioning. This is required because the top chrome uses transform-based animation, which otherwise creates a containing context that clips floating descendants.
- Mobile centers the picker in the viewport. Desktop positions it just below the top chrome with `top: calc(var(--omanote-top-chrome-height) + 0.5rem)`.
- The selectable range is capped from the earliest local artifact date through today. For a fresh account with no local artifacts, today is both the minimum and maximum date.
- Month navigation buttons must be styled with `aria-disabled:*` variants, not `disabled:*`, because DayPicker marks unavailable month navigation with `aria-disabled="true"`.
- The picker shell measures its content with `ResizeObserver` and transitions `height` so months with different row counts resize smoothly.

### Greeting

Greeting text is derived from the hour of day, bucketed into `early / morning / afternoon / evening / night`. Each bucket has a large curated phrase pool, and the selected greeting rotates deterministically by date so it changes regularly without feeling random.

On mobile, the greeting is truncated to just the time-of-day emoji and the user's first name (e.g. `☀️ Bibek`) to prevent overflow on narrow viewports. The full phrase (e.g. `☀️ Good morning, Bibek`) is shown on `md` and wider. Both forms are rendered as sibling `<span>` elements — `md:hidden` for the short form and `hidden md:inline` for the full form — so no JavaScript branching is needed.

### Canvas streak

`canvas_streak` queries `canvasArtifacts` for the past 90 days, builds a set of unique `dateKey` values, and counts consecutive days ending at today (or yesterday if today has no entry yet). Returns `🔥 N day` always, including `🔥 0 day` when there is no streak.

---

## Dropdown Portal Pattern

Dropdowns in scroll containers face a clipping problem. When a parent element has `overflow-x: hidden` set, the CSS specification requires the browser to treat `overflow-y` as `auto` as well, even if `overflow-y` is not explicitly set. This makes the element a scroll container, and `position: absolute` children are clipped to its bounds.

The solution used in `CanvasDraftBlock` and `NoteFolderPicker` is to render the dropdown outside the scroll container entirely, via a React portal:

```tsx
import { createPortal } from "react-dom";
import { useLayoutEffect, useRef, useState } from "react";

const anchorRef = useRef<HTMLDivElement>(null);
const [rect, setRect] = useState<DOMRect | null>(null);

useLayoutEffect(() => {
  if (open && anchorRef.current) {
    setRect(anchorRef.current.getBoundingClientRect());
  }
}, [open]);

// The trigger element stays in the normal document flow
<div ref={anchorRef}>...</div>

// The dropdown renders into document.body, positioned with fixed coords
{open && rect && createPortal(
  <div
    style={{
      position: "fixed",
      top: rect.bottom,
      left: rect.left,
      width: rect.width,
    }}
  >
    {/* dropdown content */}
  </div>,
  document.body
)}
```

Key details:
- `useLayoutEffect` (not `useEffect`) reads the anchor's position before the browser paints, so there is no single-frame flash of the dropdown at the wrong position.
- `position: fixed` coordinates come from `getBoundingClientRect()`, which always returns viewport-relative values regardless of scroll position.
- The portal target is `document.body`, which is never a clipping scroll container.
