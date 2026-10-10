import { useCallback, useEffect, useRef, useState } from "react";
import { readCanvasDraft, removeCanvasDraft, writeCanvasDraft } from "./canvas-drafts";

function sameValue(a: unknown, b: unknown): boolean {
  return a === b || JSON.stringify(a) === JSON.stringify(b);
}

/** The stored draft, unless it merely repeats the saved value. */
function readDraftOrSource<T>(draftKey: string, sourceValue: T): T {
  const draft = readCanvasDraft(draftKey, sourceValue);
  return sameValue(draft, sourceValue) ? sourceValue : draft;
}

/**
 * A field's value, kept as an encrypted draft while it differs from the saved
 * one (`sourceValue`).
 *
 * Only a real edit is stored. Canvas note and event blocks use this for every
 * item they *display*, and storing the value on mount used to put every note
 * body on screen into the drafts map: a stale copy that hid edits made on other
 * devices, and that grew until localStorage's quota silently stopped every
 * draft from saving. While the value is untouched it follows `sourceValue`, so
 * a change synced from elsewhere shows up.
 */
export function useCanvasDraftValue<T>(draftKey: string, sourceValue: T) {
  const [value, setValue] = useState(() => readDraftOrSource(draftKey, sourceValue));

  // Keep a ref so the draftKey-change effect always sees the latest sourceValue
  // without adding it as a dependency (avoids infinite loops when callers pass
  // new object/array references on every render).
  const sourceValueRef = useRef(sourceValue);
  sourceValueRef.current = sourceValue;
  const previousSourceRef = useRef(sourceValue);

  useEffect(() => {
    setValue(readDraftOrSource(draftKey, sourceValueRef.current));
    previousSourceRef.current = sourceValueRef.current;
  }, [draftKey]);

  // The saved value changed (synced from another device, say): follow it,
  // unless there's an edit in progress.
  useEffect(() => {
    const previous = previousSourceRef.current;
    previousSourceRef.current = sourceValue;
    if (sameValue(previous, sourceValue)) return;
    setValue((current) => (sameValue(current, previous) ? sourceValue : current));
  }, [sourceValue]);

  useEffect(() => {
    if (sameValue(value, sourceValueRef.current)) removeCanvasDraft(draftKey);
    else writeCanvasDraft(draftKey, value);
  }, [draftKey, value]);

  const clearDraft = useCallback(() => {
    removeCanvasDraft(draftKey);
  }, [draftKey]);

  return { value, setValue, clearDraft };
}
