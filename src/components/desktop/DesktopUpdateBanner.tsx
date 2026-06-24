import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDownToLine, X } from "lucide-react";
import { Button } from "../ui";
import { isTauri } from "../../lib/desktop";

const CHECK_INTERVAL_MS = 30 * 60 * 1000;

type UpdateState =
  | { phase: "hidden" }
  | { phase: "available"; version: string }
  | { phase: "downloading"; percent: number | null }
  | { phase: "error" };

/**
 * Checks for a new desktop release on launch and periodically
 * (tauri-plugin-updater reading latest.json from the omanote-releases repo)
 * and offers a one-click install-and-restart. Dismissing waits until
 * the next launch or check interval.
 */
export function DesktopUpdateBanner() {
  const [state, setState] = useState<UpdateState>({ phase: "hidden" });
  const updateRef = useRef<import("@tauri-apps/plugin-updater").Update | null>(null);

  const checkForUpdate = useCallback(async () => {
    if (!isTauri() || import.meta.env.DEV || updateRef.current) return;
    try {
      const { check } = await import("@tauri-apps/plugin-updater");
      const update = await check();
      if (!update) return;
      updateRef.current = update;
      setState({ phase: "available", version: update.version });
    } catch (err) {
      console.error("[DesktopUpdateBanner] check failed:", err);
    }
  }, []);

  useEffect(() => {
    if (!isTauri() || import.meta.env.DEV) return;

    void checkForUpdate();

    const interval = setInterval(checkForUpdate, CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [checkForUpdate]);

  if (state.phase === "hidden") return null;

  async function handleInstall() {
    const update = updateRef.current;
    if (!update) return;
    setState({ phase: "downloading", percent: null });
    try {
      let total = 0;
      let received = 0;
      await update.downloadAndInstall((event) => {
        if (event.event === "Started") {
          total = event.data.contentLength ?? 0;
        } else if (event.event === "Progress") {
          received += event.data.chunkLength;
          if (total > 0) {
            setState({ phase: "downloading", percent: Math.round((received / total) * 100) });
          }
        }
      });
      const { relaunch } = await import("@tauri-apps/plugin-process");
      await relaunch();
    } catch (err) {
      console.error("[DesktopUpdateBanner] download/install failed:", err);
      setState({ phase: "error" });
    }
  }

  return (
    <div className="fixed bottom-[88px] left-1/2 z-40 w-[min(92vw,420px)] -translate-x-1/2">
      <div className="flex items-center gap-3 rounded-xl border border-app-line bg-app-surface px-4 py-3 shadow-soft">
        <div className="flex-shrink-0">
          <div className="rounded-full bg-app-surface-muted p-2">
            <ArrowDownToLine className="h-4 w-4 text-app-ink-muted" />
          </div>
        </div>
        <div className="min-w-0 flex-1">
          {state.phase === "available" && (
            <>
              <p className="text-sm font-medium text-app-ink">Update available</p>
              <p className="mt-0.5 text-xs text-app-ink-faint">
                omanote {state.version} is ready to install.
              </p>
            </>
          )}
          {state.phase === "downloading" && (
            <>
              <p className="text-sm font-medium text-app-ink">Updating…</p>
              <p className="mt-0.5 text-xs text-app-ink-faint">
                {state.percent !== null ? `Downloading ${state.percent}%` : "Downloading the update."}{" "}
                The app restarts when it's done.
              </p>
            </>
          )}
          {state.phase === "error" && (
            <>
              <p className="text-sm font-medium text-app-ink">Update failed</p>
              <p className="mt-0.5 text-xs text-app-ink-faint">
                Something went wrong. You can retry, or it'll try again next launch.
              </p>
            </>
          )}
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          {state.phase !== "downloading" && (
            <Button tone="default" className="px-3 py-1.5 text-xs" onClick={() => void handleInstall()}>
              {state.phase === "error" ? "Retry" : "Update & restart"}
            </Button>
          )}
          {state.phase !== "downloading" && (
            <Button tone="ghost" className="p-1.5" onClick={() => setState({ phase: "hidden" })}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
