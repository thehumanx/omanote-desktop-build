import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { GripHorizontal } from "lucide-react";
import type { DraftMode } from "../app/types";
import { CanvasDraftBlock, type CanvasDraftBlockHandle } from "../components/CanvasDraftBlock";
import { formatSaveShortcutKeyLabel } from "../lib/editor-shortcuts";
import { detectPlatformName } from "../lib/device-info";

const VALID_MODES: DraftMode[] = ["note", "todo", "bookmark", "event"];

function readRequestedMode(value: string | null): DraftMode {
  return VALID_MODES.includes(value as DraftMode) ? (value as DraftMode) : "note";
}

/**
 * The pop-out composer window (see ../lib/composer-popout.ts) — a real,
 * separate window (Tauri native window, or a plain web popup) loading just
 * this route, full-bleed, no app chrome. Draft persistence (see
 * CanvasDraftBlock's use of composer-draft.ts) is what lets this window and
 * the main one show the same in-progress text either way.
 */
export function ComposerPopoutScreen() {
  const [searchParams] = useSearchParams();
  const requestedMode = readRequestedMode(searchParams.get("mode"));
  const draftRef = useRef<CanvasDraftBlockHandle | null>(null);
  // See ComposerSheet's identical use of outsideClickContainerRef — without
  // this, clicking the esc/save hint row above (outside CanvasDraftBlock's
  // own root) would count as an "outside click" and dismiss the draft.
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isMac = detectPlatformName(typeof navigator === "undefined" ? "" : navigator.userAgent) === "macOS";
  const [draftMode, setDraftMode] = useState<DraftMode>(requestedMode);
  const saveKeyLabel = formatSaveShortcutKeyLabel(draftMode === "note" ? "mod_enter" : "enter", isMac);

  useEffect(() => {
    document.title = "New artifact — omanote";
  }, []);

  // The composer sheet auto-focuses on every genuine reopen but
  // deliberately skips its very first mount (it stays mounted in the
  // background even while hidden, so that first mount usually isn't a real
  // "just opened" moment — see CanvasDraftBlock's requestToken effect).
  // This window's first mount *is* that moment, so focus explicitly here.
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const target = document.querySelector<HTMLElement>(".ProseMirror, textarea, input");
      target?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  return (
    <div ref={containerRef} className="flex h-screen flex-col bg-app-canvas p-3">
      {/* The browser's own PiP/popup chrome (its URL bar, controls) can't be
          hidden or replaced from the page — this is our content's own top
          strip underneath it, styled like the mobile drawer's drag handle
          for a consistent look, even though only Tauri (a real OS window)
          can make it actually draggable — see data-tauri-drag-region below,
          a no-op everywhere else. */}
      <div data-tauri-drag-region className="mb-2 grid shrink-0 grid-cols-3 items-center">
        <span className="justify-self-start rounded-md border border-app-line px-1.5 py-0.5 text-[11px] font-medium text-app-ink-faint">esc</span>
        <GripHorizontal className="h-5 w-5 justify-self-center text-app-line-strong" />
        <span className="justify-self-end rounded-md border border-app-line px-1.5 py-0.5 text-[11px] font-medium text-app-ink-faint">{saveKeyLabel}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <CanvasDraftBlock
          ref={draftRef}
          embedded
          onDone={() => window.close()}
          onModeChange={setDraftMode}
          outsideClickContainerRef={containerRef}
          requestedMode={requestedMode}
          requestToken={1}
        />
      </div>
    </div>
  );
}
