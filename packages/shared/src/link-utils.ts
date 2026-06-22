export type LinkPasteResult = {
  handled: boolean;
  value: string;
  selectionStart: number;
  selectionEnd: number;
};

export function normalizeLinkUrl(input: string) {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : guessHttpsUrl(trimmed);
  if (!candidate) return null;

  try {
    const parsed = new URL(candidate);
    if (
      parsed.protocol !== "http:" &&
      parsed.protocol !== "https:" &&
      parsed.protocol !== "mailto:" &&
      parsed.protocol !== "tel:"
    ) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

export function isSupportedLink(input: string) {
  return Boolean(normalizeLinkUrl(input));
}

export function createMarkdownLink(text: string, url: string) {
  return `[${text}](${url})`;
}

export function replaceSelectionWithLink(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  pastedText: string,
): LinkPasteResult | null {
  if (selectionStart === selectionEnd) return null;

  const normalizedUrl = normalizeLinkUrl(pastedText);
  if (!normalizedUrl) {
    const nextValue = `${value.slice(0, selectionStart)}${pastedText}${value.slice(selectionEnd)}`;
    return {
      handled: true,
      value: nextValue,
      selectionStart,
      selectionEnd: selectionStart + pastedText.length,
    };
  }

  const selectedText = value.slice(selectionStart, selectionEnd);
  const linkedText = selectedText || normalizedUrl;
  const markdown = createMarkdownLink(linkedText, normalizedUrl);
  const nextValue = `${value.slice(0, selectionStart)}${markdown}${value.slice(selectionEnd)}`;
  return {
    handled: true,
    value: nextValue,
    selectionStart: selectionStart + 1,
    selectionEnd: selectionStart + 1 + linkedText.length,
  };
}

function guessHttpsUrl(input: string) {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (/\s/.test(trimmed)) return null;
  if (!/[.]/.test(trimmed)) return null;
  if (trimmed.startsWith(".") || trimmed.endsWith(".")) return null;
  return `https://${trimmed}`;
}
