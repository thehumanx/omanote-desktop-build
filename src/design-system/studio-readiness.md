# Design System Studio Readiness Matrix

This matrix classifies `src/components/**` by how easy they are to render in an isolated design-system studio.

## Legend
- `Ready`: render directly with props only.
- `Needs Router`: requires `react-router-dom` context.
- `Needs App Providers`: depends on Omanote contexts/hooks (`useApp`, `useUserSettings`, `useTheme`, `useAuth`, `useUpdate`, `useEncryption`).
- `Needs Backend`: uses Convex hooks (`useQuery`, `useMutation`) and needs API mocking.
- `Feature/Shell`: app-specific orchestration component; not a pure DS primitive.

## 1) Ready (props-only primitives)
- `Button`
- `Input`
- `TextArea`
- `Select`
- `Switch`
- `LoadingSpinner`
- `Badge`
- `Chip`
- `OptionCard`
- `CheckboxField`
- `MenuItem`
- `TodoCheckmark`
- `SegmentedShell`
- `SegmentedItem`
- `SegmentedItemLabel`
- `SegmentedHighlight`
- `SegmentedPill`
- `DateStripHighlight`
- `Panel`
- `DialogSurface`
- `DrawerSurface`
- `IconButton`

Source: `src/components/ui.tsx`

## 2) Needs Router
- `CookieNotice` (`Link`)
- `HashtagChip` (`useNavigate`)
- `SearchResultsList` (`useNavigate`)
- `UpdateModal` (`useNavigate`)
- `BottomNav` (`NavLink`, `useLocation`, `useNavigate`)
- `AppShell` (`useLocation`, `Outlet` usage pattern)

## 3) Needs App Providers
- `DateStrip` (`useApp`)
- `CanvasDraftBlock` (`useApp`, `useUserSettings`)
- `CanvasNoteBlock` (`useApp` dispatch pattern)
- `CanvasTodoBlock` (`app dispatch/selection callbacks)
- `CanvasEventBlock` (`app dispatch callbacks)
- `TodoListRow` (`uses UI/save settings behavior)
- `TodoEditorModal` (`useUserSettings`)
- `NoteEditorModal` (`useUserSettings`)
- `NoteCanvasEditor` (`useUserSettings`)
- `NoteInlineEditor` (`useUserSettings`)
- `SaveShortcutHint` (`useUserSettings`)
- `NotificationPermissionBanner` (`useUserSettings`)
- `OfflineStatusBanner` (state/phase props + tokenized visuals)
- `ReminderMonitor` (`useApp`, `useUserSettings`)
- `ToastHost` (`useApp`, `useUserSettings`)
- `FaviconBadgeSync` (`useApp`)
- `UpdateNotificationBanner` (`useUpdate`)
- `DeviceActivityReporter` (`useEncryption`, `useAuth`)
- `EncryptionGate` (`useEncryption`)

## 4) Needs Backend (Convex)
- `HashtagPicker` (`useQuery(api.hashtags.listUserHashtags)`)
- `HashtagGraph` (`useQuery(api.hashtags.listAllUserHashtags/getAllHashtagUsages)`)
- `ShareFolderModal` (`useQuery`/`useMutation` shared folders API)
- `ShareNoteFolderModal` (`useQuery`/`useMutation` shared note folders API)

## 5) Feature/Shell (not DS primitives)
- `AppShell`
- `BottomNav`
- `ExploreOverlay`
- `cards.tsx` exports (`NoteCard`, `BookmarkCard`, etc.)
- `ExportDataModal` / `ImportDataModal`
- `BookmarkEditorModal` / `NoteEditorModal` / `TodoEditorModal` / `EventEditorModal`
- `ExtensionModal`
- `ModalPortal`

These are renderable in studio, but should be showcased as "feature examples" rather than reusable DS primitives.

## Studio Starter Wrapper

Use this wrapper in your studio app so most components render without crashing:

```tsx
import React from "react";
import { MemoryRouter } from "react-router-dom";

export function StudioProviders({ children }: { children: React.ReactNode }) {
  // Replace with your mocked providers as you wire each dependency.
  // Recommended order mirrors app composition.
  return (
    <MemoryRouter>
      {children}
    </MemoryRouter>
  );
}
```

Then add mock layers as needed:
- App state: mock `useApp` via provider or module mock.
- Settings/theme/auth/update/encryption: mock respective context hooks/providers.
- Convex: provide mocked query/mutation responses (or MSW + adapter).

## Icons (Lucide)

Icons are imported from `lucide-react` (npm dependency), not local SVG assets.
Examples:
- `src/components/ui.tsx`
- `src/components/layout/BottomNav.tsx`
- `src/screens/LandingScreen.tsx`
