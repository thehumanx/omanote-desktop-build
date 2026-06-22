# Motion Memory

Last updated: 2026-06-14

This file is a local reference for animation, transition, and micro-interaction decisions in omanote. It is meant to help us keep future UI changes consistent and tasteful.

## Current Motion Inventory

### Date strip

- [`src/components/layout/PageHeader.tsx`](/Users/bbk/Codes/omanote/src/components/layout/PageHeader.tsx)
  - Canvas date navigation lives in the shared top chrome. Desktop shows previous/next chevrons plus the full date label; mobile keeps only the compact date label.
  - The date label opens a `react-day-picker` calendar. The calendar is rendered through a `document.body` portal with fixed positioning so it is not clipped by the transformed top chrome.
  - Mobile centers the calendar in the viewport; desktop positions it just below the top chrome.
  - Calendar navigation is capped from the earliest local artifact date through today. Unavailable month chevrons are muted via `aria-disabled:*` classes because DayPicker uses `aria-disabled`, not native `disabled`, for month buttons.
  - The calendar shell measures its content with `ResizeObserver` and transitions height so month grids with different week counts resize smoothly.
- [`src/components/layout/AppShell.tsx`](/Users/bbk/Codes/omanote/src/components/layout/AppShell.tsx)
  - The shell now provides shared top chrome across routes.
  - Canvas fills that chrome with date navigation.
  - Specialist routes fill the same chrome slot with route-specific controls instead of canvas date navigation.
  - Route changes between navbar pages use a short horizontal slide animation.

### Bottom navigation

- [`src/components/layout/BottomNav.tsx`](/Users/bbk/Codes/omanote/src/components/layout/BottomNav.tsx)
  - Active pill moves between tabs.
  - Active pill uses transform/size/opacity transition on the base motion token so it responds crisply.
  - Active-label tab text uses natural content width immediately, then reveals with faster opacity and margin animation; width itself is not animated because that desynchronizes the measured pill.
  - Tab buttons have hover and active feedback.
  - Tabs are icon-only on mobile and label-based on desktop.
  - Glass background uses backdrop blur.
  - The center tab pill is the only mobile swipe zone for paging between Canvas, Todos, Notes, Bookmarks, and Event.
  - Swiping left/right wraps across the navbar pages; Explore and Profile are excluded from page swipe behavior.
  - Bottom chrome now hides while scrolling and returns after scroll settles.
  - Keyboard-aware hide logic now removes the nav whenever the mobile keyboard is open, including search-field focus, so editors and inputs get the full viewport height.
  - Desktop profile menu dismisses on outside click instead of requiring a second tap on the avatar trigger.
  - Profile menu includes a `ThemeToggle` pill — a full-width three-option segmented control (System / Light / Dark) where the active highlight slides between options using `useMeasuredHighlight`. Transition uses `cubic-bezier(0.77,0,0.175,1)` at 300 ms, matching the navbar pill animation. Each option shows an icon and text label; active item uses nav-active token colors.

### Draft composer

- [`src/components/CanvasDraftBlock.tsx`](/Users/bbk/Codes/omanote/src/components/CanvasDraftBlock.tsx)
  - Slash-command picker appears/disappears for note mode.
  - Slash-command detection in note mode is intentionally first-line only.
  - Rich-text formatting controls are suppressed while the slash picker is active.
  - Mobile draft type switching uses a focused-only icon segmented pill positioned above the input. The highlight slides between note, todo, event, and bookmark using `useMeasuredHighlight`.
  - Todo rows, event rows, and bookmark row all use focus retention and keyboard-driven row creation.
  - Active draft modes are visually distinct through chips and leading icons.
  - Switching draft modes preserves the text already entered by transferring the current editor value into the target draft state.
  - Saving a todo after switching from note to todo clears the source note draft as well as the todo draft, preventing the saved text from reappearing in the note composer.
  - Save hint appears only when relevant.
  - Mobile save action uses an icon-only check affordance that appears only when content is valid to save.
  - Mobile visibility handling now uses non-smooth, overlap-aware editor repositioning for faster keyboard response.
  - Note folder picker now appears only after meaningful note input and stays hidden for bare `/` slash-command entry.

### Canvas items

