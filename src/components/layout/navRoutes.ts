export const navRoutePaths = ["/canvas", "/todos", "/notes", "/bookmarks", "/event"] as const;

export type NavRoutePath = (typeof navRoutePaths)[number];

export function getNavRouteIndex(pathname: string) {
  return navRoutePaths.findIndex((route) => pathname === route || pathname.startsWith(`${route}/`));
}

export function getWrappedNavRoutePath(index: number) {
  const length = navRoutePaths.length;
  const normalized = ((index % length) + length) % length;
  return navRoutePaths[normalized]!;
}
