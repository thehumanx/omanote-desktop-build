import { useState } from "react";
import { useTheme } from "../../contexts/ThemeContext";
import { useUserSettings } from "../../contexts/UserSettingsContext";
import { SCENE_GRAINS, type SceneGrain, type ThemeMode, type UserSettingsPatch } from "../../lib/user-settings";
import { ScenePicker } from "../scene/ScenePicker";
import { CheckboxField, OptionCard } from "../ui";

const MODES: { mode: ThemeMode; label: string }[] = [
  { mode: "system", label: "System" },
  { mode: "light", label: "Light" },
  { mode: "dark", label: "Dark" },
];

const GRAIN_LABELS: Record<SceneGrain, string> = { off: "Off", faint: "Faint", subtle: "Subtle", medium: "Medium" };

/**
 * Settings → Theme: light/dark mode and the background scene with its drift
 * and grain. Unlike Look & feel there is no draft or Save button — every pick
 * applies straight away, so the scene can be judged live behind the panel.
 */
export function ThemeSettingsPanel({ showHeading }: { showHeading: boolean }) {
  const { themeMode, setThemeMode } = useTheme();
  const { settings, updateSettings } = useUserSettings();
  const [error, setError] = useState<string | null>(null);
  const scene = settings.backgroundScene;

  const save = (patch: UserSettingsPatch) => {
    setError(null);
    void Promise.resolve(updateSettings(patch)).catch(() => setError("We couldn't save that. Please try again."));
  };

  return (
    <section className="space-y-6">
      <div>
        {showHeading ? <h2 className="text-lg font-bold text-app-ink">Theme</h2> : null}
        <p className="mt-1 text-sm leading-6 text-app-ink-muted">Light or dark, and a calm scene behind your notes. Changes apply right away.</p>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-bold text-app-ink">Mode</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {MODES.map((option) => (
            <OptionCard
              key={option.mode}
              selected={themeMode === option.mode}
              onClick={() => {
                setError(null);
                void Promise.resolve(setThemeMode(option.mode)).catch(() => setError("We couldn't save that. Please try again."));
              }}
            >
              {option.label}
            </OptionCard>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-sm font-bold text-app-ink">Background</p>
          <p className="mt-0.5 text-xs text-app-ink-faint">A horizon behind the app, drawn for light and dark.</p>
        </div>
        <ScenePicker value={scene} onSelect={(next) => save({ backgroundScene: next })} />
      </div>

      {scene !== "none" ? (
        <>
          <div className="space-y-2">
            <p className="text-sm font-bold text-app-ink">Motion</p>
            <CheckboxField checked={settings.sceneDrift} onCheckedChange={(checked) => save({ sceneDrift: checked })}>
              Drift — one slow movement in the scene (off when your device asks for reduced motion)
            </CheckboxField>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-bold text-app-ink">Grain</p>
            <div role="group" aria-label="Grain" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {SCENE_GRAINS.map((grain) => (
                <OptionCard
                  key={grain}
                  aria-pressed={settings.sceneGrain === grain}
                  selected={settings.sceneGrain === grain}
                  onClick={() => save({ sceneGrain: grain })}
                >
                  {GRAIN_LABELS[grain]}
                </OptionCard>
              ))}
            </div>
          </div>
        </>
      ) : null}

      {error ? (
        <p role="alert" className="rounded-md border border-danger-line bg-danger-surface px-3 py-2 text-sm text-danger-ink">
          {error}
        </p>
      ) : null}
    </section>
  );
}
