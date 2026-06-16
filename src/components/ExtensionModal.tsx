import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { BaseModal } from "./BaseModal";

interface ExtensionModalProps {
  onClose: () => void;
}

export function ExtensionModal({ onClose }: ExtensionModalProps) {
  const [isEntered, setIsEntered] = useState(false);
  const prefersReducedMotion =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    if (prefersReducedMotion) {
      setIsEntered(true);
      return () => {
        document.body.style.overflow = prevBodyOverflow;
        document.documentElement.style.overflow = prevHtmlOverflow;
      };
    }

    const frame = window.requestAnimationFrame(() => setIsEntered(true));

    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, [prefersReducedMotion]);

  return (
    <BaseModal
      onClose={onClose}
      zIndex="z-app-modal"
      className={[
        "touch-none transition-[background-color,opacity] duration-app-slow ease-app-in-out",
        isEntered ? "bg-black/30 opacity-100" : "bg-black/0 opacity-0",
      ].join(" ")}
      backdropProps={{ onClick: onClose }}
    >
        <div
          className={[
            "w-full max-w-sm transform-gpu rounded-2xl border border-app-line bg-app-surface shadow-app-dialog transition-[transform,opacity] duration-app-slow ease-app-in-out",
            isEntered ? "translate-y-0 scale-100 opacity-100" : "translate-y-4 scale-[0.96] opacity-0",
          ].join(" ")}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 pb-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-app-ink-faint">
                Browser extension
              </p>
              <h2 className="text-base font-bold leading-tight text-app-ink">Download omanote extension</h2>
            </div>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-xl text-app-ink-faint transition hover:bg-app-surface-hover hover:text-app-ink-muted"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Divider */}
          <div className="h-px bg-app-surface-muted mx-5" />

          {/* Download buttons */}
          <div className="p-5 flex flex-col gap-3">
            <a
              href="https://chromewebstore.google.com/detail/omanote/foafmfgfdbdiiggmmfdoalgpfhkejbjn"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-app-line bg-app-surface px-4 py-2.5 text-sm font-bold text-app-ink hover:border-app-line-strong hover:bg-app-surface-hover transition-colors shadow-sm"
              onClick={onClose}
            >
              <span className="text-base leading-none">🌐</span>
              Add to Chrome / Chromium
            </a>
            <a
              href="https://addons.mozilla.org/en-US/firefox/addon/omanote/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-app-line bg-app-surface px-4 py-2.5 text-sm font-bold text-app-ink hover:border-app-line-strong hover:bg-app-surface-hover transition-colors shadow-sm"
              onClick={onClose}
            >
              <span className="text-base leading-none">🦊</span>
              Add to Firefox
            </a>
          </div>
        </div>
    </BaseModal>
  );
}
