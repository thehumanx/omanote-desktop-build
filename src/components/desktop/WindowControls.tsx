import { useEffect, useState } from "react";
import { Minus, Square, Copy, X } from "lucide-react";
import { desktopPlatform } from "../../lib/desktop";

/**
 * Custom minimize / maximize / close buttons for platforms where the shell
 * draws no native title bar (Windows). macOS keeps its native traffic
 * lights and Linux keeps native decorations, so this renders nothing there.
 */
export function WindowControls() {
  const [maximized, setMaximized] = useState(false);
  const show = desktopPlatform() === "windows";

  useEffect(() => {
    if (!show) return;
    let unlisten: (() => void) | null = null;
    let cancelled = false;

    void import("@tauri-apps/api/window").then(async ({ getCurrentWindow }) => {
      const win = getCurrentWindow();
      setMaximized(await win.isMaximized());
      const stop = await win.onResized(async () => {
        setMaximized(await win.isMaximized());
      });
      if (cancelled) {
        stop();
      } else {
        unlisten = stop;
      }
    });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [show]);

  if (!show) return null;

  async function withWindow(fn: (win: Awaited<ReturnType<typeof getWindow>>) => Promise<void>) {
    const win = await getWindow();
    await fn(win);
  }

  async function getWindow() {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    return getCurrentWindow();
  }

  const buttonClass =
    "flex h-9 w-11 items-center justify-center text-app-ink-muted transition-colors hover:bg-app-surface-muted hover:text-app-ink";

  return (
    <div className="flex items-stretch" data-no-drag>
      <button
        type="button"
        aria-label="Minimize window"
        className={buttonClass}
        onClick={() => void withWindow((win) => win.minimize())}
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        aria-label={maximized ? "Restore window" : "Maximize window"}
        className={buttonClass}
        onClick={() => void withWindow((win) => win.toggleMaximize())}
      >
        {maximized ? <Copy className="h-3 w-3 -scale-x-100" /> : <Square className="h-3 w-3" />}
      </button>
      <button
        type="button"
        aria-label="Close window"
        className={`${buttonClass} hover:bg-danger-solid hover:text-white`}
        onClick={() => void withWindow((win) => win.close())}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
