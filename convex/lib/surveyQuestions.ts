/**
 * Single source of truth for the in-app product survey.
 *
 * Lives under `convex/lib` (not `src`) because both the React survey UI and the
 * Convex action that emails the results need the question text and option
 * labels. Answers are persisted by `questionId`, so ids must stay stable —
 * changing the wording of a question is fine, renaming its id orphans data.
 */

export type SurveyQuestionKind = "likert" | "single" | "multi" | "text";

export interface SurveyOption {
  /** Stable stored value. */
  value: string;
  label: string;
}

export interface SurveyQuestion {
  id: string;
  kind: SurveyQuestionKind;
  /** Short eyebrow label shown above the question. */
  section: string;
  prompt: string;
  /** Optional supporting line under the prompt. */
  hint?: string;
  options?: readonly SurveyOption[];
  /** When true, a "Something else" input lets the user add their own option. */
  allowOther?: boolean;
  /** Placeholder for `text` questions. */
  placeholder?: string;
  /** Endpoint labels for `likert` questions. */
  scaleLabels?: { low: string; high: string };
}

export const SURVEY_QUESTIONS: readonly SurveyQuestion[] = [
  {
    id: "enjoyment",
    kind: "likert",
    section: "The basics",
    prompt: "How are you enjoying omanote?",
    scaleLabels: { low: "Not much", high: "Love it" },
  },
  {
    id: "frequency",
    kind: "single",
    section: "The basics",
    prompt: "How often do you use omanote?",
    options: [
      { value: "daily", label: "Daily" },
      { value: "few_times_week", label: "A few times a week" },
      { value: "rarely", label: "Rarely" },
      { value: "not_at_all", label: "Not at all" },
    ],
  },
  {
    id: "devices",
    kind: "multi",
    section: "The basics",
    prompt: "Where do you use omanote?",
    hint: "Pick all that apply.",
    options: [
      { value: "web", label: "In a web browser" },
      { value: "desktop", label: "Desktop app (Mac / Windows / Linux)" },
      { value: "android", label: "Android app" },
      { value: "phone_browser", label: "On my phone's browser" },
    ],
  },
  {
    id: "use_cases",
    kind: "multi",
    section: "How you use it",
    prompt: "What do you use omanote for?",
    hint: "Pick all that apply.",
    options: [
      { value: "dumping_thoughts", label: "Dumping thoughts" },
      { value: "tasks", label: "Adding tasks / todos" },
      { value: "links", label: "Saving links" },
      { value: "planning", label: "Planning my day" },
      { value: "journaling", label: "Journaling" },
      { value: "reading", label: "Reading feeds and articles" },
    ],
    allowOther: true,
  },
  {
    id: "favourite_feature",
    kind: "multi",
    section: "How you use it",
    prompt: "What's your favourite feature?",
    hint: "Pick as many as you like.",
    options: [
      { value: "canvas", label: "The canvas — everything in one place" },
      { value: "hashtags", label: "Hashtags linking things together" },
      { value: "quick_capture", label: "Quick capture / composer" },
      { value: "todos_reminders", label: "Todos and reminders" },
      { value: "bookmarks_extension", label: "Bookmarks and the browser extension" },
      { value: "rss_reader", label: "The RSS reader" },
      { value: "encryption", label: "End-to-end encryption / privacy" },
    ],
    allowOther: true,
  },
  {
    id: "note_apps",
    kind: "multi",
    section: "What else you use",
    prompt: "What note-taking apps do you use?",
    hint: "Honest answers help — omanote doesn't have to be the only one.",
    options: [
      { value: "notion", label: "Notion" },
      { value: "obsidian", label: "Obsidian" },
      { value: "apple_notes", label: "Apple Notes" },
      { value: "google_keep", label: "Google Keep" },
      { value: "evernote", label: "Evernote" },
      { value: "none", label: "Only omanote" },
    ],
    allowOther: true,
  },
  {
    id: "todo_apps",
    kind: "multi",
    section: "What else you use",
    prompt: "What todo or task apps do you use?",
    options: [
      { value: "todoist", label: "Todoist" },
      { value: "ticktick", label: "TickTick" },
      { value: "apple_reminders", label: "Apple Reminders" },
      { value: "ms_todo", label: "Microsoft To Do" },
      { value: "things", label: "Things" },
      { value: "none", label: "Only omanote" },
    ],
    allowOther: true,
  },
  {
    id: "rss_reader",
    kind: "single",
    section: "What else you use",
    prompt: "Do you use an RSS reader?",
    options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
      { value: "unknown", label: "I don't know what that is" },
    ],
  },
  {
    id: "google_calendar",
    kind: "single",
    section: "Features you've found",
    prompt: "Have you synced Google Calendar with omanote?",
    options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
      { value: "unknown", label: "I don't know how to do that" },
    ],
  },
  {
    id: "extension",
    kind: "single",
    section: "Features you've found",
    prompt: "Have you installed the omanote browser extension?",
    options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
      { value: "unknown", label: "I didn't know it existed" },
    ],
  },
  {
    id: "pmf",
    kind: "single",
    section: "The honest bit",
    prompt: "How would you feel if omanote disappeared tomorrow?",
    options: [
      { value: "very_disappointed", label: "Very disappointed" },
      { value: "somewhat_disappointed", label: "Somewhat disappointed" },
      { value: "not_disappointed", label: "Not disappointed" },
    ],
  },
  {
    id: "discovery",
    kind: "single",
    section: "The honest bit",
    prompt: "How did you hear about omanote?",
    options: [
      { value: "founder", label: "Founder himself" },
      { value: "friend", label: "A friend" },
      { value: "socials", label: "Found through socials" },
      { value: "search", label: "Search engine" },
    ],
    allowOther: true,
  },
  {
    id: "blocker",
    kind: "text",
    section: "The honest bit",
    prompt: "What stops you from using omanote every day?",
    hint: "Optional, but this one is the most useful answer you can give.",
    placeholder: "Nothing, or… it's missing something I need, it's slow on my phone…",
  },
  {
    id: "improvement",
    kind: "text",
    section: "The honest bit",
    prompt: "What would you improve in omanote?",
    placeholder: "Anything at all — big rewrites and tiny nitpicks both welcome.",
  },
  {
    id: "willingness_to_pay",
    kind: "single",
    section: "Wrapping up",
    prompt: "Would you pay for omanote if there were a paid plan?",
    hint: "There's no paid plan today. This is just to understand what's worth building.",
    options: [
      { value: "yes", label: "Yes" },
      { value: "depends", label: "Maybe — depends on what's included" },
      { value: "no", label: "No, I'd only use it while it's free" },
    ],
  },
  {
    id: "recommend",
    kind: "single",
    section: "Wrapping up",
    prompt: "Would you recommend omanote to others?",
    options: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
      { value: "already", label: "Already have" },
    ],
  },
  {
    id: "interview",
    kind: "single",
    section: "Wrapping up",
    prompt: "Open to a short chat about how you use omanote?",
    hint: "If yes, I'll reach out at your account email. No sales pitch, just questions.",
    options: [
      { value: "yes", label: "Yes, happy to chat" },
      { value: "no", label: "No thanks" },
    ],
  },
] as const;

export const SURVEY_QUESTION_COUNT = SURVEY_QUESTIONS.length;

/** Max characters accepted for a `text` answer or a user-added option. */
export const SURVEY_TEXT_MAX_LENGTH = 1000;
export const SURVEY_OTHER_MAX_LENGTH = 80;

export function findSurveyQuestion(questionId: string): SurveyQuestion | undefined {
  return SURVEY_QUESTIONS.find((question) => question.id === questionId);
}

/** Resolves a stored choice value back to its human label, or itself if user-added. */
export function surveyChoiceLabel(question: SurveyQuestion, value: string): string {
  return question.options?.find((option) => option.value === value)?.label ?? value;
}
