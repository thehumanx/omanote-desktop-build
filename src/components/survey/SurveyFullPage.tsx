import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { api } from "../../../convex/_generated/api";
import { SURVEY_QUESTIONS } from "../../../convex/lib/surveyQuestions";
import { useAuth } from "../../app/auth/AuthContext";
import { ModalPortal } from "../ModalPortal";
import { Button } from "../ui";
import { SurveyQuestionBody, type SurveyAnswerDraft } from "./SurveyQuestionBody";

export interface StoredSurveyAnswer {
  questionId: string;
  choices: string[];
  text?: string;
  rating?: number;
}

interface SurveyFullPageProps {
  /** Answers already saved on the server, used to resume a partial survey. */
  initialAnswers: readonly StoredSurveyAnswer[];
  onClose: () => void;
  onCompleted: () => void;
}

const EMPTY_ANSWER: SurveyAnswerDraft = { choices: [] };
/** Long enough to see the checkmark land, short enough not to feel like a wait. */
const AUTO_ADVANCE_MS = 260;

function isAnswered(answer: SurveyAnswerDraft | undefined): boolean {
  if (!answer) return false;
  return answer.choices.length > 0 || Boolean(answer.text?.trim()) || answer.rating !== undefined;
}

/**
 * Full-screen survey, covering the whole viewport like an onboarding step —
 * not a route, just an overlay portaled over whatever's currently showing.
 * Same question flow/persistence as before, just full-page chrome instead of
 * a small dialog card.
 */
