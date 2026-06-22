import { useEffect, useState } from "react";
import { PenLine, BookOpen, Bell, CloudOff } from "lucide-react";
import { Button, LoadingSpinner } from "../../components/ui";
import { startDesktopSignIn } from "../../lib/desktop-auth";
import { desktopPlatform } from "../../lib/desktop";
import {
  DESKTOP_AUTH_EVENT,
  type DesktopAuthEvent,
} from "../../components/desktop/DesktopAuthListener";
import { WindowControls } from "../../components/desktop/WindowControls";

type Phase = "idle" | "waiting" | "signing-in" | "error";

const FEATURES = [
  { icon: PenLine, title: "Write", text: "Notes, todos, events, and bookmarks on one canvas." },
  { icon: BookOpen, title: "Read", text: "Follow your favorite feeds in a calm reader." },
  { icon: Bell, title: "Remind", text: "Reminders that pop up right when you need them." },
  { icon: CloudOff, title: "Sync", text: "Everything stays in sync across your devices." },
];

/**
 * First-run screen for the desktop app (shown instead of the website's
 * landing page). Sign-in happens in the system browser; the app waits for
 * the omanote:// deep link to come back.
 */
export function DesktopOnboardingScreen() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const isMac = desktopPlatform() === "macos";

  useEffect(() => {
    function onAuthEvent(event: Event) {
      const detail = (event as CustomEvent<DesktopAuthEvent>).detail;
      if (detail.phase === "signing-in") {
        setPhase("signing-in");
      } else if (detail.phase === "error") {
        setPhase("error");
        setErrorMsg(detail.message);
      }
    }
    window.addEventListener(DESKTOP_AUTH_EVENT, onAuthEvent);
    return () => window.removeEventListener(DESKTOP_AUTH_EVENT, onAuthEvent);
  }, []);

  async function handleSignIn() {
    setErrorMsg("");
    try {
      await startDesktopSignIn();
      setPhase("waiting");
    } catch {
      setPhase("error");
      setErrorMsg("Could not open your browser. Please try again.");
    }
  }

  return (
    <div className="flex h-screen flex-col bg-app-canvas text-app-ink">
      {/* Title-bar strip: draggable, with window controls where the OS has none. */}
      <div
        data-tauri-drag-region
        className="flex h-10 flex-shrink-0 items-center justify-end"
        style={isMac ? { paddingLeft: 80 } : undefined}
      >
        <WindowControls />
      </div>

      <div className="flex flex-1 items-center justify-center overflow-y-auto px-6 pb-10">
        <div className="w-full max-w-md text-center">
          <img
            src="/android-chrome-192x192.png"
            alt=""
            className="mx-auto mb-6 block h-20 w-20 rounded-[22px] shadow-soft"
          />
          <h1 className="text-3xl font-black tracking-tight">Welcome to omanote</h1>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-app-ink-muted">
            Your calm space to write, plan, and read.
          </p>

          <div className="mt-8 grid grid-cols-2 gap-3 text-left">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <div key={title} className="rounded-xl border border-app-line bg-app-surface p-4">
                <Icon className="h-4 w-4 text-app-ink-muted" aria-hidden="true" />
                <p className="mt-2 text-sm font-bold">{title}</p>
                <p className="mt-0.5 text-xs leading-snug text-app-ink-faint">{text}</p>
              </div>
            ))}
          </div>

          <div className="mt-8">
            {phase === "idle" && (
              <Button className="w-full" onClick={() => void handleSignIn()}>
                Sign in or create account
              </Button>
            )}

            {phase === "waiting" && (
              <div className="space-y-3">
                <div className="flex items-center justify-center gap-2.5 text-sm text-app-ink-muted">
                  <LoadingSpinner />
                  <span>Finish signing in using your browser…</span>
                </div>
                <button
                  type="button"
                  className="text-xs font-medium text-app-ink-faint underline underline-offset-2 transition hover:text-app-ink"
                  onClick={() => void handleSignIn()}
                >
                  Browser didn't open? Try again
                </button>
              </div>
            )}

            {phase === "signing-in" && (
              <div className="flex items-center justify-center gap-2.5 text-sm text-app-ink-muted">
                <LoadingSpinner />
                <span>Signing you in…</span>
              </div>
            )}

            {phase === "error" && (
              <div className="space-y-3">
                <p
                  role="alert"
                  className="rounded-md border border-danger-line bg-danger-surface px-3 py-2 text-sm text-danger-ink"
                >
                  {errorMsg || "Something went wrong. Please try again."}
                </p>
                <Button className="w-full" onClick={() => void handleSignIn()}>
                  Try again
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
