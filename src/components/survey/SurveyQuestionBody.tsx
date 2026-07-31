import { useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import {
  SURVEY_OTHER_MAX_LENGTH,
  SURVEY_TEXT_MAX_LENGTH,
  type SurveyQuestion,
} from "../../../convex/lib/surveyQuestions";
import { OptionCard, TextArea, TodoCheckmark, cn } from "../ui";

export interface SurveyAnswerDraft {
  choices: string[];
  text?: string;
  rating?: number;
}

const LIKERT_SCALE = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

interface SurveyQuestionBodyProps {
  question: SurveyQuestion;
  answer: SurveyAnswerDraft;
  onChange: (next: SurveyAnswerDraft) => void;
  /** Called when a single-choice answer is picked, so the modal can auto-advance. */
  onCommitAndAdvance: () => void;
}

export function SurveyQuestionBody({
  question,
  answer,
  onChange,
  onCommitAndAdvance,
}: SurveyQuestionBodyProps) {
  const [otherOpen, setOtherOpen] = useState(false);
  const [otherDraft, setOtherDraft] = useState("");
  const otherInputRef = useRef<HTMLInputElement>(null);

  // Reset the "add your own" affordance whenever we move to another question.
  useEffect(() => {
    setOtherOpen(false);
    setOtherDraft("");
  }, [question.id]);

  useEffect(() => {
    if (otherOpen) otherInputRef.current?.focus();
  }, [otherOpen]);

  const knownValues = new Set((question.options ?? []).map((option) => option.value));
  const customChoices = answer.choices.filter((choice) => !knownValues.has(choice));

  function toggleChoice(value: string) {
    if (question.kind === "single") {
      onChange({ ...answer, choices: [value] });
      onCommitAndAdvance();
      return;
    }
    const selected = answer.choices.includes(value);
    onChange({
      ...answer,
      choices: selected
        ? answer.choices.filter((choice) => choice !== value)
        : [...answer.choices, value],
    });
  }

  function addOther() {
    const value = otherDraft.trim().slice(0, SURVEY_OTHER_MAX_LENGTH);
    if (!value) return;
    // Guard against re-adding something already selected, or shadowing a
    // built-in option by typing its exact label.
    const existingOption = question.options?.find(
      (option) => option.label.toLowerCase() === value.toLowerCase(),
    );
    const resolved = existingOption?.value ?? value;
    if (answer.choices.includes(resolved)) {
      setOtherDraft("");
      setOtherOpen(false);
      return;
    }
    onChange({
      ...answer,
      choices: question.kind === "single" ? [resolved] : [...answer.choices, resolved],
    });
    setOtherDraft("");
    setOtherOpen(false);
  }

  if (question.kind === "likert") {
    return (
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
          {LIKERT_SCALE.map((value) => {
            const selected = answer.rating === value;
            return (
              <button
                key={value}
                type="button"
                aria-label={`${value} out of 10`}
                aria-pressed={selected}
                onClick={() => {
                  onChange({ ...answer, rating: value });
                  onCommitAndAdvance();
                }}
                className={cn(
                  "flex aspect-square items-center justify-center rounded-app-panel border text-sm font-bold transition-[background-color,border-color,color,transform] duration-app-fast ease-app-out active:scale-95",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-app-focus/20",
                  selected
                    ? "border-app-line-strong bg-app-ink text-app-surface"
                    : "border-app-line bg-app-surface text-app-ink-muted hover:bg-app-surface-hover hover:text-app-ink",
                )}
              >
                {value}
              </button>
            );
          })}
        </div>
        {question.scaleLabels ? (
          <div className="flex justify-between text-xs text-app-ink-faint">
            <span>{question.scaleLabels.low}</span>
            <span>{question.scaleLabels.high}</span>
          </div>
        ) : null}
      </div>
    );
  }

  if (question.kind === "text") {
    return (
      <div className="flex flex-col gap-1.5">
        <TextArea
          value={answer.text ?? ""}
          onChange={(event) => onChange({ ...answer, text: event.target.value })}
          placeholder={question.placeholder}
          rows={5}
          maxLength={SURVEY_TEXT_MAX_LENGTH}
          className="resize-none"
        />
        {(answer.text?.length ?? 0) > SURVEY_TEXT_MAX_LENGTH - 200 ? (
          <p className="text-right text-xs text-app-ink-faint">
            {answer.text?.length ?? 0}/{SURVEY_TEXT_MAX_LENGTH}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {(question.options ?? []).map((option) => (
        <OptionCard
          key={option.value}
          selected={answer.choices.includes(option.value)}
          onClick={() => toggleChoice(option.value)}
        >
          {option.label}
        </OptionCard>
      ))}

      {/* User-added options mirror OptionCard styling but need a remove affordance,
          which OptionCard has no slot for. */}
      {customChoices.map((choice) => (
        <button
          key={choice}
          type="button"
          aria-label={`Remove ${choice}`}
          onClick={() =>
            onChange({
              ...answer,
              choices: answer.choices.filter((value) => value !== choice),
            })
          }
          className="flex items-center gap-3 rounded-app-panel border border-app-line-strong bg-app-surface-muted px-4 py-3 text-left text-app-ink transition-[background-color,border-color] duration-app-fast ease-app-out hover:bg-app-surface-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-app-focus/20"
        >
          <TodoCheckmark as="span" aria-hidden="true" checked size="sm" />
          <span className="flex-1 truncate text-sm font-medium">{choice}</span>
          <X aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-app-ink-faint" />
        </button>
      ))}

      {question.allowOther ? (
        otherOpen ? (
          <div className="flex gap-2">
            <input
              ref={otherInputRef}
              value={otherDraft}
              onChange={(event) => setOtherDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addOther();
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  event.stopPropagation();
                  setOtherOpen(false);
                  setOtherDraft("");
                }
              }}
              maxLength={SURVEY_OTHER_MAX_LENGTH}
              placeholder="Type your own…"
              className="flex-1 rounded-app-panel border border-app-line bg-app-surface px-4 py-3 text-sm text-app-ink outline-none placeholder:text-app-ink-faint transition-[border-color,box-shadow] duration-app-fast ease-app-out focus:border-app-line-strong focus:ring-2 focus:ring-app-focus/15"
            />
            <button
              type="button"
              onClick={addOther}
              disabled={!otherDraft.trim()}
              className="shrink-0 rounded-app-panel border border-app-line bg-app-surface-muted px-4 text-sm font-bold text-app-ink transition-[background-color,opacity] duration-app-fast ease-app-out hover:bg-app-surface-hover disabled:pointer-events-none disabled:opacity-40"
            >
              Add
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setOtherOpen(true)}
            className="flex items-center gap-2 rounded-app-panel border border-dashed border-app-line px-4 py-3 text-left text-sm font-medium text-app-ink-faint transition-[background-color,border-color,color] duration-app-fast ease-app-out hover:border-app-line-strong hover:bg-app-surface-hover hover:text-app-ink-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-app-focus/20"
          >
            <Plus aria-hidden="true" className="h-4 w-4" />
            Something else
          </button>
        )
      ) : null}
    </div>
  );
}
