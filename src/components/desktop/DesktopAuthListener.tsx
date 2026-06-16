import { useEffect, useRef } from "react";
import { useSignIn } from "@clerk/react/legacy";
import { isTauri } from "../../lib/desktop";
import { parseDesktopAuthCallback } from "../../lib/desktop-auth";

export type DesktopAuthEvent =
  | { phase: "signing-in" }
  | { phase: "error"; message: string };

export const DESKTOP_AUTH_EVENT = "omanote:desktop-auth";

function emit(detail: DesktopAuthEvent) {
  window.dispatchEvent(new CustomEvent(DESKTOP_AUTH_EVENT, { detail }));
}

const AUTH_STEP_TIMEOUT_MS = 25_000;

/** A hung auth step must surface as an error, not an endless spinner. */
function withTimeout<T>(promise: Promise<T>, step: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${step} timed out. Please try again.`)), AUTH_STEP_TIMEOUT_MS),
    ),
  ]);
}

/** Pulls the human-readable message out of a Clerk API error if present. */
function describeAuthError(err: unknown): string {
  if (err && typeof err === "object") {
    const clerkErrors = (err as { errors?: Array<{ longMessage?: string; message?: string }> }).errors;
    const clerkMessage = clerkErrors?.[0]?.longMessage ?? clerkErrors?.[0]?.message;
    if (clerkMessage) return clerkMessage;
    if (err instanceof Error && err.message) return err.message;
  }
  return "This sign-in link is invalid or has expired. Please try again.";
}

/**
 * Listens for omanote://auth/callback deep links (sent by the website's
 * /auth/desktop page from the system browser) and exchanges the contained
 * Clerk sign-in token for a session. Mounted once at the app root inside
 * the Tauri shell.
 */
export function DesktopAuthListener() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const handlingRef = useRef(false);

  useEffect(() => {
    if (!isTauri() || !isLoaded || !signIn || !setActive) return;

    let unlisten: (() => void) | null = null;
    let cancelled = false;

    async function handleUrls(urls: string[]) {
      for (const url of urls) {
        const callback = parseDesktopAuthCallback(url);
        if (!callback || handlingRef.current) continue;
        handlingRef.current = true;
        emit({ phase: "signing-in" });
        try {
          const result = await withTimeout(
            signIn!.create({ strategy: "ticket", ticket: callback.token }),
            "Creating the session",
          );
          if (result.status === "complete" && result.createdSessionId) {
            await withTimeout(
              setActive!({ session: result.createdSessionId }),
              "Activating the session",
            );
          } else {
            console.error("Desktop sign-in incomplete", result.status, result);
            emit({
              phase: "error",
              message: `Sign-in could not be completed (status: ${result.status ?? "unknown"}). Please try again.`,
            });
          }
        } catch (err) {
          console.error("Desktop sign-in failed", err);
          emit({ phase: "error", message: describeAuthError(err) });
        } finally {
          handlingRef.current = false;
        }
      }
    }

    async function setup() {
      const { getCurrent, onOpenUrl } = await import("@tauri-apps/plugin-deep-link");
      // Cold start: the app may have been launched by the deep link itself.
      try {
        const initial = await getCurrent();
        if (initial && !cancelled) await handleUrls(initial);
      } catch {
        // getCurrent is unsupported on some platforms; the listener covers it.
      }
      const stop = await onOpenUrl((urls) => {
        void handleUrls(urls);
      });
      if (cancelled) {
        stop();
      } else {
        unlisten = stop;
      }
    }

    void setup();
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [isLoaded, signIn, setActive]);

  return null;
}
