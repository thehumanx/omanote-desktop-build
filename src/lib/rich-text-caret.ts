export function resolveRichTextSourceOffsetFromPoint(
  documentRef: Document,
  clientX: number,
  clientY: number,
  value: string,
) {
  const docWithCaret = documentRef as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };
  const position = docWithCaret.caretPositionFromPoint?.(clientX, clientY);
  const range = position ? null : docWithCaret.caretRangeFromPoint?.(clientX, clientY);
  const offsetNode = position?.offsetNode ?? range?.startContainer;
  const textOffset = position?.offset ?? range?.startOffset ?? 0;
  const offsetElement = offsetNode instanceof Element ? offsetNode : offsetNode?.parentElement;
  const sourceElement = offsetElement?.closest("[data-rich-text-source-start]");
  const sourceStartRaw = sourceElement?.getAttribute("data-rich-text-source-start");
  if (!sourceStartRaw) return undefined;
  const sourceStart = Number.parseInt(sourceStartRaw, 10);
  if (!Number.isFinite(sourceStart)) return undefined;
  return Math.min(value.length, Math.max(0, sourceStart + textOffset));
}
