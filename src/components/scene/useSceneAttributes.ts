import { useLayoutEffect } from "react";
import type { SceneGrain } from "../../lib/user-settings";
import type { SceneId } from "./scenes";

/**
 * Stamps the active scene on <html> so CSS everywhere — including overlays
 * portaled into <body> — can switch to translucent surfaces, grain and drift.
 * Pass null for no scene; everything is cleared on change and unmount.
 */
export function useSceneAttributes(scene: SceneId | null, drift: boolean, grain: SceneGrain) {
  useLayoutEffect(() => {
    const root = document.documentElement;
    if (!scene) return;
    root.dataset.scene = scene;
    root.dataset.sceneGrain = grain;
    if (drift) delete root.dataset.sceneDrift;
    else root.dataset.sceneDrift = "off";
    return () => {
      delete root.dataset.scene;
      delete root.dataset.sceneGrain;
      delete root.dataset.sceneDrift;
    };
  }, [scene, drift, grain]);
}
