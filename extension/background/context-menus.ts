export function registerContextMenus(): void {
  chrome.contextMenus.removeAll(() => {
    // Root menu (shown when text is selected)
    chrome.contextMenus.create({
      id: "omanote-root",
      title: "Save to omanote",
      contexts: ["selection", "link", "image", "page"],
    });

    chrome.contextMenus.create({
      id: "omanote-note",
      parentId: "omanote-root",
      title: "Save as Note",
      contexts: ["selection"],
    });

    chrome.contextMenus.create({
      id: "omanote-todo",
      parentId: "omanote-root",
      title: "Save as Todo",
      contexts: ["selection"],
    });

    chrome.contextMenus.create({
      id: "omanote-bookmark-link",
      parentId: "omanote-root",
      title: "Save Link as Bookmark",
      contexts: ["link"],
    });

    chrome.contextMenus.create({
      id: "omanote-note-with-link",
      parentId: "omanote-root",
      title: "Save Link as Note",
      contexts: ["link"],
    });

    chrome.contextMenus.create({
      id: "omanote-bookmark-page",
      parentId: "omanote-root",
      title: "Save Page as Bookmark",
      contexts: ["page"],
    });

    chrome.contextMenus.create({
      id: "omanote-bookmark-image",
      parentId: "omanote-root",
      title: "Save Image as Bookmark",
      contexts: ["image"],
    });
  });
}

export function handleContextMenuClick(
  info: chrome.contextMenus.OnClickData,
  tab: chrome.tabs.Tab | undefined,
): { type: "note" | "bookmark" | "todo"; content: string; url?: string; pageTitle?: string } | null {
  const pageUrl = tab?.url ?? "";
  const pageTitle = tab?.title ?? "";

  switch (info.menuItemId) {
    case "omanote-note":
      return {
        type: "note",
        content: info.selectionText ?? "",
        url: pageUrl,
        pageTitle,
      };
    case "omanote-todo":
      return {
        type: "todo",
        content: info.selectionText ?? "",
        pageTitle,
      };
    case "omanote-bookmark-link":
      return {
        type: "bookmark",
        content: info.linkUrl ?? "",
        url: info.linkUrl,
        pageTitle: info.linkUrl ?? "",
      };
    case "omanote-note-with-link":
      return {
        type: "note",
        content: `${info.linkUrl ?? ""}\n${info.linkUrl}`,
        url: info.linkUrl,
        pageTitle,
      };
    case "omanote-bookmark-page":
      return {
        type: "bookmark",
        content: pageUrl,
        url: pageUrl,
        pageTitle,
      };
    case "omanote-bookmark-image":
      return {
        type: "bookmark",
        content: info.srcUrl ?? "",
        url: info.srcUrl,
        pageTitle,
      };
    default:
      return null;
  }
}
