import { useCallback, useEffect, useRef, useState } from "react";
import { readCanvasDraft, removeCanvasDraft, writeCanvasDraft } from "./canvas-drafts";

export function useCanvasDraftValue<T>(draftKey: string, sourceValue: T) {
  const [value, setValue] = useState(() => readCanvasDraft(draftKey, sourceValue));

  // Keep a ref so the draftKey-change effect always sees the latest sourceValue
  // without adding it as a dependency (avoids infinite loops when callers pass
  // new object/array references on every render).
  const sourceValueRef = useRef(sourceValue);
  sourceValueRef.current = sourceValue;

  useEffect(() => {
    setValue(readCanvasDraft(draftKey, sourceValueRef.current));
  }, [draftKey]);

  useEffect(() => {
    writeCanvasDraft(draftKey, value);
  }, [draftKey, value]);

  const clearDraft = useCallback(() => {
    removeCanvasDraft(draftKey);
  }, [draftKey]);

  return { value, setValue, clearDraft };
}