- [`src/components/CanvasTodoBlock.tsx`](/Users/bbk/Codes/omanote/src/components/CanvasTodoBlock.tsx)
  - Canvas todo cards transition on hover and focus.
  - Future-dated todos render as a dedicated chip and disable completion on the current canvas.
  - Delete icon appears on hover/focus.

- [`src/components/CanvasEventBlock.tsx`](/Users/bbk/Codes/omanote/src/components/CanvasEventBlock.tsx)
  - Hover/focus shell treatment.
  - Delete icon reveal on hover/focus.

- [`src/components/CanvasNoteBlock.tsx`](/Users/bbk/Codes/omanote/src/components/CanvasNoteBlock.tsx)
  - Hover/focus shell treatment.
  - Inline note editing now uses a dedicated editor shell.
  - Delete icon reveal on hover/focus; hidden while actively editing.
- [`src/components/NoteCanvasEditor.tsx`](/Users/bbk/Codes/omanote/src/components/NoteCanvasEditor.tsx)
  - Rich text toolbar is portaled above or below the active canvas note based on available space.
  - TipTap note input now uses consistent key semantics: `Enter` paragraph, `Shift+Enter` line break, `Cmd/Ctrl+Enter` save.
  - Footer folder picker appears only after meaningful note content.
  - Footer hint keeps save guidance visually lightweight.

- [`src/components/cards.tsx`](/Users/bbk/Codes/omanote/src/components/cards.tsx)
  - Todo, note, bookmark, and event cards have hover/focus-visible style transitions.
  - Bookmark cards include loading spinner animation.
  - Canvas bookmark cards now swap a link-copy icon into a checkmark briefly after copying the URL.
  - Rich-text link hover tooltip now includes copy-link action with copied checkmark feedback.
  - Linked-artifact bookmarks render a persistent top-left "Saved in …" pill over thumbnails.
  - The linked-artifacts popup is rendered through a portal (fixed layer above cards) so it does not clip inside card bounds.
  - Linked-artifacts rows are icon-first by artifact type and include context metadata (todo due/completed labels, note preview text, event time/provenance).
- [`src/components/AttachmentLinkPreview.tsx`](/Users/bbk/Codes/omanote/src/components/AttachmentLinkPreview.tsx)
  - Inline attachment preview cards progressively enhance from fallback domain labels to fetched metadata.
  - Link preview cards preserve lightweight hover affordance without shifting surrounding artifact layout.

### Specialist workspace surfaces

- [`src/screens/TodosScreen.tsx`](/Users/bbk/Codes/omanote/src/screens/TodosScreen.tsx)
  - Desktop keeps a split-pane workspace with left-rail status/schedule navigation.
  - Mobile uses a single-row horizontal tab strip for Today/Overdue/Upcoming/Completed.
  - The content pane keeps only a minimal `+` action and list content to reduce visual noise.
  - Checking or unchecking a todo now gives immediate checkbox/text feedback, preserves date metadata during exit, then fades/translates and collapses the row so nearby content moves smoothly before the filter removes it.
  - Todo rows and date groups use the same vertical spacing rhythm, with measured row/group height and todo-owned spacing animated together so completion exits do not move surrounding content twice.
  - Completing/uncompleting todos keep their pre-toggle sort lane during the exit window, including the completed-view timestamp sort, so only content below the original slot moves.
  - Later/Upcoming groups sort ascending by due date so nearest future todos appear first; overdue and completed retain their reverse-chronological grouping.

- [`src/screens/NotesScreen.tsx`](/Users/bbk/Codes/omanote/src/screens/NotesScreen.tsx)
  - Desktop keeps the split-pane folder/content workspace.
  - Mobile defaults to folder list first, then opens notes in a full-width bottom-sheet drawer.
  - The mobile notes drawer renders above top/bottom chrome, dims the whole background, and includes a back button + active folder title header.

- [`src/screens/BookmarksScreen.tsx`](/Users/bbk/Codes/omanote/src/screens/BookmarksScreen.tsx)
  - Desktop keeps the split-pane category/content workspace.
  - Mobile defaults to category list first, then opens bookmarks in a full-width bottom-sheet drawer.
  - The mobile bookmarks drawer mirrors notes behavior: full-screen dim overlay plus back button + active category title header.

