import { useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useUserSettings } from "../../../contexts/UserSettingsContext";
import type { NavLabelStyle, ThemeMode } from "../../../lib/user-settings";
import { FontFamilyPicker, NavLabelPreview } from "../../../screens/settings-screen-helpers";
import { Button, OptionCard, cn } from "../../ui";
import { OnboardingFooter } from "../OnboardingChrome";

const THEME_OPTIONS: readonly { mode: ThemeMode; label: string }[] = [
  { mode: "system", label: "System" },
  { mode: "light", label: "Light" },
  { mode: "dark", label: "Dark" },
];

const NAV_LABEL_OPTIONS: readonly { value: NavLabelStyle; label: string }[] = [
  { value: "active-label", label: "Active label" },
  { value: "icon-label", label: "Icon & label" },
  { value: "label-only", label: "Label only" },
];

const CONFIG_COUNT = 3;

/**
 * Step 1 — theme, font, and nav label style. Every choice commits immediately
 * via `updateSettings`; there's no draft/Save button here like the persistent
 * Settings screen has, because in a one-time wizard every click already is
 * the save action, and instant feedback is the point of this step.
 *
 * The three configs are shown one at a time (rather than all stacked) to
 * keep this first screen light — each swap reuses the same fade/slide the
 * wizard uses between whole steps, just scoped to this inner panel.
 */
export function MakeItYoursStep({ onNext }: { onNext: () => void }) {
  const { settings, updateSettings } = useUserSettings();
  const [configIndex, setConfigIndex] = useState(0);
  const [direction, setDirection] = useState<"next" | "prev">("next");

  function goTo(nextIndex: number, dir: "next" | "prev") {
    setDirection(dir);
    setConfigIndex(nextIndex);
  }

  const isLast = configIndex === CONFIG_COUNT - 1;

  return (
    <div>
      <div className="flex flex-col items-center text-center">
        <h1 className="text-2xl font-black text-app-ink">Make it yours</h1>
        <p className="mt-2 text-sm leading-6 text-app-ink-muted">
          Customize omanote to make it truly yours — change any of this later in Settings.
        </p>
      </div>

      <div className="mt-8 flex items-center justify-center gap-1.5">
        {Array.from({ length: CONFIG_COUNT }).map((_, i) => (
          <span
            key={i}
            className={cn(
              "h-1.5 rounded-full transition-[width,background-color] duration-app-fast",
              i === configIndex ? "w-5 bg-app-ink" : "w-1.5 bg-app-line-strong",
            )}
          />
        ))}
      </div>

      <div className="mt-4 min-h-[220px]">
        <div key={configIndex} className={direction === "next" ? "omanote-wizard-step-next" : "omanote-wizard-step-prev"}>
          {configIndex === 0 && (
            <div className="space-y-2">
              <p className="text-sm font-bold text-app-ink">Theme</p>
              <div className="grid grid-cols-3 gap-2">
                {THEME_OPTIONS.map((option) => (
                  <OptionCard
                    key={option.mode}
                    selected={settings.themeMode === option.mode}
                    onClick={() => void updateSettings({ themeMode: option.mode })}
                  >
                    {option.label}
                  </OptionCard>
                ))}
              </div>
            </div>
          )}

          {configIndex === 1 && (
            <div className="space-y-2">
              <p className="text-sm font-bold text-app-ink">Typography</p>
              <FontFamilyPicker
                value={settings.fontFamily}
                onSelect={(value) => void updateSettings({ fontFamily: value })}
              />
            </div>
          )}

          {configIndex === 2 && (
            <div className="space-y-2">
              <p className="text-sm font-bold text-app-ink">Navigation labels</p>
              <div className="grid grid-cols-3 gap-2">
                {NAV_LABEL_OPTIONS.map((option) => (
                  <OptionCard
                    key={option.value}
                    selected={settings.navLabelStyle === option.value}
                    onClick={() => void updateSettings({ navLabelStyle: option.value })}
                  >
                    {option.label}
                  </OptionCard>
                ))}
              </div>
              <NavLabelPreview style={settings.navLabelStyle} />
            </div>
          )}
        </div>
      </div>

      <OnboardingFooter>
        {configIndex > 0 ? (
          <Button type="button" tone="ghost" className="gap-1.5" onClick={() => goTo(configIndex - 1, "prev")}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        ) : (
          <span />
        )}
        <Button
          type="button"
          className="gap-1.5"
          onClick={isLast ? onNext : () => goTo(configIndex + 1, "next")}
        >
          {isLast ? "Continue" : "Next"}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </OnboardingFooter>
    </div>
  );
}
