/**
 * Given text and the current cursor position, return the start index and
 * partial query of the emoji shortcode currently being typed (Slack-style
 * `:fire`), or null if the cursor is not inside such a token.
 */
export function findActiveEmojiTrigger(
  text: string,
  cursorPos: number,
): { start: number; partial: string } | null {
  const before = text.slice(0, cursorPos);

  // Walk backwards from cursor to find a ':' preceded by whitespace or start.
  const colonIndex = before.lastIndexOf(":");
  if (colonIndex === -1) return null;

  const charBefore = before[colonIndex - 1];
  if (charBefore !== undefined && !/\s/.test(charBefore)) return null;

  // Everything after ':' up to cursor must be valid shortcode chars.
  const partial = before.slice(colonIndex + 1);
  if (partial.length > 0 && !/^[a-zA-Z0-9_+-]*$/.test(partial)) return null;

  return { start: colonIndex, partial };
}
