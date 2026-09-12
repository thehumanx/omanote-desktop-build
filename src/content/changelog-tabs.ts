/**
 * Tab metadata for the changelog surfaces.
 *
 * `UpdateModal` and `UpdatesScreen` each render their own tab UI and share only
 * this list. It lived in a `ChangelogProductTabs.tsx` that had been reduced to a
 * comment and these two exports after the component itself was removed for never
 * being rendered — a `.tsx` file named for a component that no longer existed,
 * which is exactly the kind of thing a grep for the symbol lands on and
 * misreads.
 */
export type ChangelogProduct = "application" | "extension";

export const CHANGELOG_TABS: Array<{ id: ChangelogProduct; label: string; sectionTitle: string }> = [
  { id: "application", label: "Application", sectionTitle: "Versions" },
  { id: "extension", label: "Extension", sectionTitle: "Extension Versions" },
];
