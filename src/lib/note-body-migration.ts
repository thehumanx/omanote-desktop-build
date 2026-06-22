// Backward compatibility for notes written before TipTap became the default
// editor model. Older textarea flows often used a single newline as a visual
// paragraph separator. In markdown/Tiptap, single newline is a hard break and
// paragraph separation is represented by a blank line.
//
// This normalizer is intentionally conservative:
// - It only upgrades notes that have single newlines with no existing blank
//   lines and no explicit markdown hard-break markers (`\\n`).
// - It skips obvious list content so list formatting stays intact.
export function normalizeLegacyNoteBodyForTiptap(body: string): string {
  const normalized = body.replace(/\r\n?/g, "\n");
  if (!normalized.includes("\n")) return normalized;
  if (normalized.includes("\n\n")) return normalized;
  if (normalized.includes("\\\n")) return normalized;
  if (/(^|\n)\s*(?:[-*+]\s+|\d+\.\s+)/.test(normalized)) return normalized;
  return normalized.split("\n").join("\n\n");
}
