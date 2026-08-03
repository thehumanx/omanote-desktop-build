import { useEffect, useState } from "react";
import { OmanoteMark } from "../OmanoteMark";
import { cn } from "../ui";

const DISPLAY_MS = 2000;
const FADE_MS = 300;

/**
 * Shown between the passphrase step and the canvas reveal, once per account.
 * Same `bg-app-canvas` + dot-grid background as the wizard shell, so the cut
 * from the wizard's last frame reads as a continuation rather than a scene
 * change — only the mark itself fades in, holds for `DISPLAY_MS`, then this
 * whole screen fades out as `EncryptionGate` swaps in the (separately
 * fading-in) app.
 */
export function OnboardingLogoReveal({ onDone }: { onDone: () => void }) {
  const [entered, setEntered] = useState(false);
  const [exiting, setExiting] = useState(false);

  const prefersReducedMotion =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (prefersReducedMotion) {
      setEntered(true);
      const doneTimer = window.setTimeout(onDone, DISPLAY_MS);
      return () => window.clearTimeout(doneTimer);
    }

    const frame = window.requestAnimationFrame(() => setEntered(true));
    const exitTimer = window.setTimeout(() => setExiting(true), DISPLAY_MS);
    const doneTimer = window.setTimeout(onDone, DISPLAY_MS + FADE_MS);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(exitTimer);
      window.clearTimeout(doneTimer);
    };
  }, [onDone, prefersReducedMotion]);

  const visible = entered && !exiting;

  return (
    <div
      className={cn(
        "omanote-canvas-grid flex min-h-screen items-center justify-center bg-app-canvas",
        !prefersReducedMotion && "transition-opacity duration-300 ease-in-out",
        visible ? "opacity-100" : "opacity-0",
      )}
    >
      <OmanoteMark size={72} variant="reveal" speed={1750 / DISPLAY_MS} color="#578910" />
    </div>
  );
}