- [`src/components/TodoEditorModal.tsx`](/Users/bbk/Codes/omanote/src/components/TodoEditorModal.tsx)
  - Todo capture modal now follows the event-style large-input presentation.
  - Natural-language parsing is the default capture path.
  - Mobile save affordance is present through `MobileSaveButton`.

- [`src/screens/EventScreen.tsx`](/Users/bbk/Codes/omanote/src/screens/EventScreen.tsx)
  - Todo-derived event entries render with a checkmark marker and read-only treatment.
  - Derived entries avoid edit actions to keep provenance behavior predictable.
  - Calendar and timeline views now switch through the shared `SegmentedPill` chrome so the control matches the todo filter pill and profile theme toggle.

### Modals and overlays

- [`src/components/NoteEditorModal.tsx`](/Users/bbk/Codes/omanote/src/components/NoteEditorModal.tsx)
- [`src/components/TodoEditorModal.tsx`](/Users/bbk/Codes/omanote/src/components/TodoEditorModal.tsx)
  - Modal text flows keep hashtag-aware editing aligned with shared rich-text behavior.
  - Hashtag picker appears as a portal-based dropdown when typing `#`
  - Color assignment is deterministic (same hashtag always gets the same color)
- [`src/components/EventEditorModal.tsx`](/Users/bbk/Codes/omanote/src/components/EventEditorModal.tsx)
  - Same hashtag highlighting backdrop pattern as Todo and Note editors
  - Supports hashtag input on both label and notes textareas
- [`src/components/BookmarkEditorModal.tsx`](/Users/bbk/Codes/omanote/src/components/BookmarkEditorModal.tsx)
- [`src/components/UpdateNotificationBanner.tsx`](/Users/bbk/Codes/omanote/src/components/UpdateNotificationBanner.tsx)
  - Bottom-floating update banner uses subtle border/shadow interpolation on hover and supports a compact `+ x more updates` summary state.
- [`src/components/UpdateModal.tsx`](/Users/bbk/Codes/Omanote/src/components/UpdateModal.tsx)
  - Update modal keeps changelog history in a constrained scroll region so multi-release backlogs remain readable without expanding viewport height.
  - The banner now lifts toward center and fades into the modal during open so the popup-to-modal handoff feels continuous.
- [`src/components/ExploreOverlay.tsx`](/Users/bbk/Codes/omanote/src/components/ExploreOverlay.tsx)
  - Hashtag explore mode renders as a full-screen overlay
  - Force-directed graph shows hashtag relationships with smooth pan/zoom
  - Mind map view filters graph based on selected hashtags in combobox

### Search and top chrome

- [`src/components/layout/AppShell.tsx`](/Users/bbk/Codes/omanote/src/components/layout/AppShell.tsx)
  - Top chrome is a shared fixed shell region across the app and can hide/reveal without moving content abruptly.
  - On non-workspace routes, top chrome hides on downward scroll and returns on upward scroll.
- Search is now route-first: `/search` owns full search results and Explore search mode handles quick discovery. The legacy `SearchOverlay`/`TopBar` path was removed.
  - Notes and Bookmarks keep the top chrome pinned visible while their panes scroll internally.
  - Bottom nav continues to hide on scroll and ease back in after scrolling stops.
  - Canvas contributes date navigation, while other routes contribute their own headers into the same shell.
  - Notes and Bookmarks keep internal panes that scroll independently from the browser document.

- [`src/components/layout/BottomNav.tsx`](/Users/bbk/Codes/omanote/src/components/layout/BottomNav.tsx)
  - Search and profile live as separate circular controls outside the main tab pill.
  - Desktop search expands from bottom nav into a bottom-aligned search field.
  - Mobile search opens as a top-docked panel (input + results) rendered via portal.
  - Profile avatar uses the same vertical size as the main nav pill.
  - Search panel/results keep background scroll locked while search is open.
  - Desktop profile menu includes an `Edit` action; mobile profile drawer header includes a right-aligned `Edit` action. Both open account settings in a new tab (`accounts.omanote.iambishistha.com`).
  - Mobile profile drawer backdrop consumes pointer/click events before close so taps cannot pass through and activate content underneath.

### Drag and reorder

- [`src/screens/CanvasScreen.tsx`](/Users/bbk/Codes/omanote/src/screens/CanvasScreen.tsx)
  - Drag handle fades in on hover/focus.
  - Reordering uses a translate animation to keep items spatially coherent.
  - Dragging lowers opacity on the active item.

