import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { api } from "../../convex/_generated/api";
import { useAuth } from "../app/auth/AuthContext";
import { maskEmail } from "../lib/update-checker";
import { BaseModal } from "./BaseModal";
import { Button, CheckboxField, SegmentedPill } from "./ui";

type FeedbackType = "feedback" | "feature";

const MESSAGE_MAX_LENGTH = 1000;

const TYPE_ITEMS = [
  { key: "feedback" as const, label: "Feedback" },
  { key: "feature" as const, label: "Feature request" },
];

interface FeedbackModalProps {
  onClose: () => void;
}

export function FeedbackModal({ onClose }: FeedbackModalProps) {
  const { user } = useAuth();
  const [isEntered, setIsEntered] = useState(false);
  const [type, setType] = useState<FeedbackType>("feedback");
  const [message, setMessage] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const submitFeedback = useMutation(api.feedback.submit);

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

  async function handleSubmit() {
    if (!message.trim()) return;
    setStatus("submitting");
    setErrorMessage(null);
    try {
      await submitFeedback({
        message: message.trim().slice(0, MESSAGE_MAX_LENGTH),
        type,
        anonymous,
        email: anonymous ? undefined : (user?.email || undefined),
        userAgent: navigator.userAgent,
      });
      setStatus("success");
    } catch (error) {
      if (error instanceof ConvexError && typeof error.data === "string") {
        setErrorMessage(error.data);
      }
      setStatus("error");
    }
  }

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
              Omanote
            </p>
            <h2 className="text-base font-bold leading-tight text-app-ink">Share your thoughts</h2>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-app-ink-faint transition hover:bg-app-surface-hover hover:text-app-ink-muted"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="h-px bg-app-surface-muted mx-5" />

        {status === "success" ? (
          <div className="flex flex-col items-center gap-3 p-8 text-center">
            <span className="text-3xl">🙏</span>
            <p className="font-bold text-app-ink">Thank you!</p>
            <p className="text-sm text-app-ink-muted">Your {type === "feature" ? "feature request" : "feedback"} has been received.</p>
            <Button tone="default" className="mt-2 w-full py-2 text-sm" onClick={onClose}>
              Done
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-4 p-5">
            {/* Type selector */}
            <SegmentedPill
              activeKey={type}
              ariaLabel="Feedback type"
              items={TYPE_ITEMS}
              onChange={(key) => setType(key as FeedbackType)}
              className="self-start"
            />

            {/* Message */}
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={type === "feature" ? "Describe the feature you'd like to see…" : "What's on your mind?"}
              rows={5}
              maxLength={MESSAGE_MAX_LENGTH}
              className="w-full resize-none rounded-xl border border-app-line bg-app-surface-muted px-3 py-2.5 text-sm text-app-ink outline-none placeholder:text-app-ink-faint focus:border-app-line-focus focus:ring-1 focus:ring-app-line-focus"
            />
            {message.length >= MESSAGE_MAX_LENGTH - 200 && (
              <p className="-mt-2 text-right text-xs text-app-ink-faint">
                {message.length}/{MESSAGE_MAX_LENGTH}
              </p>
            )}

            {/* Anonymous toggle */}
            <div className="flex flex-col gap-1">
              <CheckboxField
                checked={anonymous}
                onCheckedChange={setAnonymous}
              >
                Submit anonymously
              </CheckboxField>
              {!anonymous && user?.email && (
                <p className="pl-8 text-xs text-app-ink-faint">
                  Your email ({maskEmail(user.email)}) will be shared so I can follow up.
                </p>
              )}
            </div>

            {status === "error" && (
              <p className="text-xs text-danger-ink">{errorMessage ?? "Something went wrong. Please try again."}</p>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                tone="ghost"
                className="flex-1 py-2 text-sm"
                onClick={onClose}
                disabled={status === "submitting"}
              >
                Cancel
              </Button>
              <Button
                tone="default"
                className="flex-1 py-2 text-sm"
                onClick={handleSubmit}
                disabled={!message.trim() || status === "submitting"}
              >
                {status === "submitting" ? "Sending…" : "Send"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </BaseModal>
  );
}
