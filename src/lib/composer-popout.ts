import type { DraftMode } from "../app/types";
import { isTauri } from "./desktop";

const POPOUT_WIDTH = 420;
const POPOUT_HEIGHT = 520;

// Minimal ambient type for the Chromium-only Document Picture-in-Picture
// API — not in lib.dom.d.ts yet, and only ever touched behind the
// `"documentPictureInPicture" in window` feature check below.
type DocumentPictureInPictureWindow = Window & { document: Document };
type DocumentPictureInPicture = {
  requestWindow(options?: { width?: number; height?: number }): Promise<DocumentPictureInPictureWindow>;
};

function buildPopoutPath(mode: DraftMode): string {
  const params = new URLSearchParams({ mode });
  return `/compose-popout?${params.toString()}`;
}

async function openTauriWindow(mode: DraftMode): Promise<void> {
  const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
  const existing = await WebviewWindow.getByLabel("composer");
  if (existing) {
    await existing.setFocus();
    return;
  }
  new WebviewWindow("composer", {
    url: buildPopoutPath(mode),
    width: POPOUT_WIDTH,
    height: POPOUT_HEIGHT,
    title: "New artifact",
    alwaysOnTop: true,
    resizable: true,
  });
}

// Chromium only: a genuine always-on-top floating window (the same
// mechanism Zen/Firefox's video PiP is conceptually similar to, though that
// one is video-only and not available to arbitrary content there). React's
// event delegation is per-document, so reparenting the *existing* composer
// into the PiP window's document would silently break clicks/keys there —
// an iframe pointed at the same route sidesteps that entirely: it's a
// normal, fully independent page load, just hosted inside the floating
// window's frame instead of a regular popup.
async function openDocumentPip(mode: DraftMode): Promise<void> {
  const pip = (window as unknown as { documentPictureInPicture?: DocumentPictureInPicture }).documentPictureInPicture;
  if (!pip) throw new Error("Document Picture-in-Picture is not supported in this browser.");

  const pipWindow = await pip.requestWindow({ width: POPOUT_WIDTH, height: POPOUT_HEIGHT });
  const iframe = pipWindow.document.createElement("iframe");
  iframe.src = buildPopoutPath(mode);
  iframe.style.cssText = "position:fixed;inset:0;width:100%;height:100%;border:0;";
  pipWindow.document.body.style.margin = "0";
  pipWindow.document.body.appendChild(iframe);
}

/**
 * "Pop out" the composer into its own floating/separate window instead of
 * the in-page overlay. Three paths, tried in order of how close they get to
 * a true floating window:
 * 1. Document Picture-in-Picture (Chromium browsers) — always-on-top,
 *    survives switching tabs.
 * 2. Tauri desktop — a real native OS window.
 * 3. Everywhere else — a plain window.open() popup (draggable, survives
 *    switching tabs, just not always-on-top — no browser exposes that to a
 *    regular window).
 */
export async function popOutComposer(mode: DraftMode): Promise<void> {
  // Checked first: Windows' Tauri webview (WebView2) is Chromium-based and
  // may also expose documentPictureInPicture, but a real native OS window
  // is what's wanted there, not a PiP frame inside the app's own webview.
  if (isTauri()) {
    await openTauriWindow(mode);
    return;
  }
  if (typeof window !== "undefined" && "documentPictureInPicture" in window) {
    await openDocumentPip(mode);
    return;
  }
  // toolbar/location/menubar/status are best-effort — most modern browsers
  // ignore them for anti-phishing reasons and show the address bar anyway,
  // same as they do for Document PiP's own chrome above, but they're free
  // to include and do work in some browsers/configurations.
  const features = `width=${POPOUT_WIDTH},height=${POPOUT_HEIGHT},toolbar=no,location=no,menubar=no,status=no`;
  // window.open() returns null (rather than throwing) when the popup is
  // blocked — surface that as a real rejection so callers can tell the
  // difference between "opened" and "silently blocked".
  const popup = window.open(buildPopoutPath(mode), "omanote-composer", features);
  if (!popup) {
    throw new Error("The browser blocked the pop-out window. Allow popups for this site and try again.");
  }
}
