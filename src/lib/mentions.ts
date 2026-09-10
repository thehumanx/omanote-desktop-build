// Parsing/highlighting for @email mentions in todo text, used to invite
// guests to the todo's synced Google Calendar event. Mirrors hashtags.ts.

const EMAIL_TOKEN = "[^\\s@]+@[^\\s@]+\\.[^\\s@]+";

/** Extract all unique lowercase @email mentions from a string. */
export function parseMentions(text: string): string[] {
  const re = new RegExp(`(?:^|\\s)@(${EMAIL_TOKEN})`, "g");
  const matches = text.match(re) ?? [];
  return [
    ...new Set(
      matches.map((m) => m.trim().slice(1).toLowerCase()),
    ),
  ];
}

const HIGHLIGHT_RE = new RegExp(`((?:^|\\s)@${EMAIL_TOKEN})`, "g");

/**
 * Split text into segments for rendering a highlight backdrop behind a textarea.
 * Mention segments include any leading whitespace so callers can handle it separately.
 */
export function mentionHighlightSegments(text: string): Array<{ text: string; isMention: boolean; email: string | null }> {
  const parts = text.split(HIGHLIGHT_RE);
  return parts.map((part) => {
    const trimmed = part.trim();
    if (trimmed.startsWith("@") && trimmed.length > 1) {
      return { text: part, isMention: true, email: trimmed.slice(1).toLowerCase() };
    }
    return { text: part, isMention: false, email: null };
  });
}
