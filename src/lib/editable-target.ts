/**
 * Whether an element is somewhere the user is typing.
 *
 * Global keyboard shortcuts and toast dismissal both need this, and it existed
 * as four copies with *three* different answers:
 *
 *   - the two shortcut hooks checked `tagName` plus `isContentEditable`;
 *   - `ToastHost` also walked ancestors with `closest()` and honoured
 *     `[role="textbox"]`;
 *   - `useMobileKeyboardState` respected `disabled`/`readOnly` and excluded
 *     non-text input types.
 *
 * That disagreement was a live bug, not untidiness: a keystroke inside a
 * `[role="textbox"]` or a nested contenteditable wrapper was "not editable" to
 * the shortcut hooks and "editable" to toast suppression, so global navigation
 * and capture shortcuts could fire while the user was typing in those surfaces.
 *
 * Unified on the strictest reading — anything any copy considered editable is
 * editable here. That deliberately suppresses shortcuts in a few places they
 * previously fired, which is the point.
 */

/** `<input type>` values that hold no text, so typing in them isn't writing. */
const NON_TEXT_INPUT_TYPES = new Set([
  "button",
  "checkbox",
  "color",
  "file",
  "hidden",
  "image",
  "radio",
  "range",
  "reset",
  "submit",
]);

/**
 * True when `element` itself accepts text.
 *
 * Disabled and read-only fields are excluded: they hold text but the user
 * cannot be typing into them, so a shortcut is safe to fire.
 */
export function isEditableElement(element: Element | null): element is HTMLElement {
  if (!(element instanceof HTMLElement)) return false;

  if (element instanceof HTMLTextAreaElement) {
    return !element.disabled && !element.readOnly;
  }

  if (element instanceof HTMLInputElement) {
    if (element.disabled || element.readOnly) return false;
    return !NON_TEXT_INPUT_TYPES.has(element.type.toLowerCase());
  }

  if (element instanceof HTMLSelectElement) {
    return !element.disabled;
  }

  // Both, deliberately. `isContentEditable` is the computed property and is the
  // one that's true for descendants of an editable host — but jsdom doesn't
  // implement it, and it's absent in some embedded webviews, so explicit markup
  // is checked too rather than trusting one signal.
  if (element.isContentEditable) return true;
  const contentEditable = element.getAttribute("contenteditable");
  if (contentEditable === "" || contentEditable === "true" || contentEditable === "plaintext-only") {
    return true;
  }

  return element.getAttribute("role") === "textbox";
}

/**
 * True when an event target — or the element it sits inside, or whatever
 * currently has focus — accepts text.
 *
 * The ancestor walk matters for rich-text editors, where the event target is
 * often a descendant span rather than the contenteditable host. Checking
 * `document.activeElement` too covers events that don't originate from the
 * focused field, which is how a global `keydown` on `document` behaves.
 */
export function isEditableTarget(target: EventTarget | null): boolean {
  const fromTarget = target instanceof HTMLElement ? target : null;
  const focused = typeof document !== "undefined" && document.activeElement instanceof HTMLElement
    ? document.activeElement
    : null;

  const candidates: Array<HTMLElement | null> = [fromTarget, focused];
  for (const candidate of candidates) {
    if (candidate === null) continue;
    if (isEditableElement(candidate)) return true;
    // `isEditableElement` is a type guard, so `candidate` would narrow to
    // `never` below if it were reused directly here.
    const host = (candidate as HTMLElement).closest<HTMLElement>(
      "[contenteditable=''], [contenteditable='true'], [contenteditable='plaintext-only'], input, textarea, select, [role='textbox']",
    );
    if (host && isEditableElement(host)) return true;
  }

  return false;
}
