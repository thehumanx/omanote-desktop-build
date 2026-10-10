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

## 2026-10-10

- **Added** `color.brandCtaTintThemed` — the pale brand tint that follows the
  theme (`light-dark()`: brand green mixed 22% into the surface in dark). Use
  it, not `brandCtaTint`, on anything that can render dark; the onboarding
  "connected" pills and the profile menu's version row had a light tint with
  white text in dark mode. `brandCtaTint` stays for always-light surfaces.
- **Added** `BrandLogo` (`src/components/BrandLogo.tsx`) — use it instead of
  `<img src="/logo.svg">`. Dark mode shows `/logo-dark.svg` (white wordmark);
  pinned-light public pages keep the green one.
- **Added** `.omanote-menu-enter` / `.omanote-menu-exit` (index.css) for
  popover menus: scale from 0.96 plus fade, from the trigger's corner
  (`origin-*`), 200ms in, 150ms out. `useExitGhost` now plays a non-fixed
  overlay's copy inside its own parent (`spawnExitGhost`'s new `container`
  argument), so absolutely placed menus can use it.
- **Changed** `StorageUsageStat` takes `usage` from its parent instead of
  subscribing itself, and counts share thumbnails like Settings > Storage.

## 2026-10-09

- **Added** `BaseModal.entrance` (default `true`) — BaseModal now fades and
  scales in on its own; a modal that runs its own entrance passes
  `entrance={false}` (FeedbackModal, UpdateModal, FounderNoteModal do).
  Every BaseModal, `MobileEditDrawer` and the profile drawer also animate out
  through `useExitGhost` (`src/lib/exit-ghost.ts`) — callers unchanged.
- **Added** `EmptyState.pending` — renders an empty, same-height placeholder
  instead of the message while the view's data is still loading. Pass the
  screen's `isCanvasContentLoading`.
- **Changed** `--z-app-toast` 50 → 95: above dialogs (90) and drawers (81),
  below popovers (100). `ToastHost` is now portalled to `<body>`.
- **Changed** Tailwind's default `transition` duration/easing and the bare
  `ease-out` / `ease-in` / `ease-in-out` utilities now resolve to the motion
  tokens (`--motion-duration-fast`, `--motion-easing-*`). Same class names,
  the app's curve.
- **Moved** `writeTabs` from `layout/BottomNav.tsx` to `layout/navTabs.ts`, so
  the landing page no longer imports BottomNav (and with it AppProvider).
- **Added** `FolderSheet.onClosed` (`src/components/folder-gallery/FolderSheet.tsx`)
  — fires when the panel finishes sliding out, for a host that unmounts it.
- **Added** `TodosScreen` / `NotesScreen` / `BookmarksScreen` `overlay` prop
  (`FolderSheetOverlay`, `src/components/folder-gallery/folder-sheet-overlay.ts`)
  — renders only that folder's sheet over another route; the canvas folder
  tabs use it through `useCanvasFolderSheet`.
- **Added** `useTopChrome(node, enabled)` — `enabled: false` leaves the bar
  alone, for a screen mounted as an overlay.
- **Added** `FolderLabel.nameClassName` and `CanvasDayArtifacts.onOpenFolder`.

## 2026-10-04

- **Added** `RemoteImage` (`src/components/RemoteImage.tsx`) — an `<img>` for
  third-party sources (bookmark thumbnails and favicons, feed artwork, link
  previews) that always sets `referrerPolicy="no-referrer"` and lazy loading.
  Use it for any `src` that isn't ours; `src/components/RemoteImage.test.tsx`
  fails on a dynamic-source `<img>` that isn't listed as an own asset.
