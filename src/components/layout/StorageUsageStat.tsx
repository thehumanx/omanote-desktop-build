import type { FunctionReturnType } from "convex/server";
import { useNavigate } from "react-router-dom";
import type { api } from "../../../convex/_generated/api";
import { formatBytes } from "../../lib/format-bytes";

export type StorageUsage = FunctionReturnType<typeof api.storageUsage.getUsage>;

/**
 * Small "X of 200MB used" line with a progress bar, shown in the profile
 * menu. Clicking it goes to the full breakdown (/settings/storage) rather
 * than trying to fit images-vs-text detail into a dropdown.
 *
 * The menu passes `usage` in (it subscribes before opening). While it is
 * still loading, an empty row of the same height holds the space, so the
 * items below don't jump when it arrives.
 */
export function StorageUsageStat({ usage, onNavigate }: { usage: StorageUsage | undefined; onNavigate?: () => void }) {
  const navigate = useNavigate();

  if (!usage) {
    return (
      <div aria-hidden="true" data-testid="storage-usage-placeholder" className="flex w-full flex-col gap-1.5 px-2 py-2">
        <div className="text-xs">&nbsp;</div>
        <div className="h-1.5 w-full rounded-full bg-app-surface-muted" />
      </div>
    );
  }

  // Same total as Settings > Storage: text, images and share thumbnails.
  const usedBytes = usage.textBytes + usage.imageBytes + usage.thumbnailBytes;
  const percent = Math.min(100, (usedBytes / usage.capBytes) * 100);
  const nearCap = percent >= 90;

  return (
    <button
      type="button"
      onClick={() => {
        navigate("/settings", { state: { category: "storage" } });
        onNavigate?.();
      }}
      className="flex w-full flex-col gap-1.5 rounded-xl px-2 py-2 text-left transition hover:bg-app-surface-hover"
    >
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-medium text-app-ink-muted">
          {formatBytes(usedBytes)} of {formatBytes(usage.capBytes)} used
        </span>
        <span className="text-app-ink-faint">{percent.toFixed(0)}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-app-surface-muted">
        <div
          className={nearCap ? "h-full rounded-full bg-danger-solid" : "h-full rounded-full bg-app-ink"}
          style={{ width: `${Math.max(2, percent)}%` }}
        />
      </div>
      {nearCap ? <p className="text-xs text-danger-ink">Delete/export old files to save storage</p> : null}
    </button>
  );
}
