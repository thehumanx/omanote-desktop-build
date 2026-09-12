/**
 * The public host for shared links.
 *
 * Hard-coded rather than read from `window.location`: a share URL has to be the
 * canonical one wherever it's generated, and the desktop shell runs on
 * `tauri://localhost` where `location.origin` would produce a link that works
 * for nobody.
 */
export const SHARE_DOMAIN = "omanote.com";

/**
 * Public URL for a share code or custom slug.
 *
 * All share types live under `/s/` — bookmarks, todo folders, note folders and
 * canvases alike (see `SharedFolderPage`). `/n/` is the legacy note-folder
 * prefix and only exists as a redirect for links already in the wild.
 *
 * Previously four identical copies across the share modals and `PageCard`, one
 * of which spelled the constant `SHARE_DOMAIN` and the rest `DOMAIN`.
 */
export function buildShareUrl(codeOrSlug: string): string {
  return `https://${SHARE_DOMAIN}/s/${codeOrSlug}`;
}