### Toasts and feedback

- [`src/components/ToastHost.tsx`](/Users/bbk/Codes/omanote/src/components/ToastHost.tsx)
  - Toast containers use card styling with shadow and border.
  - Toast stack is anchored at top-center.
  - Toasts now animate in from the top and animate out toward the top (presence-based enter/exit, not abrupt unmount).
  - Default toasts auto-dismiss after 5s.
  - Delete toasts show the deleted artifact preview content inline (`Deleted {artifact}: {content}`) with truncated text for long content and stronger emphasis on the content segment.
  - Reminder toasts use Bell styling and remain for 30s with Snooze/Dismiss actions.
  - `Cmd/Ctrl + Z` and redo shortcuts are handled globally (subject to editable-field guard behavior).

### Loading states

- [`src/components/cards.tsx`](/Users/bbk/Codes/omanote/src/components/cards.tsx)
  - Bookmark loading state uses a spinner.

### Hashtags and Rich Text

- [`src/components/HashtagChip.tsx`](/Users/bbk/Codes/omanote/src/components/HashtagChip.tsx)
  - Colored pill display with smooth hover state transitions
  - Optional tooltip appears on hover with "View mind map" affordance
  - Click handlers (if provided) trigger with standard press feedback
  - Colors are assigned deterministically from a 10-color palette

- [`src/components/HashtagPicker.tsx`](/Users/bbk/Codes/omanote/src/components/HashtagPicker.tsx)
  - Dropdown appears/disappears smoothly when typing `#` in text input
  - Portal-based positioning keeps dropdown visible above other content
  - Dropdown anchors to the active caret/token position (not the whole editor block) and flips above/below when viewport space is constrained.
  - Scroll position updates as user types to keep selected suggestion visible
  - Escape key or outside click dismisses the picker

- [`src/components/rich-text.tsx`](/Users/bbk/Codes/omanote/src/components/rich-text.tsx)
  - RichTextPreview now inherits text color from parent wrapper instead of hardcoding
  - Hashtag chips render with colors that cascade properly through component hierarchy
  - Preview mode now renders semantic list structures (`ul/li`, `ol/li`) to keep marker layout consistent with edit mode.

## Good Fits For Emil-Style Polish

The skill suggests we should favor:

- `ease-out` for entries and exits
- `ease-in-out` only for actual movement or morphing
- short durations, usually under `300ms`
- transform/opacity over layout thrash
- no `scale(0)` entrances
- subtle press feedback on buttons

## Best Places To Improve Next

### 1. Date strip paging

Current state:
- The strip slides, but the motion is still fairly functional.

Potential polish:
- Add a stronger spatial cue so the week feels like a single moving surface.
- Keep the selected chip pinned with a slightly delayed highlight settle.
- Use a slightly softer custom easing curve rather than the default feel.

### 2. Draft composer mode switches

Current state:
- Switching between todo, event, and bookmark is practical but not especially expressive.

Potential polish:
- Animate the leading icon/chip change with subtle opacity and translate.
- Make the row insertion feel like the new input grows from the previous line instead of popping in.
- Keep transitions extremely short because these actions happen often.

### 3. Canvas card hover states

Current state:
- Cards reveal delete/edit actions on hover/focus.

Potential polish:
- Make reveal timing consistent across all card types.
- Prefer a unified hover elevation or background tint language.
- Avoid too many different interaction patterns for the same task.

### 4. Bookmark and event loading/edit states

Current state:
- Functional, but each has its own small interaction language.

Potential polish:
- Standardize empty/loading/edit transitions so they feel like one system.
- Keep modal open/close and inline edit timing aligned.

### 5. Bottom navigation

Current state:
- The active pill is nice and the shell has glassmorphism.

Potential polish:
- Slightly refine the active pill motion so it feels like it glides between tabs.
- Keep the shell blur modest so it doesn’t compete with content.

## Rules To Keep In Mind

- Favor motion that explains state, not motion for decoration alone.
- Avoid slow hover transitions on frequently used controls.
- Prefer a few meaningful transitions over many tiny ones.
- If an interaction happens many times per day, reduce the motion rather than amplify it.
