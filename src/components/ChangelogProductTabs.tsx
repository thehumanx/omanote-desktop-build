// The ChangelogProductTabs component that used to live here was removed: it
// was never rendered. Only the tab metadata below is used, by UpdateModal and
// UpdatesScreen, which each render their own tab UI.

export type ChangelogProduct = "application" | "extension";

export const CHANGELOG_TABS: Array<{ id: ChangelogProduct; label: string; sectionTitle: string }> = [
  { id: "application", label: "Application", sectionTitle: "Versions" },
  { id: "extension", label: "Extension", sectionTitle: "Extension Versions" },
];
