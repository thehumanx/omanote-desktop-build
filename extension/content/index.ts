import { initSelectionBubble, handleOpenModalMessage } from "./selection-bubble";
import type { ExtMessage } from "../shared/messages";

const globalState = globalThis as typeof globalThis & {
  __omanoteSelectionBubbleCleanup?: () => void;
  __omanoteOpenModalListener?: (
    message: ExtMessage & { _defaultType?: string; _content?: string },
  ) => void;
};

globalState.__omanoteSelectionBubbleCleanup?.();
globalState.__omanoteSelectionBubbleCleanup = initSelectionBubble();

if (globalState.__omanoteOpenModalListener) {
  chrome.runtime.onMessage.removeListener(globalState.__omanoteOpenModalListener);
}

// Listen for messages from the background worker (context menu clicks).
// The listener is replaced on every programmatic injection so a page left open
// across extension reloads can reconnect to the new extension context.
const openModalListener = (message: ExtMessage & { _defaultType?: string; _content?: string }) => {
  if (message.type === "OPEN_SAVE_MODAL") {
    handleOpenModalMessage({
      _defaultType: message._defaultType as "note" | "bookmark" | "todo" | undefined,
      _content: message._content,
      context: message.context,
    });
  }
};

globalState.__omanoteOpenModalListener = openModalListener;
chrome.runtime.onMessage.addListener(openModalListener);
