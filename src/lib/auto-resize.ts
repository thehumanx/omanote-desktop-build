/**
 * Grows a textarea to fit its content.
 *
 * Resetting to `auto` first is load-bearing: `scrollHeight` only reports the
 * content height when the element isn't already constrained by a taller
 * explicit height, so without the reset the box can grow but never shrink.
 *
 * Existed as five copies, four byte-identical and one that also tolerated a
 * null element.
 */
export function autoResizeTextArea(element: HTMLTextAreaElement | null | undefined) {
  if (!element) return;
  element.style.height = "auto";
  element.style.height = `${element.scrollHeight}px`;
}
