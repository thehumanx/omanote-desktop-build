import { useEffect, useState } from "react";
import { useUserSettings } from "../../contexts/UserSettingsContext";
import { jsonCodec, readLocalStorageOptional, writeLocalStorage } from "../../lib/local-storage";
import { BACKGROUND_SCENES, DEFAULT_USER_SETTINGS, SCENE_GRAINS, type BackgroundScene, type SceneGrain } from "../../lib/user-settings";

export type SceneSettings = { scene: BackgroundScene; drift: boolean; grain: SceneGrain };

/** Device-level like the stored theme mode, so a reload paints the scene before settings arrive. */
export const SCENE_CACHE_KEY = "omanote:scene";

function isSceneSettings(value: unknown): value is SceneSettings {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    (BACKGROUND_SCENES as readonly unknown[]).includes(candidate.scene) &&
    typeof candidate.drift === "boolean" &&
    (SCENE_GRAINS as readonly unknown[]).includes(candidate.grain)
  );
}

const sceneCodec = jsonCodec(isSceneSettings);

const DEFAULT_SCENE: SceneSettings = {
  scene: DEFAULT_USER_SETTINGS.backgroundScene,
  drift: DEFAULT_USER_SETTINGS.sceneDrift,
  grain: DEFAULT_USER_SETTINGS.sceneGrain,
};

/**
 * The background scene to paint: the synced settings once they've loaded,
 * the last-seen value from this device until then.
 */
export function useSceneSettings(): SceneSettings {
  const { settings, loading } = useUserSettings();
  const [cached] = useState(() => readLocalStorageOptional(SCENE_CACHE_KEY, sceneCodec) ?? DEFAULT_SCENE);
  const scene = settings.backgroundScene;
  const drift = settings.sceneDrift;
  const grain = settings.sceneGrain;

  useEffect(() => {
    if (loading) return;
    writeLocalStorage(SCENE_CACHE_KEY, sceneCodec, { scene, drift, grain });
  }, [loading, scene, drift, grain]);

  return loading ? cached : { scene, drift, grain };
}
