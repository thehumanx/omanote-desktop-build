import type { BackgroundScene } from "../../lib/user-settings";
import { cn } from "../ui";
import { SceneBackdrop } from "./SceneBackdrop";
import { SCENES } from "./scenes";

const TILES: readonly { id: BackgroundScene; name: string }[] = [{ id: "none", name: "Off" }, ...SCENES];

/** Off plus every scene as a live thumbnail — shared by Settings → Theme and onboarding. */
export function ScenePicker({
  value,
  onSelect,
  className,
}: {
  value: BackgroundScene;
  onSelect: (scene: BackgroundScene) => void;
  className?: string;
}) {
  return (
    <div role="group" aria-label="Background" className={cn("grid grid-cols-2 gap-3 sm:grid-cols-4", className)}>
      {TILES.map((tile) => {
        const selected = value === tile.id;
        return (
          <button
            key={tile.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onSelect(tile.id)}
            className={cn(
              "flex flex-col gap-2 rounded-app-panel border p-1.5 text-left transition-[border-color,box-shadow] duration-app-fast ease-app-out",
              selected ? "border-app-line-strong ring-1 ring-app-line-strong" : "border-app-line hover:border-app-line-strong",
            )}
          >
            <span className="relative block h-20 overflow-hidden rounded-app-card border border-app-line bg-app-canvas">
              {tile.id === "none" ? null : <SceneBackdrop scene={tile.id} variant="thumb" />}
            </span>
            <span className="px-1 pb-0.5 text-xs font-medium text-app-ink">{tile.name}</span>
          </button>
        );
      })}
    </div>
  );
}
