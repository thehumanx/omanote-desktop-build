import { useEffect, useRef } from "react";

/**
 * A Todos / Notes / Bookmarks screen mounted as nothing but its folder sheet,
 * over another route (the canvas's folder tabs). `folderKey` is what that
 * screen selects by: todo folder id, note folder name, bookmark category id.
 * `onClosed` fires once the sheet has slid out, so the host can unmount it.
 */
export type FolderSheetOverlay = { folderKey: string; onClosed: () => void };

/**
 * Calls `open` two frames after mount, so the sheet is first painted in its
 * closed (off-screen) position and then slides in rather than appearing.
 */
export function useOpenOnMount(enabled: boolean, open: () => void) {
  const openRef = useRef(open);
  openRef.current = open;
  useEffect(() => {
    if (!enabled) return;
    let inner = 0;
    const outer = window.requestAnimationFrame(() => {
      inner = window.requestAnimationFrame(() => openRef.current());
    });
    return () => {
      window.cancelAnimationFrame(outer);
      window.cancelAnimationFrame(inner);
    };
  }, [enabled]);
}
