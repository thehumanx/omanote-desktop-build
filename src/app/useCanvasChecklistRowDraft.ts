import { useCallback } from "react";
import { useCanvasDraftValue } from "./useCanvasDraftValue";

export function useCanvasChecklistRowDraft(draftKey: string, textValue: string, checkedValue: boolean) {
  const { value: text, setValue: setText, clearDraft: clearTextDraft } = useCanvasDraftValue(`${draftKey}:text`, textValue);
  const { value: checked, setValue: setChecked, clearDraft: clearCheckedDraft } = useCanvasDraftValue(`${draftKey}:checked`, checkedValue);

  const clearDrafts = useCallback(() => {
    clearTextDraft();
    clearCheckedDraft();
  }, [clearCheckedDraft, clearTextDraft]);

  return { text, setText, checked, setChecked, clearDrafts };
}
