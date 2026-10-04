import { useState } from "react";
import { Check } from "lucide-react";
import { Link } from "react-router-dom";
import { currentVersion as bundledVersion } from "virtual:changelog";
import { SceneBackdrop } from "./scene/SceneBackdrop";
import { SCENES } from "./scene/scenes";
import { Tooltip, cn } from "./ui";
import { color } from "../design-system/tokens";
import { enumCodec, readLocalStorage, writeLocalStorage } from "../lib/local-storage";
import { BACKGROUND_SCENES, type BackgroundScene } from "../lib/user-settings";

const currentVersion = bundledVersion?.version ?? "v0.9";
const desktopAppReleaseUrl = "https://github.com/thehumanx/omanote-releases/releases/latest";

/** Visitors' footer scene, per browser. Separate from the signed-in app's synced scene setting.
 *  Defaults to Evergreen meadow, the closest match to the brand green. */
export const SITE_SCENE_KEY = "omanote:site-scene";
const siteSceneCodec = enumCodec(BACKGROUND_SCENES);
const SWATCHES: readonly { id: BackgroundScene; name: string }[] = [{ id: "none", name: "Off" }, ...SCENES];

function FooterScenePicker({ value, onSelect }: { value: BackgroundScene; onSelect: (scene: BackgroundScene) => void }) {
  return (
    <div role="group" aria-label="Footer background" className="mt-3 inline-flex items-center gap-1 rounded-full border border-app-line bg-app-surface/40 p-1">
      {SWATCHES.map((swatch) => {
        const selected = value === swatch.id;
        return (
          <Tooltip key={swatch.id} label={swatch.name}>
            <button
              type="button"
              aria-label={swatch.name}
              aria-pressed={selected}
              onClick={() => onSelect(swatch.id)}
              className="omanote-scene-swatch relative flex h-5 w-5 items-center justify-center overflow-hidden rounded-full border border-app-line bg-app-surface transition-colors duration-app-fast ease-app-out hover:border-app-line-strong"
            >
              {swatch.id === "none" ? null : <SceneBackdrop scene={swatch.id} variant="thumb" />}
              {selected ? (
                <Check aria-hidden="true" strokeWidth={3.5} className="relative h-3 w-3" style={{ color: color.brandCta }} />
              ) : null}
            </button>
          </Tooltip>
        );
      })}
    </div>
  );
}

/**
 * The public site's footer: landing, privacy and terms.
 *
 * One component so the pages can't drift — privacy and terms used to carry
 * their own hand-copied older layout, which fell behind every time the
 * landing footer changed.
 *
 * The background scene is one screen tall and reaches up behind the page
 * above, at z-index -1 — so the page wrapper must be `isolate`, or the
 * wrapper's own fill paints over it.
 */
export function SiteFooter() {
  const year = new Date().getFullYear();
  const [scene, setScene] = useState<BackgroundScene>(() => readLocalStorage(SITE_SCENE_KEY, siteSceneCodec, "meadow"));
  const selectScene = (next: BackgroundScene) => {
    setScene(next);
    writeLocalStorage(SITE_SCENE_KEY, siteSceneCodec, next);
  };
  // Over a full-strength scene only full ink holds AA (scene-contrast.test.ts).
  const quiet = scene === "none" ? "text-app-ink-faint" : "text-app-ink";
  const quietHover = scene === "none" ? "hover:text-app-ink-muted" : "hover:text-app-ink";

  return (
    <footer className="relative">
      {scene === "none" ? null : <SceneBackdrop scene={scene} variant="footer" />}
      <div className="relative max-w-[1136px] mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <div className="flex flex-col sm:flex-row items-start justify-between gap-8">
          {/* Left: identity, blurbs, copyright — all text copy lives here. */}
          <div>
            <div className="flex items-center gap-2">
              <Link to="/">
                <img src="/logo.svg" alt="omanote home" className="h-5 w-auto" />
              </Link>
              <Link
                to="/updates"
                className="rounded-full border border-app-line bg-app-canvas px-2 py-0.5 text-[10px] font-bold text-app-ink-muted hover:border-app-line-strong hover:text-app-ink-muted transition-colors duration-app-fast ease-app-out cursor-pointer"
              >
                {currentVersion}
              </Link>
            </div>
            <p className={`mt-2.5 text-xs ${quiet} leading-relaxed max-w-[300px]`}>
              Personal notetaking app of{" "}
              <a
                href="https://iambishistha.com"
                target="_blank"
                rel="noopener noreferrer"
                className={`omanote-link ${quietHover} transition-colors duration-app-fast ease-app-out`}
              >
                iambishistha.com
              </a>
              .
              <span className="block">Built for personal use, shared publicly.</span>
            </p>
            <p className={cn("mt-3 text-xs", quiet)}>© {year} omanote. All rights reserved.</p>
            <FooterScenePicker value={scene} onSelect={selectScene} />
          </div>
    
          {/* Right: link groups only. */}
          <div className="flex gap-12">
            <div className="flex flex-col gap-2.5">
              <p className={`text-[10px] font-bold uppercase ${quiet}`}>Product</p>
              <a
                href="https://omanote.com/s/FeUM44Rd"
                target="_blank"
                rel="noopener noreferrer"
                className={`text-xs ${quiet} omanote-link ${quietHover} transition-colors duration-app-fast ease-app-out`}
              >
                Roadmap
              </a>
              <Link
                to="/guide"
                className={`text-xs ${quiet} omanote-link ${quietHover} transition-colors duration-app-fast ease-app-out`}
              >
                Guide
              </Link>
              <Link
                to="/updates"
                className={`text-xs ${quiet} omanote-link ${quietHover} transition-colors duration-app-fast ease-app-out`}
              >
                Changelog
              </Link>
              <a
                href={desktopAppReleaseUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`text-xs ${quiet} omanote-link ${quietHover} transition-colors duration-app-fast ease-app-out`}
              >
                Desktop app
              </a>
            </div>
            <div className="flex flex-col gap-2.5">
              <p className={`text-[10px] font-bold uppercase ${quiet}`}>Legal</p>
              <Link
                to="/privacy"
                className={`text-xs ${quiet} omanote-link ${quietHover} transition-colors duration-app-fast ease-app-out`}
              >
                Privacy
              </Link>
              <Link
                to="/terms"
                className={`text-xs ${quiet} omanote-link ${quietHover} transition-colors duration-app-fast ease-app-out`}
              >
                Terms
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
