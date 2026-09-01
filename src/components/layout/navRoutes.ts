import type { DraftMode } from "../../app/types";

export const navRoutePaths = ["/canvas", "/todos", "/notes", "/bookmarks", "/event"] as const;

export type NavRoutePath = (typeof navRoutePaths)[number];

// Routes that aren't tabs of their own but belong to one — /history is a
// second view of the canvas, so the Canvas tab stays highlighted (and swipe
// navigation keeps working) while you're browsing past days.
const navRouteAliases: Record<string, NavRoutePath> = {
  "/history": "/canvas",
};

export function getNavRouteIndex(pathname: string) {
  const aliased = navRouteAliases[pathname] ?? pathname;
  return navRoutePaths.findIndex((route) => aliased === route || aliased.startsWith(`${route}/`));
}

export function getWrappedNavRoutePath(index: number) {
  const length = navRoutePaths.length;
  const normalized = ((index % length) + length) % length;
  return navRoutePaths[normalized]!;
}

// So the "+" composer (and the global capture shortcut) opens already set to
// the kind of artifact the current tab is for, instead of always defaulting
// to a note.
const composerModeByRoute: Record<NavRoutePath, DraftMode> = {
  "/canvas": "note",
  "/todos": "todo",
  "/notes": "note",
  "/bookmarks": "bookmark",
  "/event": "event",
};

export function getComposerModeForPathname(pathname: string): DraftMode {
  const index = getNavRouteIndex(pathname);
  return index === -1 ? "note" : composerModeByRoute[navRoutePaths[index]!];
}
