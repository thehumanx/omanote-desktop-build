// Contextual browser-tab title per section of the authenticated app.
// Ordered by specificity — "/reader/saved" must be checked before "/reader".
const pageLabelRules: Array<{ prefix: string; label: string }> = [
  { prefix: "/canvas", label: "Canvas" },
  { prefix: "/todos", label: "Todos" },
  { prefix: "/notes", label: "Notes" },
  { prefix: "/bookmarks", label: "Bookmarks" },
  { prefix: "/event", label: "Events" },
  { prefix: "/explore", label: "Search" },
  { prefix: "/reader/saved", label: "Saved" },
  { prefix: "/reader", label: "Feeds" },
  { prefix: "/settings", label: "Settings" },
  { prefix: "/insights", label: "Insights" },
  { prefix: "/guide", label: "Guide" },
  { prefix: "/updates", label: "Updates" },
];

export function getPageTitleLabel(pathname: string): string | null {
  for (const rule of pageLabelRules) {
    if (pathname === rule.prefix || pathname.startsWith(`${rule.prefix}/`)) {
      return rule.label;
    }
  }
  return null;
}
