import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { BaseModal } from "./BaseModal";

interface FounderNoteModalProps {
  open: boolean;
  onClose: () => void;
}

const founderNoteParagraphs = [
  "Hello there! 👋",
  "Welcome to omanote — and genuinely, thank you for being here.",
  "I didn't build this because the world needed another note-taking app (spoiler: it didn't 😅). And honestly? Not just to flex that I could build one either (okay, maybe a little; vibe-coding is real and it's fun). I built omanote because no existing app quite matched the way my brain actually works.",
  "Here's the thing: my mind is chaotic. Beautifully, exhaustingly chaotic. Throughout the day, thoughts appear out of nowhere. A task I'd have completely forgotten a second later. A moment I want to hold onto. An article worth saving for future-me. A random idea in the middle of something else that feels important.",
  "There are apps for all of this. Many, and better, actually. But they're scattered and setting each of them up meticulously is a work on its own. I just wanted one place to drop everything, right at the moment it happens.",
  "For me, that's omanote. No setup, no learning curve. Just type.",
  "I call it a canvas: your day's mental dumping ground (the good kind). Everything you capture lands here: notes, todos, bookmarks, events — I call them artifacts. Each type has its own tidy home, but they all live on one canvas. Want to connect things across? Use #hashtags — they're the threads that tie your thinking together.",
  "So it is opinionated, very much on purpose to work just the way I am. And should you choose to customize, there are handful of settings to make it feel more like you.",
  "Oh — and there's a browser extension too. Save anything from any tab, right into your canvas. No friction. And everything stays completely private. Always.",
  "And a nice little RSS reader too, just so you don't have to go somewhere else to read your favorite authors.",
  "I genuinely hope omanote becomes a quiet little corner of your day, the same way it became one for mine. It's not here to compete with the big, polished, better-funded apps (they're great — use them if they work for you!). This one's just built with a lot of care, for a very particular kind of mind.",
  "Thanks for giving it a shot. Truly. 🙏",
  "If you've got feedback, just head to your profile — I'm always listening.",
];

export function FounderNoteModal({ open, onClose }: FounderNoteModalProps) {
  const [isEntered, setIsEntered] = useState(false);

  const prefersReducedMotion =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (!open) {
      setIsEntered(false);
      return;
    }

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    if (prefersReducedMotion) {
      setIsEntered(true);
      return () => {
        document.body.style.overflow = previousBodyOverflow;
        document.documentElement.style.overflow = previousHtmlOverflow;
      };
    }

    const frame = window.requestAnimationFrame(() => setIsEntered(true));
    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [open, prefersReducedMotion]);

  const signatureLines = useMemo(
    () => ["With love,", "Bibek", "Maker of omanote"],
    [],
  );

  if (!open) return null;

  return (
    <BaseModal
      onClose={onClose}
      zIndex="z-app-modal"
      className={[
        "touch-none bg-black/30 px-4 py-6 transition-[background-color,opacity] duration-app-slow ease-app-in-out",
        isEntered ? "opacity-100" : "opacity-0",
      ].join(" ")}
      backdropProps={{ onClick: onClose }}
    >
      <div
        className={[
          "founder-note-card relative flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-black/5 shadow-[0_24px_60px_rgba(0,0,0,0.16)] transition-[transform,opacity] duration-app-slow ease-app-in-out dark:border-white/10 dark:shadow-[0_24px_60px_rgba(0,0,0,0.42)]",
          isEntered ? "translate-y-0 scale-100 opacity-100" : "translate-y-4 scale-[0.98] opacity-0",
        ].join(" ")}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-6 top-6 z-10 flex h-9 w-9 items-center justify-center rounded-full text-app-ink-faint transition hover:bg-black/5 hover:text-app-ink-muted dark:hover:bg-white/5"
          aria-label="Close founder note"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="founder-note-body max-h-[85dvh] overflow-y-auto px-6 pb-6 pt-[2.5rem]">
          <div className="pl-8 pr-10 pb-[2.5rem]">
            <p className="text-[11px] font-bold uppercase leading-[2.5rem] tracking-[0.2em] text-app-ink-faint/80">
              From the founder
            </p>
            <h2 className="text-xl font-bold leading-[2.5rem] text-app-ink">A note from Bibek</h2>
          </div>

          <div className="space-y-[2.5rem] pl-8 pr-1 text-[15px] leading-[2.5rem] text-app-ink-muted sm:text-[15px]">
            {founderNoteParagraphs.map((paragraph) => (
              <p
                key={paragraph}
                className={[
                  "founder-note-paragraph max-w-[64ch]",
                  paragraph === founderNoteParagraphs[0] ? "text-[17px] font-bold text-app-ink" : "text-app-ink-muted",
                ].join(" ")}
              >
                {paragraph}
              </p>
            ))}
            <div className="mt-[2.5rem] space-y-0 text-[15px] leading-[2.5rem] text-app-ink-muted">
              {signatureLines.map((line, index) => (
                <p key={line} className={`founder-note-paragraph ${index === 1 ? "font-bold text-app-ink" : "text-app-ink-muted"}`}>
                  {line}
                </p>
              ))}
            </div>
          </div>
        </div>
      </div>
    </BaseModal>
  );
}
