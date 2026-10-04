import type { BackgroundScene } from "../../lib/user-settings";

export type SceneId = Exclude<BackgroundScene, "none">;
/** How the scene's horizon is drawn. */
type SceneLand = "hills" | "sea" | "clouds" | "sky" | "night";

/**
 * The background scenes, in picker order. Visual source of truth:
 * docs/superpowers/specs/assets/2026-10-01-horizon-scene-lab.html — colours
 * live in src/index.css under `[data-scene-palette]`.
 */
export const SCENES: readonly { id: SceneId; name: string; land: SceneLand }[] = [
  { id: "morning", name: "Calm morning", land: "hills" },
  { id: "afternoon", name: "Blue afternoon", land: "sea" },
  { id: "clouds", name: "Above the clouds", land: "clouds" },
  { id: "meadow", name: "Evergreen meadow", land: "hills" },
  { id: "evening", name: "Iridescent evening", land: "sky" },
  { id: "night", name: "Silent night", land: "night" },
];

export function sceneLand(id: SceneId): SceneLand {
  return SCENES.find((scene) => scene.id === id)?.land ?? "sky";
}