export function SurveyFullPage({ initialAnswers, onClose, onCompleted }: SurveyFullPageProps) {
  const { user } = useAuth();
  const saveProgress = useMutation(api.survey.saveProgress);
  const submitSurvey = useMutation(api.survey.submit);

  const [answers, setAnswers] = useState<Record<string, SurveyAnswerDraft>>(() => {
    const seeded: Record<string, SurveyAnswerDraft> = {};
    for (const answer of initialAnswers) {
      seeded[answer.questionId] = {
        choices: answer.choices,
        ...(answer.text === undefined ? {} : { text: answer.text }),
        ...(answer.rating === undefined ? {} : { rating: answer.rating }),
      };
    }
    return seeded;
  });

  // Resume at the first unanswered question rather than restarting.
  const [index, setIndex] = useState(() => {
    const firstUnanswered = SURVEY_QUESTIONS.findIndex(
      (question) => !initialAnswers.some((answer) => answer.questionId === question.id),
    );
    return firstUnanswered === -1 ? SURVEY_QUESTIONS.length - 1 : firstUnanswered;
  });
  const [direction, setDirection] = useState<"next" | "prev">("next");
  const [isEntered, setIsEntered] = useState(false);
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const advanceTimerRef = useRef<number | null>(null);
  const answersRef = useRef(answers);
  answersRef.current = answers;

  // Reserves the tallest question's height for the visible question slot, so
  // switching between a short (likert) and long (multi-choice) question
  // never changes the block's total height — which is what kept shifting
  // the header above and the button row below out of place. Measured once
  // off-screen against every question at blank/default answers.
  const [maxQuestionHeight, setMaxQuestionHeight] = useState<number | null>(null);
  const measureRefs = useRef<Record<string, HTMLDivElement | null>>({});
  useLayoutEffect(() => {
    const heights = SURVEY_QUESTIONS.map((q) => measureRefs.current[q.id]?.offsetHeight ?? 0);
    const max = Math.max(0, ...heights);
    if (max > 0) setMaxQuestionHeight(max);
  }, []);

  const question = SURVEY_QUESTIONS[index]!;
  const isLast = index === SURVEY_QUESTIONS.length - 1;
  const currentAnswer = answers[question.id] ?? EMPTY_ANSWER;
  const answeredCount = useMemo(
    () => SURVEY_QUESTIONS.filter((q) => isAnswered(answers[q.id])).length,
    [answers],
  );

  const prefersReducedMotion =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const effectiveOnClose = status === "success" ? onCompleted : onClose;

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    let frame: number | null = null;
    if (prefersReducedMotion) {
      setIsEntered(true);
    } else {
      frame = window.requestAnimationFrame(() => setIsEntered(true));
    }

    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [prefersReducedMotion]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      effectiveOnClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [effectiveOnClose]);

  useEffect(
    () => () => {
      if (advanceTimerRef.current !== null) window.clearTimeout(advanceTimerRef.current);
    },
    [],
  );

  const toStoredAnswers = useCallback((source: Record<string, SurveyAnswerDraft>) => {
    const stored: StoredSurveyAnswer[] = [];
    for (const q of SURVEY_QUESTIONS) {
      const answer = source[q.id];
      if (!isAnswered(answer)) continue;
      stored.push({
        questionId: q.id,
        choices: answer!.choices,
        ...(answer!.text?.trim() ? { text: answer!.text.trim() } : {}),
        ...(answer!.rating === undefined ? {} : { rating: answer!.rating }),
      });
    }
    return stored;
  }, []);

  // Autosave on navigation rather than on every keystroke — one write per
  // question instead of one per character.
  const persist = useCallback(() => {
    void saveProgress({ answers: toStoredAnswers(answersRef.current) }).catch(() => {
      // Progress saving is best-effort; a failure here must not block the survey.
    });
  }, [saveProgress, toStoredAnswers]);

  const goTo = useCallback(
    (nextIndex: number, dir: "next" | "prev") => {
      if (nextIndex < 0 || nextIndex >= SURVEY_QUESTIONS.length) return;
      setDirection(dir);
      setIndex(nextIndex);
      persist();
    },
    [persist],
  );

  function handleChange(next: SurveyAnswerDraft) {
    setAnswers((prev) => ({ ...prev, [question.id]: next }));
  }

  /** Single-choice and likert answers advance on their own — no Next tap needed. */
  function handleCommitAndAdvance() {
    if (isLast) return;
    if (advanceTimerRef.current !== null) window.clearTimeout(advanceTimerRef.current);
    advanceTimerRef.current = window.setTimeout(() => {
      advanceTimerRef.current = null;
      goTo(index + 1, "next");
    }, AUTO_ADVANCE_MS);
  }

  async function handleSubmit() {
    setStatus("submitting");
    setErrorMessage(null);
    try {
      await submitSurvey({
        answers: toStoredAnswers(answersRef.current),
        email: user?.email || undefined,
        userAgent: navigator.userAgent,
      });
      // `onCompleted` is deliberately NOT called here — it closes the overlay, and
      // the thank-you screen needs to be seen first.
      setStatus("success");
    } catch (error) {
      if (error instanceof ConvexError && typeof error.data === "string") {
        setErrorMessage(error.data);
      }
      setStatus("error");
    }
  }

  const answeredCurrent = isAnswered(currentAnswer);
  // Tracks how far through the question list you are, not how many you've
  // answered — those diverge once you skip a question or come back to an
  // earlier one after answering later ones in a previous session.
  const progress = status === "success" ? 1 : (index + 1) / SURVEY_QUESTIONS.length;

  return (
    <ModalPortal>
      <div
        className={[
          "omanote-canvas-grid fixed inset-0 z-app-modal overflow-y-auto bg-app-canvas transition-opacity duration-app-slow ease-app-in-out",
          isEntered ? "opacity-100" : "opacity-0",
        ].join(" ")}
      >
        {/* Invisible, laid out (not display:none) so offsetHeight is real —
            renders every question at blank answers, at the same width as the
            visible column, purely to measure the tallest one. */}
        <div aria-hidden="true" className="pointer-events-none fixed left-0 top-0" style={{ visibility: "hidden" }}>
          <div className="mx-auto w-full max-w-xl px-4 sm:px-6">
            {SURVEY_QUESTIONS.map((q) => (
              <div
                key={q.id}
                ref={(node) => {
                  measureRefs.current[q.id] = node;
                }}
              >
                <p className="text-base font-bold leading-snug text-app-ink">{q.prompt}</p>
                {q.hint ? <p className="mt-1 text-sm leading-relaxed text-app-ink-muted">{q.hint}</p> : null}
                <div className="mt-4">
                  <SurveyQuestionBody question={q} answer={EMPTY_ANSWER} onChange={() => {}} onCommitAndAdvance={() => {}} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Header, question, and footer flow together as one block and
            center as a unit — no more pinning the header to the very top
            and the footer to the very bottom of the viewport, which read as
            two disconnected pieces stretched too far apart. */}
        <div className="flex min-h-full items-center justify-center px-4 py-16 sm:px-6">
          <div className="w-full max-w-xl">
            {status === "success" ? (
              <SurveySuccess onDone={onCompleted} />
            ) : (
              <>
                <div className="relative pr-12">
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close survey"
                    className="absolute right-0 top-0 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-app-ink-faint transition hover:bg-app-surface-hover hover:text-app-ink"
                  >
                    <X className="h-5 w-5" />
                  </button>
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-app-ink-faint">
                    {question.section}
                  </p>
                  <h1 className="mt-1 text-xl font-bold leading-tight text-app-ink">Help improve omanote</h1>
                </div>
                <div className="mt-5">
                  <div
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={SURVEY_QUESTIONS.length}
                    aria-valuenow={index + 1}
                    aria-label="Survey progress"
                    className="h-1 w-full overflow-hidden rounded-app-chip bg-app-surface-muted"
                  >
                    <div
                      className="h-full rounded-app-chip bg-app-ink transition-[width] duration-app-slow ease-app-out"
                      style={{ width: `${Math.max(progress * 100, 2)}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-app-ink-faint">
                    Question {index + 1} of {SURVEY_QUESTIONS.length}
                  </p>
                </div>

                <div className="mt-8" style={{ minHeight: maxQuestionHeight ?? undefined }}>
                  <div
                    key={question.id}
                    className={
                      prefersReducedMotion
                        ? undefined
                        : direction === "next"
                          ? "omanote-survey-step-next"
                          : "omanote-survey-step-prev"
                    }
                  >
                    <p className="text-base font-bold leading-snug text-app-ink">{question.prompt}</p>
                    {question.hint ? (
                      <p className="mt-1 text-sm leading-relaxed text-app-ink-muted">{question.hint}</p>
                    ) : null}
                    <div className="mt-4">
                      <SurveyQuestionBody
                        question={question}
                        answer={currentAnswer}
                        onChange={handleChange}
                        onCommitAndAdvance={handleCommitAndAdvance}
                      />
                    </div>
                  </div>
                </div>

                {status === "error" ? (
                  <p className="mt-3 text-xs text-danger-ink">
                    {errorMessage ?? "Something went wrong. Please try again."}
                  </p>
                ) : null}

                <div className="mt-8 flex items-center gap-2">
                  <Button
                    tone="ghost"
                    className="gap-1.5 py-2 text-[13px]"
                    onClick={() => goTo(index - 1, "prev")}
                    disabled={index === 0 || status === "submitting"}
                  >
                    <ArrowLeft aria-hidden="true" className="h-3.5 w-3.5" />
                    Back
                  </Button>
                  <div className="flex-1" />
                  {isLast ? (
                    <Button
                      tone="default"
                      className="min-w-[7rem] py-2 text-[13px]"
                      onClick={handleSubmit}
                      disabled={status === "submitting" || answeredCount === 0}
                    >
                      {status === "submitting" ? "Sending…" : "Submit"}
                    </Button>
                  ) : (
                    <Button
                      tone={answeredCurrent ? "default" : "soft"}
                      className="min-w-[7rem] gap-1.5 py-2 text-[13px]"
                      onClick={() => goTo(index + 1, "next")}
                      disabled={status === "submitting"}
                    >
                      {answeredCurrent ? "Next" : "Skip"}
                      <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}

function SurveySuccess({ onDone }: { onDone: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <span className="omanote-survey-check-ring flex h-16 w-16 items-center justify-center rounded-full bg-app-surface-muted">
        <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden="true">
          <path
            className="omanote-survey-check-path"
            d="M7 16.8 13.2 23 25 10.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <p className="mt-1 text-base font-bold text-app-ink">Thank you — genuinely.</p>
      <p className="max-w-[26rem] text-sm leading-relaxed text-app-ink-muted">
        Every answer here gets read. It's what decides what omanote becomes next.
      </p>
      <Button tone="default" className="mt-3 w-full py-2 text-sm" onClick={onDone}>
        Back to omanote
      </Button>
    </div>
  );
}
