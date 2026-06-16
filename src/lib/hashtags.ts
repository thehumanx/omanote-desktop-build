// ---------------------------------------------------------------------------
// Color palette – light bg + darker text of the same hue
// ---------------------------------------------------------------------------

export const HASHTAG_COLORS = [
  { bg: "bg-violet-100", text: "text-violet-700", darkBg: "dark:bg-violet-950/50", darkText: "dark:text-violet-300", svgBg: "#ede9fe", svgText: "#6d28d9", darkSvgBg: "#221043", darkSvgText: "#c4b5fd" },
  { bg: "bg-sky-100", text: "text-sky-700", darkBg: "dark:bg-sky-950/50", darkText: "dark:text-sky-300", svgBg: "#e0f2fe", svgText: "#0369a1", darkSvgBg: "#0b2233", darkSvgText: "#7dd3fc" },
  { bg: "bg-emerald-100", text: "text-emerald-700", darkBg: "dark:bg-emerald-950/50", darkText: "dark:text-emerald-300", svgBg: "#d1fae5", svgText: "#047857", darkSvgBg: "#07201b", darkSvgText: "#6ee7b7" },
  { bg: "bg-amber-100", text: "text-amber-700", darkBg: "dark:bg-amber-950/50", darkText: "dark:text-amber-300", svgBg: "#fef3c7", svgText: "#b45309", darkSvgBg: "#2f1609", darkSvgText: "#fcd34d" },
  { bg: "bg-rose-100", text: "text-rose-700", darkBg: "dark:bg-rose-950/50", darkText: "dark:text-rose-300", svgBg: "#ffe4e6", svgText: "#be123c", darkSvgBg: "#340916", darkSvgText: "#fda4af" },
  { bg: "bg-indigo-100", text: "text-indigo-700", darkBg: "dark:bg-indigo-950/50", darkText: "dark:text-indigo-300", svgBg: "#e0e7ff", svgText: "#4338ca", darkSvgBg: "#181634", darkSvgText: "#a5b4fc" },
  { bg: "bg-teal-100", text: "text-teal-700", darkBg: "dark:bg-teal-950/50", darkText: "dark:text-teal-300", svgBg: "#ccfbf1", svgText: "#0f766e", darkSvgBg: "#082222", darkSvgText: "#5eead4" },
  { bg: "bg-orange-100", text: "text-orange-700", darkBg: "dark:bg-orange-950/50", darkText: "dark:text-orange-300", svgBg: "#ffedd5", svgText: "#c2410c", darkSvgBg: "#2e120b", darkSvgText: "#fdba74" },
  { bg: "bg-pink-100", text: "text-pink-700", darkBg: "dark:bg-pink-950/50", darkText: "dark:text-pink-300", svgBg: "#fce7f3", svgText: "#be185d", darkSvgBg: "#360a1c", darkSvgText: "#f9a8d4" },
  { bg: "bg-lime-100", text: "text-lime-700", darkBg: "dark:bg-lime-950/50", darkText: "dark:text-lime-300", svgBg: "#ecfccb", svgText: "#4d7c0f", darkSvgBg: "#16220a", darkSvgText: "#bef264" },
];

export type HashtagColor = { bg: string; text: string; darkBg: string; darkText: string; svgBg: string; svgText: string; darkSvgBg: string; darkSvgText: string };

// ---------------------------------------------------------------------------
// Deterministic color index from hashtag name
// ---------------------------------------------------------------------------

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function hashtagColorIndex(name: string): number {
  return simpleHash(name.toLowerCase()) % HASHTAG_COLORS.length;
}

export function hashtagColor(name: string): HashtagColor {
  return HASHTAG_COLORS[hashtagColorIndex(name)];
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/** Extract all unique lowercase hashtag names from a string. */
export function parseHashtags(text: string): string[] {
  const matches = text.match(/(?:^|\s)#([a-zA-Z]\w*)/g) ?? [];
  return [
    ...new Set(
      matches.map((m) => {
        const tag = m.trim();
        return (tag.startsWith("#") ? tag.slice(1) : tag.slice(1)).toLowerCase();
      }),
    ),
  ];
}

const HIGHLIGHT_RE = /((?:^|\s)#[a-zA-Z]\w*)/g;

/**
 * Split text into segments for rendering a highlight backdrop behind a textarea.
 * Hashtag segments include any leading whitespace so callers can handle it separately.
 */
export function hashtagHighlightSegments(text: string): Array<{ text: string; isHashtag: boolean; name: string | null }> {
  const parts = text.split(HIGHLIGHT_RE);
  return parts.map((part) => {
    const trimmed = part.trim();
    if (trimmed.startsWith("#") && trimmed.length > 1) {
      return { text: part, isHashtag: true, name: trimmed.slice(1) };
    }
    return { text: part, isHashtag: false, name: null };
  });
}

/**
 * Given the textarea value and the current cursor position, return the start
 * index and partial text of the hashtag currently being typed, or null if the
 * cursor is not inside a hashtag token.
 */
export function findActiveHashtag(
  text: string,
  cursorPos: number,
): { start: number; partial: string } | null {
  const before = text.slice(0, cursorPos);

  // Walk backwards from cursor to find a '#' preceded by whitespace or start
  const hashIndex = before.lastIndexOf("#");
  if (hashIndex === -1) return null;

  // The character right before '#' must be whitespace or it must be at the start
  const charBefore = before[hashIndex - 1];
  if (charBefore !== undefined && !/\s/.test(charBefore)) return null;

  // Everything after '#' up to cursor must be valid word chars (letters/digits/underscore)
  // and must start with a letter
  const partial = before.slice(hashIndex + 1);
  if (partial.length > 0 && !/^[a-zA-Z]\w*$/.test(partial)) return null;

  return { start: hashIndex, partial };
}
