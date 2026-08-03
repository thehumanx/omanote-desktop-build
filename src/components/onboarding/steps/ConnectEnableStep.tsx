import { useEffect, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { ArrowLeft, ArrowRight, Check, Rss } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { useUserSettings } from "../../../contexts/UserSettingsContext";
import { friendlyErrorMessage } from "../../../lib/errors";
import { Button, Switch, cn } from "../../ui";
import { OnboardingFooter } from "../OnboardingChrome";

const EXAMPLE_FEED_URL = "iambishistha.com";
const CONFIG_COUNT = 2;

/**
 * Step 2 — optional Google Calendar connect + RSS enable, both skippable.
 *
 * Google's OAuth callback (`convex/http.ts`) always redirects back to
 * `/settings`, not an arbitrary return path — but `EncryptionGate` gates
 * every route while `isSetup` is false, so that reload shows this wizard
 * regardless of which URL it lands on. This step persists the current step
 * index before navigating away so the wizard resumes here (not step 0)
 * once the page reloads.
 */
export function ConnectEnableStep({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const { settings, updateSettings } = useUserSettings();
  const [configIndex, setConfigIndex] = useState(0);
  const [direction, setDirection] = useState<"next" | "prev">("next");
  const googleConnection = useQuery(api.googleAuth.getConnectionStatus, {});
  const startGoogleConnect = useAction(api.googleAuth.startConnect);
  const [googlePending, setGooglePending] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);

  // Google's OAuth callback appends ?google=connected|error and reloads the
  // page here. "connected" already shows up via the live googleConnection
  // query below, but "error" (declined consent, or a server-side failure)
  // has no other signal — without this, the user just silently sees the
  // connect button again with no explanation. Read it once and strip it so
  // it doesn't linger in the URL or re-fire on a later reload.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const googleResult = params.get("google");
    if (googleResult === null) return;
    if (googleResult === "error") {
      setGoogleError("Google didn't connect. Please try again.");
    }
    params.delete("google");
    const nextSearch = params.toString();
    window.history.replaceState(null, "", window.location.pathname + (nextSearch ? `?${nextSearch}` : ""));
  }, []);

  const discoverFeed = useAction(api.actions.rssFetch.discoverFeed);
  const subscribe = useMutation(api.rss.subscribe);
  const [feedState, setFeedState] = useState<"idle" | "adding" | "added" | "error">("idle");
  const [feedError, setFeedError] = useState<string | null>(null);

  const googleConnected = googleConnection?.connected === true;
  const hasEngaged = googleConnected || settings.rssReaderEnabled;

  function goTo(nextIndex: number, dir: "next" | "prev") {
    setDirection(dir);
    setConfigIndex(nextIndex);
  }

  const isLast = configIndex === CONFIG_COUNT - 1;

  async function handleConnectGoogle() {
    setGoogleError(null);
    setGooglePending(true);
    try {
      // Committed before the full-page navigation so it survives the
      // round trip to Google and back.
      await updateSettings({ onboardingStep: 2 });
      const { url } = await startGoogleConnect({});
      window.location.href = url;
    } catch (err) {
      setGoogleError(friendlyErrorMessage(err, "Could not connect to Google."));
      setGooglePending(false);
    }
  }

  async function handleToggleRss(enabled: boolean) {
    await updateSettings({ rssReaderEnabled: enabled });
  }

  async function handleAddExampleFeed() {
    setFeedState("adding");
    setFeedError(null);
    try {
      const found = await discoverFeed({ url: EXAMPLE_FEED_URL });
      await subscribe({
        feedUrl: found.feedUrl,
        title: found.title,
        siteUrl: found.siteUrl,
        description: found.description,
        faviconUrl: found.faviconUrl,
      });
      setFeedState("added");
    } catch (err) {
      setFeedError(friendlyErrorMessage(err, "Could not add that feed. You can try again from the reader."));
      setFeedState("error");
    }
  }

  return (
    <div>
      <div className="flex flex-col items-center text-center">
        <h1 className="text-2xl font-black text-app-ink">Connect a few things</h1>
        <p className="mt-2 text-sm leading-6 text-app-ink-muted">
          Both optional — you can enable these in Settings later.
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

      <div className="mt-4 min-h-[180px]">
        <div key={configIndex} className={direction === "next" ? "omanote-wizard-step-next" : "omanote-wizard-step-prev"}>
          {configIndex === 0 && (
            <div className="rounded-app-panel border border-app-line bg-app-surface p-4">
              <p className="text-sm font-bold text-app-ink">Google Calendar</p>
              <p className="mt-1 text-xs leading-relaxed text-app-ink-muted">
                Keep todos and events flowing both ways with your Google Calendar.
              </p>
              {googleConnected ? (
                <div className="mt-3 inline-flex items-center gap-1.5 rounded-app-button bg-[#EEF4E4] px-app-field-x py-app-field-y text-sm font-bold text-app-ink">
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#578910]">
                    <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />
                  </span>
                  Connected
                </div>
              ) : (
                <Button
                  type="button"
                  tone="soft"
                  className="mt-3"
                  onClick={() => void handleConnectGoogle()}
                  disabled={googlePending || googleConnection === undefined}
                >
                  {googlePending ? "Connecting…" : "Connect Google Calendar"}
                </Button>
              )}
              {googleError && <p className="mt-2 text-xs text-danger-ink">{googleError}</p>}
            </div>
          )}

          {configIndex === 1 && (
            <div className="rounded-app-panel border border-app-line bg-app-surface p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-app-ink">RSS reader</p>
                  <p className="mt-1 text-xs leading-relaxed text-app-ink-muted">
                    Subscribe to feeds and read articles without leaving omanote.
                  </p>
                </div>
                <Switch checked={settings.rssReaderEnabled} onCheckedChange={(checked) => void handleToggleRss(checked)} />
              </div>
              {settings.rssReaderEnabled && (
                <div className="mt-3 border-t border-app-line pt-3">
                  {feedState === "added" ? (
                    <div className="flex items-center gap-1.5 rounded-app-field border border-app-line bg-[#EEF4E4] px-3 py-1.5 text-xs font-medium text-app-ink">
                      <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#578910]">
                        <Check className="h-2 w-2 text-white" strokeWidth={3} />
                      </span>
                      Added {EXAMPLE_FEED_URL}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void handleAddExampleFeed()}
                      disabled={feedState === "adding"}
                      className="flex items-center gap-1.5 rounded-app-field border border-app-line bg-app-surface-muted px-3 py-1.5 text-xs font-medium text-app-ink-muted transition hover:bg-app-surface-hover hover:text-app-ink disabled:opacity-50"
                    >
                      <Rss className="h-3.5 w-3.5" />
                      {feedState === "adding" ? "Adding…" : `Try it: add ${EXAMPLE_FEED_URL}`}
                    </button>
                  )}
                  {feedError && <p className="mt-2 text-xs text-danger-ink">{feedError}</p>}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <OnboardingFooter>
        <Button
          type="button"
          tone="ghost"
          className="gap-1.5"
          onClick={configIndex === 0 ? onBack : () => goTo(configIndex - 1, "prev")}
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <Button
          type="button"
          className="gap-1.5"
          onClick={isLast ? onNext : () => goTo(configIndex + 1, "next")}
        >
          {isLast ? (hasEngaged ? "Continue" : "Skip for now") : "Next"}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </OnboardingFooter>
    </div>
  );
}
