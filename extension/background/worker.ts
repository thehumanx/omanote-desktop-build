import { registerContextMenus, handleContextMenuClick } from "./context-menus";
import { handleMessage } from "./message-handler";
import { getAuthState, openAuthTab } from "./auth";
import type { ExtMessage } from "../shared/messages";
import { isTrustedRuntimeSender } from "./runtime-sender";

type OpenSaveModalMessage = ExtMessage & {
  _defaultType: "note" | "bookmark" | "todo";
  _content: string;
};

// Register context menus on install and startup
chrome.runtime.onInstalled.addListener(() => {
  registerContextMenus();
});

chrome.runtime.onStartup.addListener(() => {
  registerContextMenus();
});

// Cross-browser async message handling:
// - Return `true` synchronously → tells Chrome to keep the channel open
// - Chain handleMessage to sendResponse → delivers the reply once the Promise resolves
// - Firefox (background.scripts, persistent page) also supports this pattern
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!isTrustedRuntimeSender(sender)) return;
  handleMessage(message as ExtMessage)
    .then(sendResponse)
    .catch(() => sendResponse({ type: "SAVE_ERROR", error: "Internal error" } satisfies ExtMessage));
  return true;
});

// Handle context menu clicks — open the save modal in the active tab
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const capture = handleContextMenuClick(info, tab);
  if (!capture || !tab?.id) return;

  const auth = await getAuthState();
  if (!auth) {
    await openAuthTab();
    return;
  }

  const message: OpenSaveModalMessage = {
    type: "OPEN_SAVE_MODAL",
    context: {
      selectedText: info.selectionText,
      selectedUrl: info.linkUrl ?? info.srcUrl,
      pageUrl: tab.url ?? "",
      pageTitle: tab.title ?? "",
      triggeredBy: "context-menu",
    },
    _defaultType: capture.type,
    _content: capture.content,
  };

  try {
    await chrome.tabs.sendMessage(tab.id, message);
  } catch (err) {
    console.debug("[omanote] content script not ready; trying injection:", err);
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content/index.js"],
      });
      await chrome.tabs.sendMessage(tab.id, message);
    } catch (injectionErr) {
      // Some pages do not allow extension content scripts.
      console.error("[omanote] could not inject save modal content script:", injectionErr);
    }
  }
});

export type { ExtMessage };