- **Changed** `BaseModal` now renders `role="dialog"` and `aria-modal`, and
  requires a `label` prop (the dialog's accessible name). Optional `role`
  (`"alertdialog"` for confirms) and `describedBy`.

## 2026-10-03

- **Added** `SceneBackdrop variant="footer"` — a screen-tall scene anchored to
  the public site footer, fading upward at z-index -1. The page wrapper must be
  `isolate`, or its fill paints over the scene.

## 2026-10-01

- **Added** `.app-scene-page` — marks a full-screen view that sits on a
  `z-app-*` layer only for stacking (PageScreen): it is excluded from the
  overlay fill and the frost, so the scene stays visible behind it.
- **Added** `runPageTransition()` (`src/lib/page-transition.ts`) and
  `PageOpenLink` — open/close a page with the `canvas-expand` view
  transition; cards mark themselves with `data-page-card-id`.
- **Changed** `folderColorStyle().surface` is now a `color-mix()` of
  `--folder-<key>-surface` scaled by `--app-folder-opacity` (1 normally, ~0.6
  light / ~0.55 dark under a scene). Use it only as a CSS colour value.
- **Changed** under a scene, an open `TodoCheckmark` box is a translucent
  surface (35%) with an ink border instead of a white gradient tile.
- **Changed** `app-line` / `app-line-strong` (border, divide, bg, text) take a
  scene override: with `<html data-scene>` they are ink at
  `--app-line-opacity` (~8% light, ~10% dark) / `--app-line-strong-opacity`
  (~16% / ~20%) instead of solid grey. Inline styles reading
  `--color-line` directly should use `--app-line-rgb` with the same fallback.
- **Changed** with a light-theme scene on, `bg-app-surface` / `-raised` /
  `-muted` are a smoked-glass ink wash (`--app-wash-rgb`, `--app-wash-surface`
  ~3%, `--app-wash-muted` ~5%) instead of translucent white; hover is ~9%.
  Overlays (`role` dialog/menu/listbox, `z-app-*`, `.app-overlay`) and
  `.app-frost` chrome reset the wash and stay light. Dark theme unchanged.
- **Changed** under a scene, `bg-app-surface-hover` is a faint ink wash
  (`--app-hover-rgb` / `--app-hover-opacity`, ~6% light, ~8% dark) rather than
  a solid surface, and `.app-frost` chrome (top bar, nav buttons) drops to the
  lower `--app-chrome-opacity`. Card fills went to ~0.58 light / ~0.55 dark.
- **Added** `useScrollEdgeFade(ref)` (`src/hooks/`) — the top/bottom edge
  fade for scroll containers; each edge fades only while content lies past
  it. Used by History and the folder galleries.
- **Added** `SceneBackdrop` + `SCENES` (`src/components/scene/`) — the six
  background scenes (morning, afternoon, clouds, meadow, evening, night);
  `variant="page"` is AppShell's fixed backdrop, `"thumb"` a static preview.
  Palettes are `[data-scene-palette]` CSS variables in `index.css`.
- **Added** `bg-app-backdrop` — a page fill that clears while a scene is on.
  Use it (not `bg-app-canvas`) for full-page fills inside the app.
- **Changed** `bg-app-surface`, `-raised`, `-muted`, `-hover` (background
  utilities only) multiply by `--app-surface-opacity`: `1` normally, ~0.7 while
  `<html data-scene>` is set; anything floating — `role` dialog/menu/listbox,
  every `z-app-*` overlay token (drawer, menu, dialog, modal, popover,
  tooltip, toast, floating, linked-artifact sheet) — uses the higher
  `--app-overlay-opacity`. A floating surface without one of those tokens
  must add `.app-overlay`. Text/border utilities are unchanged.
- **Added** `.app-frost` — backdrop blur, active only under a scene. Reserved
  for fixed chrome (top bar, bottom nav); `z-app-drawer` panels get it too.
- **Removed** `usePageBackdrop`, `.omanote-gallery-backdrop/-dots` and the
  `canvasDotGrid` setting. `.omanote-canvas-grid` stays for onboarding, the
  survey and the landing preview only.

## 2026-09-30

- **Renamed** `FolderGalleryCard.menu` / `GalleryFolder.menu` (a ⋯ menu node)
  → `actions: FolderCardActions` (`{ pinned, onEdit, onShare, onDelete,
  onTogglePin }`), rendered as a hover icon strip (edit, share, delete, pin)
  overlaid on the tab row, desktop only; a pinned folder's pin stays visible.
  **Added** `FolderGalleryCard.count` / `FolderTab.count` (pill beside the
  name). `FOLDER_CARD_ROW_LIMIT` 5 → 3; the card body is a fixed `h-40`,
  bordered in the tab's folder colour. `folderStatusMeta` no longer emits Pinned.
- **Renamed** `FolderDrawerHeader.actions`: `onShare`/`onRename`/`onDelete`
  plus required `pinned` and optional `onTogglePin`; the header is two rows
  (back + icon actions, overflowing into ⋯ by measured width; then icon + name).
- **Added** `BottomNav.trailing` (AppShell passes the profile avatar) and
  `ProfileMenuButton.placement` (`"below"` | `"above"`). The top bar no longer
  renders the avatar; screens put their actions there via `useTopChrome`.

- **Added** `FolderTab` (`src/components/folder-gallery/`) — a gallery card's
  folder tab: icon button (opens the icon picker; mousedown + preventDefault
  so a rename input keeps focus), name button, or the inline rename/new-folder
  input via `editing`.
- **Added** `FolderSheet` — the folder view as a sheet over its gallery:
  full-screen drawer on phones, a 640px right side peek (`desktop`) in the
  desktop gallery. Esc (except from text entry), backdrop, focus in/contain/restore.
- **Added** `FolderDrawerHeader.backStyle` (`"back"` | `"close"`).
- **Renamed** `FolderGalleryCard` props: `stats: string[]` → `meta: FolderMeta[]`
  (`emphasis` for Public/Pinned), `visual` → `footerAside`; `pinned`/`shared`
  badges removed (now `folderStatusMeta` entries); tab controls `onIconClick`,
  `editing`, `menu` added.
- **Added** `FolderGalleryCard` + `FolderGallery`
  (`src/components/folder-gallery/`) — the content gallery for Todos, Notes
  and Bookmarks: one card per folder with a type-supplied body
  (`TodoFolderPreview`, `NoteFolderPreview`, `BookmarkFolderPreview`) and a
  `·`-separated stats footer. The card is deliberately not a `<button>` (rows
  hold checkboxes and links); the folder name is the button. Per-folder
  numbers come from `src/lib/folder-stats.ts`, never from ad-hoc loops.
- **Removed** `TodoFolderCard` (`TodoFolderRow.tsx`), `FolderCard`
  (`NoteFolderNav.tsx`), `CategoryCard` (`BookmarkCategoryNav.tsx`) and
  `FolderNavCard` (`FolderNav.tsx`) — the icon-tile folder "gallery" they
  rendered is replaced by `FolderGalleryCard`.

## 2026-09-25

- **Added** `AppLoadingScreen` (`src/components/ui.tsx`) — the one
  full-screen loading state: canvas background, then the looping
  `OmanoteMark` fading in after 400ms (`.omanote-loading-delayed`), so a fast
  load shows nothing. Neutral (`text-app-ink-faint`), not brand green. Replaces the "Loading…" text in `EncryptionGate` and
  `OnboardingWizard`, `LocalCacheGate`'s blank div, `RootRoute`'s `null` and
  `App`'s `RouteLoadingFallback`. Use it for any new full-screen wait; keep
  `LoadingSpinner` for inline ones. Screens that follow each other within
  250ms continue one animation (fade and draw offset by the elapsed time),
  since boot passes through several gates that each render their own.
- **Added** `--omanote-mark-delay` on `OmanoteMark`'s `loop` variant — a
  negative value resumes the loop mid-cycle.
- **Removed** every `tracking-*` utility from sans text (94 uses: uppercase
  labels, eyebrows and badges with `tracking-wide`/`wider`/`widest`/
  `[0.16em]`–`[0.2em]`, and headings with `tracking-tight`/`[-0.02em]`/
  `[-0.025em]`), plus the extension popup's `letter-spacing` declarations.
  Sans text is at 0 tracking everywhere; serif keeps its `-0.02em`
  (`docs/design-system.md`, "Sans text is never tracked"). Don't add
  tracking to sans text.
- **Changed** `.omanote-canvas-grid` dots draw at 62.5% strength —
  `rgb(var(--color-canvas-dot) / 0.625)` (halved, then raised by a quarter). The `--color-canvas-dot` token itself
  is unchanged, so anything else using it keeps its colour.

## 2026-09-23

- **Added** an inline `backgroundColor` from `folderColorStyle(color).surface`
  on every folder **icon chip**: `FolderNavRow`, `FolderNavCard`,
  `TodoFolderRow`, `TodoFolderCard` and `PageScreen`'s header icon button.
  Until now the palette key only reached the glyph (`CategoryIconView`'s
  `color`), so a coloured folder looked untinted in the rails — the chip is
  the folder's visible "container". The style is inline because the key is
  runtime-only, and it **deliberately overrides** the
  `bg-app-surface-muted` / `bg-app-surface` hover-and-selected classes on the
  same element, so the tint survives selection and hover. If you add a new
  folder chip, tint it the same way.
- **Added** `FOLDER_FIELD_WIDTH` (`src/components/FolderCombobox.tsx`) — the
  shared width for a folder/category field, `w-[220px] min-w-[180px]
  max-w-full`. The three call sites had disagreed: the note picker was a fixed
  220px while the composer's todo and bookmark fields were `w-full`, so the
  same control spanned the whole sheet in two of three modes and visibly
  resized when the mode changed. Use it rather than restating a width.
- **Added** `icon` / `color` on `FolderFieldIcon` — the leading glyph in a
  folder field now shows the *selected* folder's own icon or emoji when it has
  one, and otherwise keeps the animated `FolderIcon` tinted with the folder's
  colour (`FolderIcon` draws in `currentColor`, so the wrapper's `color` is
  all it takes). Same split as `FolderLabel`: custom glyphs are static,
  because an emoji has no open state. Callers resolve the folder with the
  combobox's `exactMatch`, which is null mid-typing — the generic folder while
  the field doesn't yet name anything is correct, not a gap.
- **Added** `icon` / `color` on `FolderComboboxSource` and
  `FolderComboboxItem`, and the matching glyph on each row in
  `FolderComboboxOptions` — `CategoryIconView` for an existing folder,
  `FolderPlus` for the create row. Sources that reshape their folders before
  passing them in (`NoteFolderPicker` dedupes by name) have to carry the two
  fields through or the menu silently falls back to the generic folder.
- **Changed** `PageCard`'s border `border-app-surface-muted` →
  `border-app-line`, matching `CanvasContinueWriting`'s card. The same page
  renders through both (today's day feed and the "Continue" row), so two
  different borders read as two different kinds of card. The muted border
  dated from the day the surrounding artifact blocks were bordered to match
  the folder tab's fill; those borders are gone.
- **Changed** dark-mode `--shadow-artifact-group` from
  `0 -3px 10px rgba(0,0,0,0.32)` to `0 -3px 5px -3px rgba(0,0,0,0.45)`. It had
  kept the geometry of the original light value after that light value was
  hand-tightened, so dark mode was drawing a much wider halo than light. Dark
  shadows here move the **alpha only** and keep light's geometry — see
  `--shadow-drawer` (0.14 → 0.42), `--shadow-menu` (0.12 → 0.38),
  `--shadow-dialog` (0.18 → 0.48).
- **Added** the palette `surface` and `ink` on the page-card icon chips in
  `PageCard` and `CanvasContinueWriting`. The `ink` tint is applied to the
  `FileText` fallback as well as to a chosen icon, because most pages never
  pick one — without it a coloured page would be the one coloured thing in the
  app that doesn't look coloured.
- **Added** `color` on `TodosScreen`'s mobile drawer header glyph, which was
  the last `CategoryIconView` on a folder that still dropped it. Bare glyphs
  with no chip behind them (this one, and the Notes/Bookmarks drawer headers)
  take the ink tint only — there is no container there to fill.

## 2026-09-22

- **Added** `src/lib/folder-color.ts` — `FOLDER_COLORS` (rose, amber,
  emerald, teal, sky, indigo, violet, pink), `isFolderColor`, and
  `folderColorStyle(key)` → `{ surface, ink }`. Both returned values are
  `var(--folder-<key>-surface|ink)` strings, resolved in `src/index.css` for
  light and dark. **Store the key, never a hex value** — that is what lets the
  colour follow the theme and what keeps the design-token audit satisfied,
  since no component ever names a colour. `src/lib/folder-color.test.ts`
  guards parity between the table and the CSS.
- **Added** `--folder-{rose,amber,emerald,teal,sky,indigo,violet,pink}-`
  `{surface,ink}` (16 properties) in `src/index.css`, defined twice — light
  and dark.
- **Added** `CategoryIconView.color` (`src/lib/bookmark-category-icon.tsx`) —
  applies `{ color: palette.ink }` to lucide glyphs and the `Folder`
  fallback, and **never to an emoji**. An emoji carries its own colour.
- **Added** `BookmarkCategoryIconPicker.currentColor` / `.onSelectColor`.
  Both optional: when `onSelectColor` is absent the swatch row is hidden
  entirely, which is how `ReaderScreen`'s `rssCategories` (no `color` column)
  reuse the picker unchanged. Clicking the active swatch clears the colour, as
  does the ✕ swatch. The picker stays open after a colour pick on purpose.
- **Added** `color` on `FolderNavRow` / `FolderNavCard` (and their
  `NoteFolderNav` / `BookmarkCategoryNav` wrappers), `FolderLabel`, and
  `CanvasDayArtifacts`.
- **Added** `--shadow-artifact-group` (`shadow-artifact-group`) — the upward
  shadow separating a canvas artifact group from the feed background, drawn
  so it passes behind the folder tab.
- **Changed** `CanvasDayArtifacts.categoryNameById: Map<string, string>` →
  `categoryById: Map<string, BookmarkCategory>`. A name is no longer enough;
  the group header needs the icon and colour too.
- **Changed** `NoteCanvasEditor.folderName` / `.folders` /
  `.onFolderNameChange` are now optional, so the editor can render with no
  folder control at all.
- **Removed** `CanvasArtifactItem.edited` and `.editLabel`
  (`src/app/reducer.ts`), the `EditedBadge` in `CanvasDayArtifacts`, and the
  helpers `isCompletionOnlyUpdate`, `describeCanvasEdit`, `wasEditedOn`. The
  day feed no longer resurfaces edited artifacts — `editLabel` was added
  2026-09-19 and lived three days. See docs/canvas-feature-handoff.md for why
  it cannot be rebuilt on `updatedAt`. `sortAt` keeps its name.
- **Removed** `NoteInlineEditor.hideFolderPicker`. It became dead when note
  editing lost folder editing entirely; the forwarded `NoteCanvasEditor` now
  hardcodes it. `NoteCanvasEditor`'s own `hideFolderPicker` is still live.
- **Removed** `SaveShortcutHint` from `NoteCanvasEditor`'s footer row.
- **Unchanged (recorded so it isn't retried blind)** light-mode
  `--color-canvas` briefly went to `250 250 250` and was put back to
  `255 255 255` the same day. The reasoning was that canvas and
  `--color-surface` are both pure white in light mode, so the canvas feed's
  new folder-group cards had no contrast to sit against. It was reverted once
  those cards grew a muted folder tab, which carries the separation on its
  own. Two things to know before dimming it again: the token is app-wide and
  includes `.public-page`, so the landing page moves with it; and dark mode
  already separates the two (`9 9 11` vs `24 24 27`) and needs no change.
- **Added** `FolderIcon` (`src/components/FolderIcon.tsx`) — the animated
  open/closed folder. Stacks Lucide's `Folder` and `FolderOpen` and
  crossfades between them; driven solely by its `open` prop.

  It shipped for a few hours as a hand-drawn SVG with a hinged flap, on the
  theory that two paths sharing geometry would give a truer motion than a
  crossfade. That was a mistake worth recording: the geometry rendered
  wrong at small sizes, it needed `transform-box: view-box` gymnastics to
  hinge at all, and it bought nothing — at the 16px this icon actually
  renders at, a crossfade is indistinguishable from a morph. **Don't
  hand-draw this icon again.** Lottie was weighed as the alternative and
  rejected: a player instance per glyph is heavy for something that repeats
  down a list, and Lottie bakes its colors in, so it can't inherit
  `currentColor` and would break dark mode and the ink tokens.
- **Added** `FolderLabel` (`src/components/FolderLabel.tsx`) — the quiet
  icon + name line naming an artifact's folder.
- **Added** `FolderFieldIcon` (`src/components/FolderCombobox.tsx`) — the
  leading glyph for a folder/category input. Absolutely positioned like
  `FolderComboboxClearButton`; pair it with `pl-6 pr-7` on the input.

## 2026-09-19

- **Added** `useFolderCombobox` / `FolderComboboxOptions` /
  `FolderComboboxClearButton` (`src/components/FolderCombobox.tsx`) — the
  type-to-filter folder picker, previously copy-pasted three times. Its
  `handleKeyDown` returns whether it consumed the event; call it *before*
  any save handling, or an open menu loses Enter to the save.
- **Added** `handleNoteEnterKey` (`src/lib/tiptap-note.ts`) — Enter behaviour
  for both note editors. Lists claim Enter before the save check.
- **Added** `FolderNavGroups` (`src/components/FolderNav.tsx`), re-exported as
  `FolderGroups` / `CategoryGroups`. Renders a folder list as its pinned
  group then the rest; `wrap` supplies the container so it serves both the
  desktop rail and the mobile grid.
- **Added** `isPinned` / `onTogglePin` on `FolderNavActionMenu` and
  `TodoFolderActionMenu`. Omit `onTogglePin` for rows with no folder behind
  them ("Uncategorized", "Saved", "Synced from GCal").
- **Added** `PagePinButton` (`src/components/page/PagePinButton.tsx`) — the
  canvas pin toggle shared by `PageCard` and `CanvasContinueWriting`.
- **Added** `DraftStatusChip` + `DraftPersistence`
  (`src/components/DraftStatus.tsx`) — the composer's "Not saved, Enter to
  save" indicator. States: `empty` (renders nothing), `pending`, `stored`.
  `compact` drops the second half for narrow slots.
- **Added** `DrawerHeaderRow.status` — centre-slot node, replaces the drag
  grip when present.
- **Added** `CanvasDraftBlock.onDraftStatusChange`, reporting the above.
- **Added** `CanvasArtifactItem.editLabel` (`src/app/reducer.ts`) — what the
  day feed's Edited badge says. Read off the activity log, not inferred.
- **Renamed** `PageCard.onToggleStar` → `onTogglePin`, and its second
  callback argument `starred` → `pinned`. Icon `Star` → `Pin`.
- **Renamed** `PageItem.starred` → `PageItem.pinned`, and the
  `page/set-flags` action's `starred` field → `pinned`. The Convex column
  was renamed to match; `pages.starred` survives as a deprecated field
  until `migrations/backfillPagePinned` has run on every deployment.
- **Renamed** `isSaveShortcutEvent(event, setting)` → `isSaveKeyEvent(event)`
  and `isNewlineShortcutEvent(event, setting)` → `isNewlineKeyEvent(event)`.
  Both lost their setting argument.
- **Removed** the `saveShortcut` / `newlineShortcut` settings, their types
  and constant lists, and the conflict resolution in `normalizeUserSettings`
  and `convex/userSettings.ts`. The keymap is fixed: **Enter saves,
  Shift+Enter is a newline.** Their Convex columns survive as deprecated
  until `migrations/clearShortcutSettings` has run on every deployment.
- **Removed** `formatSaveShortcutLabel` and `hasShortcutConflict`; replaced
  `formatSaveShortcutKeyLabel(shortcut, isMac)` with the
  `SAVE_SHORTCUT_KEY_LABEL` constant.
- `SaveShortcutHint` renders a fixed "Press Enter to save".
  `showSaveShortcutHints` survives and got its Settings control back.

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
