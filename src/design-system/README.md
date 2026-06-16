# Omanote Design System

This folder contains the core design-system source:

- `tokens.ts`: typed semantic tokens
- `theme.ts`: light/dark/system resolution helpers + `applyTypographySettings` (maps `"sans"` / `"serif"` font tokens to CSS custom properties on `:root`)
- `token-css.ts`: CSS variable block generation

## Component Inventory (Used)

This inventory is based on JSX usage in `src/` and `extension/` (`.tsx/.jsx`, excluding tests), then mapped to import source.

### Custom Omanote Components

`App`, `AppProvider`, `AppShell`, `AttachmentLinkPreview`, `AuthProvider`, `AuthScreen`, `Badge`, `BaseModal`, `BookmarkCard`, `BookmarkEditorModal`, `BottomNav`, `Button`, `CanvasDraftBlock`, `CanvasEventBlock`, `CanvasNoteBlock`, `CanvasTodoBlock`, `CategoryActionMenu`, `CategoryCard`, `CategoryRow`, `ChangelogProductTabs`, `CheckboxField`, `Chip`, `CookieNotice`, `DateStripHighlight`, `PageHeader`, `DeviceActivityReporter`, `EmptyState`, `EncryptionGate`, `EncryptionProvider`, `ErrorBoundary`, `EventEditorModal`, `ExportDataPanel`, `ExtensionModal`, `FaviconBadgeSync`, `FolderActionMenu`, `FolderCard`, `FolderRow`, `HashtagChip`, `HashtagCombobox`, `HashtagGraph`, `HashtagPickerDropdown`, `ImportDataPanel`, `Input`, `LandingScreen`, `LoadingSpinner`, `MenuItem`, `MobileSaveButton`, `ModalPortal`, `NavLabelPreview`, `NoteCanvasEditor`, `NoteCard`, `NoteFolderPicker`, `NoteInlineEditor`, `NotificationPermissionBanner`, `OfflineStatusBanner`, `OptionCard`, `Popup`, `RecentItems`, `ReminderMonitor`, `RichTextPreview`, `RichTextToolbar`, `TiptapRichTextToolbar`, `TiptapLinkPopover`, `SaveForm`, `SaveModal`, `SaveShortcutHint`, `SearchResultsList`, `SegmentedHighlight`, `SegmentedItem`, `SegmentedItemLabel`, `SegmentedPill`, `SegmentedShell`, `SettingsView`, `ShareFolderModal`, `ShareNoteFolderModal`, `SuppressHashtagTooltipCtx`, `TextArea`, `ThemeProvider`, `ToastHost`, `TodoCheckmark`, `TodoEditorModal`, `TodoListRow`, `UpdateModal`, `UpdateNotificationBanner`, `UpdateProvider`, `UrlLinkPreview`, `UserSettingsProvider`.

### Library Components

- `lucide-react`: `AlertTriangle`, `ArrowDown`, `ArrowDownUp`, `ArrowRight`, `ArrowUp`, `ArrowUpDown`, `Bell`, `Bold`, `Bookmark`, `Calendar`, `CalendarClock`, `CalendarDays`, `Check`, `CheckCheck`, `CheckCircle2`, `CheckIcon`, `CheckSquare`, `ChevronDown`, `ChevronLeft`, `ChevronRight`, `CircleCheckBig`, `Clock`, `Clock3`, `ClockAlert`, `Code2`, `Compass`, `Copy`, `Download`, `Ellipsis`, `ExternalLink`, `Eye`, `FileJson`, `FileText`, `Folder`, `Globe`, `GripHorizontal`, `GripVertical`, `Info`, `Italic`, `LayoutGrid`, `LayoutList`, `Link` (icon), `Link2`, `List`, `ListOrdered`, `LogOut`, `Pencil`, `Plus`, `Puzzle`, `RefreshCw`, `RotateCcw`, `Search`, `Settings`, `Share2`, `Sparkles`, `Trash2`, `Upload`, `Wifi`, `WifiOff`, `X`, `XCircle`
- `react-day-picker`: `DayPicker`
- `react-router-dom`: `BrowserRouter`, `Link`, `Navigate`, `NavLink`, `Outlet`, `Route`, `Routes`
- `@clerk/react`: `ClerkProvider`, `SignInButton`, `SignUpButton`
- `convex/react-clerk`: `ConvexProviderWithClerk`
- `react`: `Suspense`, `React`
