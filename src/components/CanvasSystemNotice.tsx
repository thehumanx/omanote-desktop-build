import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { useNavigate } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { useUpdate } from "../contexts/UpdateContext";
import { jsonCodec, readLocalStorageOptional, writeLocalStorage } from "../lib/local-storage";
import { SurveyFullPage } from "./survey/SurveyFullPage";
import { SurveyPrompt, type SurveyPromptStatus } from "./survey/SurveyPrompt";
import { UpdateNotificationBanner } from "./UpdateNotificationBanner";

type SurveyEligibilityCache = { shouldPrompt: boolean; resuming: boolean };

const SURVEY_ELIGIBILITY_CACHE_KEY = "omanote:survey-eligibility-cache";

function isSurveyEligibilityCache(value: unknown): value is SurveyEligibilityCache {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return typeof v.shouldPrompt === "boolean" && typeof v.resuming === "boolean";
}

const surveyEligibilityCodec = jsonCodec(isSurveyEligibilityCache);

/**
 * The canvas "system notice" slot: the app-update banner and the product
 * survey nudge (and, over time, other product notifications) shown together
 * inline (not as floating popups) — one card each, stacked.
 *
 * The survey row stays in the card the whole time the full-page survey is
 * open (it used to disappear, leaving an orphaned divider) and its status
 * dot tracks not-started → in-progress → completed. Completed shows a
 * thank-you row that either the user dismisses (X) or that quietly goes away
 * on the next reload — there's no dismiss for the ongoing survey itself.
 */
export function CanvasSystemNotice() {
  const navigate = useNavigate();
  const update = useUpdate();
  const storageUsage = useQuery(api.storageUsage.getUsage);
  const surveyResponse = useQuery(api.survey.getMyResponse);
  const [surveyOpen, setSurveyOpen] = useState(false);
  const [surveyCompletedLocally, setSurveyCompletedLocally] = useState(false);
  const [surveyDismissed, setSurveyDismissed] = useState(false);

  // `useQuery` is a real network round-trip and starts as `undefined` on
  // every fresh page load — with nothing else, the survey card would pop in
  // a moment after everything else. Eligibility rarely flips between visits,
  // so paint the last known answer immediately from localStorage and let the
  // live query silently confirm/correct it once it resolves.
  const [cachedEligibility] = useState(() => readLocalStorageOptional(SURVEY_ELIGIBILITY_CACHE_KEY, surveyEligibilityCodec));
  useEffect(() => {
    if (!surveyResponse) return;
    writeLocalStorage(SURVEY_ELIGIBILITY_CACHE_KEY, surveyEligibilityCodec, {
      shouldPrompt: surveyResponse.shouldPrompt,
      resuming: surveyResponse.answers.length > 0,
    });
  }, [surveyResponse]);

  const showUpdateBanner = update.isBannerVisible && !!update.latestVersion;
  const showStorageWarning = storageUsage
    ? (storageUsage.textBytes + storageUsage.imageBytes) / storageUsage.capBytes >= 0.9
    : false;
  const surveyShouldPrompt = surveyResponse ? surveyResponse.shouldPrompt : (cachedEligibility?.shouldPrompt ?? false);
  const surveyResuming = surveyResponse ? surveyResponse.answers.length > 0 : (cachedEligibility?.resuming ?? false);
  const surveyEligible = !surveyCompletedLocally && surveyShouldPrompt;

  const surveyStatus: SurveyPromptStatus | null = surveyCompletedLocally
    ? surveyDismissed
      ? null
      : "completed"
    : surveyEligible
      ? surveyOpen || surveyResuming
        ? "in-progress"
        : "not-started"
      : null;

  const hasNotice = showUpdateBanner || showStorageWarning || surveyStatus !== null;

  return (
    <>
      {hasNotice ? (
        <div className="flex flex-col gap-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-app-ink-faint">omanote updates</p>
          <div className="divide-y divide-app-line overflow-hidden rounded-app-card border border-app-line bg-app-surface">
            {showUpdateBanner ? <UpdateNotificationBanner inline /> : null}
            {showStorageWarning ? (
              <button
                type="button"
                aria-label="storage almost full"
                onClick={() => navigate("/settings", { state: { category: "storage" } })}
                className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors duration-150 hover:bg-app-surface-hover"
              >
                <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-danger-solid" />
                <span className="min-w-0 flex-1 text-sm text-app-ink-muted">
                  <span className="text-app-ink">Storage almost full.</span> Delete/export old files to save storage.
                </span>
              </button>
            ) : null}
            {surveyStatus ? (
              <SurveyPrompt
                status={surveyStatus}
                onTakeSurvey={() => setSurveyOpen(true)}
                onDismiss={() => setSurveyDismissed(true)}
              />
            ) : null}
          </div>
        </div>
      ) : null}
      {surveyOpen && surveyResponse ? (
        <SurveyFullPage
          initialAnswers={surveyResponse.answers}
          onClose={() => setSurveyOpen(false)}
          onCompleted={() => {
            setSurveyCompletedLocally(true);
            setSurveyOpen(false);
          }}
        />
      ) : null}
    </>
  );
}
