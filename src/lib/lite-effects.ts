import { desktopPlatform } from "./desktop";

/**
 * Lighter visual effects for the Linux desktop app.
 *
 * Tauri renders through WebKitGTK there, with its accelerated DMABUF renderer
 * switched off (apps/desktop/src-tauri/src/main.rs) because it is broken on
 * common drivers. That leaves backdrop blur, CSS masks and continuous
 * animations composited in software, and repainted on every scroll frame, so
 * the frosted chrome, edge fades and the scene's drift made scrolling crawl.
 * `<html data-lite-effects>` drops them (index.css); surfaces turn more solid
 * instead of blurred. The web app and the macOS/Windows shells are untouched.
 */
export function stampLiteEffects(root: HTMLElement = document.documentElement) {
  if (desktopPlatform() === "linux") root.dataset.liteEffects = "";
}

export function liteEffectsOn(root: HTMLElement = document.documentElement): boolean {
  return root.dataset.liteEffects !== undefined;
}
