import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { SurveyModal } from "./SurveyModal";
import { SurveyPrompt } from "./SurveyPrompt";

/**
 * Decides whether to nudge the user about the product survey.
 *
 * Eligibility (account age, not-yet-completed) is computed server-side in
 * `survey.getMyResponse`. "Not now" is intentionally held in component state
 * rather than storage: the prompt disappears for the rest of the session and
 * comes back on the next app load, and keeps coming back until the survey is
 * actually submitted.
 */
export function SurveyGate() {
  const response = useQuery(api.survey.getMyResponse);
  const [modalOpen, setModalOpen] = useState(false);
  const [dismissedThisSession, setDismissedThisSession] = useState(false);
  const [completedLocally, setCompletedLocally] = useState(false);

  if (response === undefined || response === null) return null;

  // Checked before `shouldPrompt`: submitting flips `shouldPrompt` to false, and
  // unmounting there would rip away the thank-you screen mid-animation.
  if (modalOpen) {
    return (
      <SurveyModal
        initialAnswers={response.answers}
        onClose={() => setModalOpen(false)}
        onCompleted={() => {
          setCompletedLocally(true);
          setModalOpen(false);
        }}
      />
    );
  }

  if (completedLocally || !response.shouldPrompt) return null;
  if (dismissedThisSession) return null;

  return (
    <SurveyPrompt
      resuming={response.answers.length > 0}
      onTakeSurvey={() => setModalOpen(true)}
      onNotNow={() => setDismissedThisSession(true)}
    />
  );
}
