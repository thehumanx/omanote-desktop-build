import type React from "react";
import { replaceSelectionWithLink } from "@omanote/shared";

export type { LinkPasteResult } from "@omanote/shared";
export { normalizeLinkUrl, isSupportedLink, createMarkdownLink, replaceSelectionWithLink } from "@omanote/shared";

export function handlePasteAsLink<T extends HTMLInputElement | HTMLTextAreaElement>(
  event: React.ClipboardEvent<T>,
  value: string,
  onValueChange: (nextValue: string) => void,
) {
  const target = event.currentTarget;
  const selectionStart = target.selectionStart ?? value.length;
  const selectionEnd = target.selectionEnd ?? selectionStart;
  if (selectionStart === selectionEnd) return false;

  const pastedText = event.clipboardData.getData("text/plain");
  const result = replaceSelectionWithLink(value, selectionStart, selectionEnd, pastedText);
  if (!result) return false;

  event.preventDefault();
  onValueChange(result.value);
  window.requestAnimationFrame(() => {
    target.focus();
    target.setSelectionRange(result.selectionStart, result.selectionEnd);
  });
  return true;
}
