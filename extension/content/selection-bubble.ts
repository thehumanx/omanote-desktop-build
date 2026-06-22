import { BUBBLE_CSS } from "./bubble-styles";
import { findTargetByName, selectPreferredTargetId, sortTargetsByName, type NamedTarget } from "../shared/folder-selection";
import type { ExtMessage } from "../shared/messages";
import type { BookmarkCategory, NoteFolder, SavePayload } from "../shared/types";
import { getBlockedSites, normalizeBlockedSiteOrigin } from "../shared/storage";

type SaveType = SavePayload["type"];

interface ModalState {
  type: SaveType;
  content: string;
  url: string;
  pageTitle: string;
  folderId: string;
  categoryId: string;
  hashtags: string;
  includeUrl: boolean;
  folders: NoteFolder[];
  categories: BookmarkCategory[];
  newFolderName: string;
  newCategoryName: string;
  creatingTarget: "folder" | "category" | null;
  saving: boolean;
  saved: boolean;
  error: string;
}

let host: HTMLElement | null = null;
let shadow: ShadowRoot | null = null;
let bubbleEl: HTMLElement | null = null;
let overlayEl: HTMLElement | null = null;
let modalState: ModalState | null = null;
let bubbleTimeout: ReturnType<typeof setTimeout> | null = null;
let lastSelectionRect: DOMRect | null = null;
let modalAnchorRect: DOMRect | null = null;
let modalPositionStyle: { top: string; left: string; placement: ModalPlacement } | null = null;
let typeTabHighlightStyle: {
  transform: string;
  width: string;
  height: string;
  opacity: string;
} | null = null;

const BUBBLE_OFFSET = 8;
const BUBBLE_WIDTH = 180;
const BUBBLE_HEIGHT = 36;
const VIEWPORT_PADDING = 8;
const MODAL_OFFSET = 12;
const MODAL_WIDTH = 360;
const MODAL_FALLBACK_HEIGHT = 420;

type ModalPlacement = "top" | "bottom" | "left" | "right";

let scrollLockState: {
  bodyOverflow: string;
  documentOverflow: string;
} | null = null;
let extensionContextInvalidated = false;
let blockedSites: string[] = [];

export function calculateBubblePosition(
  rect: DOMRect,
  options: {
    viewportWidth: number;
    scrollX: number;
    scrollY: number;
    bubbleWidth?: number;
    bubbleHeight?: number;
  },
): { top: number; left: number } {
  const bubbleWidth = options.bubbleWidth ?? BUBBLE_WIDTH;
  const bubbleHeight = options.bubbleHeight ?? BUBBLE_HEIGHT;
  let top = rect.top - bubbleHeight - BUBBLE_OFFSET;
  let left = rect.left;

  if (top < VIEWPORT_PADDING) top = rect.bottom + BUBBLE_OFFSET;
  if (left + bubbleWidth > options.viewportWidth - VIEWPORT_PADDING) {
    left = options.viewportWidth - bubbleWidth - VIEWPORT_PADDING;
  }
  if (left < VIEWPORT_PADDING) left = VIEWPORT_PADDING;

  return {
    top: top + options.scrollY,
    left: left + options.scrollX,
  };
}

export function shouldSuppressSelectionBubbleForUrl(url: string, sites: string[]): boolean {
  const origin = normalizeBlockedSiteOrigin(url);
  return Boolean(origin && sites.includes(origin));
}

function clamp(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.min(Math.max(value, min), max);
}

export function calculateModalPosition(
  rect: DOMRect,
  options: {
    viewportWidth: number;
    viewportHeight: number;
    modalWidth?: number;
    modalHeight?: number;
  },
): { top: number; left: number; placement: ModalPlacement } {
  const modalWidth = options.modalWidth ?? MODAL_WIDTH;
  const modalHeight = options.modalHeight ?? MODAL_FALLBACK_HEIGHT;
  const centeredLeft = rect.left + rect.width / 2 - modalWidth / 2;
  const centeredTop = rect.top + rect.height / 2 - modalHeight / 2;
  const clampedLeft = clamp(centeredLeft, VIEWPORT_PADDING, options.viewportWidth - modalWidth - VIEWPORT_PADDING);
  const clampedTop = clamp(centeredTop, VIEWPORT_PADDING, options.viewportHeight - modalHeight - VIEWPORT_PADDING);

  if (rect.top >= modalHeight + MODAL_OFFSET + VIEWPORT_PADDING) {
    return {
      top: rect.top - modalHeight - MODAL_OFFSET,
      left: clampedLeft,
      placement: "top",
    };
  }

  if (options.viewportHeight - rect.bottom >= modalHeight + MODAL_OFFSET + VIEWPORT_PADDING) {
    return {
      top: rect.bottom + MODAL_OFFSET,
      left: clampedLeft,
      placement: "bottom",
    };
  }

  if (options.viewportWidth - rect.right >= modalWidth + MODAL_OFFSET + VIEWPORT_PADDING) {
    return {
      top: clampedTop,
      left: rect.right + MODAL_OFFSET,
      placement: "right",
    };
  }

  if (rect.left >= modalWidth + MODAL_OFFSET + VIEWPORT_PADDING) {
    return {
      top: clampedTop,
      left: rect.left - modalWidth - MODAL_OFFSET,
      placement: "left",
    };
  }

  return {
    top: clampedTop,
    left: clampedLeft,
    placement: "bottom",
  };
}

export function isEventFromExtensionRoot(event: Pick<Event, "target" | "composedPath">, root: HTMLElement | null): boolean {
  if (!root) return false;
  if (event.target === root) return true;
  const path = typeof event.composedPath === "function" ? event.composedPath() : [];
  return path.includes(root);
}

export function isExtensionContextInvalidatedError(error: unknown): boolean {
  return error instanceof Error && /Extension context invalidated/i.test(error.message);
}

function disableStaleContentScript(): void {
  extensionContextInvalidated = true;
  if (bubbleTimeout) {
    clearTimeout(bubbleTimeout);
    bubbleTimeout = null;
  }
  closeModal();
  host?.remove();
  host = null;
  shadow = null;
  bubbleEl = null;
  overlayEl = null;
  lastSelectionRect = null;
}

function handleExtensionContextError(error: unknown): boolean {
  if (!isExtensionContextInvalidatedError(error)) return false;
  disableStaleContentScript();
  return true;
}

function getRuntimeAssetUrl(path: string): string | null {
  if (extensionContextInvalidated) return null;
  try {
    return chrome.runtime.getURL(path);
  } catch (error) {
    if (handleExtensionContextError(error)) return null;
    throw error;
  }
}

function sendMessage(msg: ExtMessage): Promise<ExtMessage> {
  if (extensionContextInvalidated) {
    return Promise.reject(new Error("Extension context invalidated."));
  }
  try {
    return chrome.runtime.sendMessage(msg).catch((error: unknown) => {
      handleExtensionContextError(error);
      throw error;
    });
  } catch (error) {
    handleExtensionContextError(error);
    return Promise.reject(error);
  }
}

function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 2.5);
}

function animateSvgCheck(circle: SVGCircleElement, path: SVGPathElement): void {
  const CIRCLE_LEN = 145;
  const CHECK_LEN = 34;
  const CIRCLE_DUR = 450;
  const CHECK_DUR = 300;
  const CHECK_DELAY = 350;

  circle.style.strokeDashoffset = String(CIRCLE_LEN);
  path.style.strokeDashoffset = String(CHECK_LEN);

  const start = performance.now();
  function step(now: number): void {
    const elapsed = now - start;

    const cp = Math.min(elapsed / CIRCLE_DUR, 1);
    circle.style.strokeDashoffset = String(CIRCLE_LEN * (1 - easeOut(cp)));

    if (elapsed >= CHECK_DELAY) {
      const pp = Math.min((elapsed - CHECK_DELAY) / CHECK_DUR, 1);
      path.style.strokeDashoffset = String(CHECK_LEN * (1 - easeOut(pp)));
    }

    if (elapsed < CHECK_DELAY + CHECK_DUR) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function appendMarkdownSourceLink(content: string, url: string): string {
  const sourceUrl = url.trim().replace(/\)/g, "\\)");
  return `${content.trim()}\n\n[Source](${sourceUrl})`.trim();
}

function initShadowHost(): void {
  if (host) return;
  host = document.createElement("div");
  host.id = "omanote-ext-root";
  document.body.appendChild(host);
  shadow = host.attachShadow({ mode: "closed" });

  // Keyboard events from shadow DOM inputs are "composed" and propagate into the
  // outer page document. Sites like Twitter/GitHub have global keydown handlers
  // that would intercept normal typing in our modal. We stop propagation here
  // (bubble phase on the shadow host, which is the first outer-DOM element the
  // event reaches after exiting shadow DOM) so those page handlers never fire.
  // Our own Cmd+Enter / Escape handler is registered on document in capture phase,
  // so it runs before shadow DOM dispatch and is not affected.
  host.addEventListener("keydown", (e) => {
    if (overlayEl?.classList.contains("visible")) {
      e.stopPropagation();
    }
  }, false);

  const style = document.createElement("style");
  style.textContent = BUBBLE_CSS;
  shadow.appendChild(style);
}

function getBubble(): HTMLElement | null {
  if (!bubbleEl) {
    const logoUrl = getRuntimeAssetUrl("assets/logo.svg");
    if (!logoUrl) return null;
    bubbleEl = document.createElement("div");
    bubbleEl.className = "bubble";

    const logo = document.createElement("img");
    logo.className = "bubble-logo";
    logo.src = logoUrl;
    logo.alt = "omanote";

    const label = document.createElement("span");
    label.className = "bubble-label";
    label.textContent = "Save";

    bubbleEl.append(logo, label);
    bubbleEl.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      openModal({ selectionRect: lastSelectionRect ?? undefined });
    });
    shadow!.appendChild(bubbleEl);
  }
  return bubbleEl;
}

function positionBubble(rect: DOMRect, bubble = getBubble()): void {
  if (!bubble) return;
  const { top, left } = calculateBubblePosition(rect, {
    viewportWidth: window.innerWidth,
    scrollX: window.scrollX,
    scrollY: window.scrollY,
  });

  bubble.style.top = `${top}px`;
  bubble.style.left = `${left}px`;
}

function showBubble(rect: DOMRect): void {
  if (extensionContextInvalidated) return;
  initShadowHost();
  lastSelectionRect = rect;
  const bubble = getBubble();
  if (!bubble) return;
  positionBubble(rect, bubble);
  // Trigger animation
  requestAnimationFrame(() => {
    if (extensionContextInvalidated) return;
    bubble.classList.add("visible");
  });
}

function hideBubble(): void {
  if (!bubbleEl) return;
  bubbleEl.classList.remove("visible");
}

function createElement<K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tagName);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

function createLogo(className: string): HTMLImageElement | null {
  const logoUrl = getRuntimeAssetUrl("assets/logo.svg");
  if (!logoUrl) return null;
  const logo = document.createElement("img");
  logo.className = className;
  logo.src = logoUrl;
  logo.alt = "omanote";
  return logo;
}

function createModalHeader(showTitleText: boolean): HTMLElement {
  const header = createElement("div", "modal-header");
  const title = createElement("div", "modal-title");
  const logo = createLogo("modal-title-logo");
  if (logo) title.appendChild(logo);

  if (showTitleText) {
    title.appendChild(createElement("span", undefined, "Save"));

    const closeButton = createElement("button", "modal-close", "×");
    closeButton.type = "button";
    closeButton.dataset.action = "close";
    header.append(title, closeButton);
    return header;
  }

  header.appendChild(title);
  return header;
}

function createTypeTab(type: SaveType, label: string, activeType: SaveType): HTMLButtonElement {
  const tab = createElement("button", `type-tab ${activeType === type ? "active" : ""}`, label);
  tab.type = "button";
  tab.setAttribute("aria-pressed", String(activeType === type));
  tab.dataset.type = type;
  return tab;
}

function createTypeTabs(state: ModalState): HTMLElement {
  const tabs = createElement("div", "type-tabs");
  tabs.setAttribute("role", "group");
  tabs.setAttribute("aria-label", "Save type");

  const highlight = createElement("div", "type-tab-highlight");
  highlight.setAttribute("aria-hidden", "true");
  if (typeTabHighlightStyle) {
    highlight.style.transform = typeTabHighlightStyle.transform;
    highlight.style.width = typeTabHighlightStyle.width;
    highlight.style.height = typeTabHighlightStyle.height;
    highlight.style.opacity = typeTabHighlightStyle.opacity;
  }
  highlight.appendChild(createElement("div", "type-tab-highlight-shine"));

  tabs.append(
    highlight,
    createTypeTab("note", "Note", state.type),
    createTypeTab("bookmark", "Bookmark", state.type),
    createTypeTab("todo", "Todo", state.type),
  );

  return tabs;
}

function createFieldLabel(text: string): HTMLLabelElement {
  return createElement("label", "field-label", text);
}

function createTextInput(field: keyof ModalState, value: string, type = "text", placeholder?: string): HTMLInputElement {
  const input = createElement("input", "field-input");
  input.dataset.field = field;
  input.type = type;
  input.value = value;
  if (placeholder) input.placeholder = placeholder;
  return input;
}

function createTargetSelect<T extends NamedTarget>(
  field: "folderId" | "categoryId",
  targets: T[],
  selectedId: string,
): HTMLSelectElement {
  const select = createElement("select", "field-select");
  select.dataset.field = field;
  sortTargetsByName(targets).forEach((target) => {
    const option = document.createElement("option");
    option.value = target._id;
    option.selected = selectedId === target._id;
    option.textContent = target.name;
    select.appendChild(option);
  });
  return select;
}

function createCreateTargetRow(kind: "folder" | "category", state: ModalState): HTMLElement {
  const row = createElement("div", "create-target-row");
  const isFolder = kind === "folder";
  const input = createTextInput(
    isFolder ? "newFolderName" : "newCategoryName",
    isFolder ? state.newFolderName : state.newCategoryName,
    "text",
    isFolder ? "New folder" : "New category",
  );
  const button = createElement("button", "btn-small", state.creatingTarget === kind ? "Adding…" : "Add");
  button.type = "button";
  button.dataset.action = isFolder ? "create-folder" : "create-category";
  button.disabled = state.creatingTarget !== null;
  row.append(input, button);
  return row;
}

function createTargetField(kind: "folder" | "category", state: ModalState): HTMLElement {
  const wrapper = createElement("div");
  const isFolder = kind === "folder";
  const targets = isFolder ? state.folders : state.categories;
  wrapper.appendChild(createFieldLabel(isFolder ? "Folder" : "Category"));

  if (targets.length) {
    wrapper.appendChild(
      isFolder
        ? createTargetSelect("folderId", state.folders, state.folderId)
        : createTargetSelect("categoryId", state.categories, state.categoryId),
    );
  } else {
    wrapper.appendChild(
      createElement(
        "div",
        "empty-target",
        isFolder ? "Create a folder to organize this note." : "Create a category to save this bookmark.",
      ),
    );
  }

  wrapper.appendChild(createCreateTargetRow(kind, state));
  return wrapper;
}

function createModalBody(state: ModalState): HTMLElement {
  const body = createElement("div", "modal-body");
  const isNote = state.type === "note";
  const isBookmark = state.type === "bookmark";
  const isTodo = state.type === "todo";

  if (isNote || isTodo) {
    const wrapper = createElement("div");
    const textarea = createElement("textarea", "field-textarea");
    textarea.dataset.field = "content";
    textarea.rows = isTodo ? 2 : 4;
    textarea.value = state.content;
    wrapper.append(createFieldLabel(isTodo ? "Task" : "Content"), textarea);
    body.appendChild(wrapper);
  }

  if (isBookmark) {
    const wrapper = createElement("div");
    wrapper.append(createFieldLabel("URL"), createTextInput("url", state.url, "url"));
    body.appendChild(wrapper);
  }

  if (isNote) body.appendChild(createTargetField("folder", state));
  if (isBookmark) body.appendChild(createTargetField("category", state));

  if (isNote) {
    const wrapper = createElement("div");
    wrapper.append(createFieldLabel("Hashtags"), createTextInput("hashtags", state.hashtags, "text", "#tag1 #tag2"));
    body.appendChild(wrapper);
  }

  if ((isNote || isTodo) && state.url) {
    const label = createElement("label", "source-url");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.dataset.field = "includeUrl";
    checkbox.checked = state.includeUrl;

    const urlText = createElement("span", "source-url-text", state.url);
    urlText.title = state.url;
    label.append(checkbox, urlText);
    body.appendChild(label);
  }

  if (state.error) {
    body.appendChild(createElement("div", "status-error", state.error));
  }

  return body;
}

function createModalFooter(state: ModalState): HTMLElement {
  const footer = createElement("div", "modal-footer");
  const cancelButton = createElement("button", "btn-cancel", "Cancel");
  cancelButton.type = "button";
  cancelButton.dataset.action = "close";

  const saveButton = createElement("button", "btn-save");
  saveButton.type = "button";
  saveButton.dataset.action = "save";
  saveButton.disabled = state.saving;
  if (state.saving) {
    saveButton.textContent = "Saving…";
  } else {
    saveButton.append(document.createTextNode("Save"), createElement("span", "shortcut-hint", "⌘↩"));
  }

  footer.append(cancelButton, saveButton);
  return footer;
}

function renderModalContent(modal: HTMLElement, state: ModalState, previouslySaved = false): void {
  if (state.saved) {
    const prevHeight = modal.offsetHeight;
    const success = createElement("div", "status-success");
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "status-success-icon");
    svg.setAttribute("viewBox", "0 0 52 52");
    svg.setAttribute("fill", "none");
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("class", "success-circle");
    circle.setAttribute("cx", "26");
    circle.setAttribute("cy", "26");
    circle.setAttribute("r", "23");
    circle.setAttribute("transform", "rotate(-90 26 26)");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("class", "success-check");
    path.setAttribute("d", "M14 26 l8 8 16-16");
    svg.append(circle, path);
    success.append(svg, createElement("span", undefined, "Saved!"));
    modal.replaceChildren(createModalHeader(false), success);
    requestAnimationFrame(() => animateSvgCheck(circle, path));

    if (!previouslySaved && prevHeight > 0) {
      // Measure natural height of success content. Setting height: auto here
      // happens synchronously before any paint so there is no visible flash.
      modal.style.transition = "none";
      modal.style.height = "auto";
      const newHeight = modal.offsetHeight; // natural height of success content
      // Restore to form height as animation start point
      modal.style.height = `${prevHeight}px`;
      void modal.offsetHeight; // force reflow to commit prevHeight
      // Re-enable CSS transition and animate to success height
      modal.style.removeProperty("transition");
      requestAnimationFrame(() => {
        modal.style.height = `${newHeight}px`;
      });
    }
    return;
  }

  modal.style.height = "";
  modal.replaceChildren(createModalHeader(true), createTypeTabs(state), createModalBody(state), createModalFooter(state));
}

let _prevSaved = false;

function renderModal(): void {
  if (!overlayEl || !modalState) return;
  const modalDiv = overlayEl.querySelector<HTMLElement>(".modal");
  if (modalDiv) {
    const hasPreviousHighlight = typeTabHighlightStyle !== null;
    renderModalContent(modalDiv, modalState, _prevSaved);
    _prevSaved = modalState.saved;
    applyModalPosition(modalDiv);
    bindModalEvents(overlayEl, modalDiv);
    if (!hasPreviousHighlight) syncTypeTabHighlight(modalDiv);
    requestAnimationFrame(() => syncTypeTabHighlight(modalDiv));
  }
}

function getDefaultModalTop(): number {
  return clamp(window.innerHeight * 0.08, 32, 72);
}

function calculateCurrentModalPosition(modal: HTMLElement): { top: number; left: number; placement: ModalPlacement } {
  const rect = modal.getBoundingClientRect();
  const modalWidth = rect.width || MODAL_WIDTH;
  const modalHeight = rect.height || MODAL_FALLBACK_HEIGHT;

  if (modalAnchorRect) {
    return calculateModalPosition(modalAnchorRect, {
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      modalWidth,
      modalHeight,
    });
  }

  return {
    top: getDefaultModalTop(),
    left: clamp((window.innerWidth - modalWidth) / 2, VIEWPORT_PADDING, window.innerWidth - modalWidth - VIEWPORT_PADDING),
    placement: "bottom",
  };
}

function applyModalPosition(modal: HTMLElement, recompute = false): void {
  if (!modalPositionStyle || recompute) {
    const position = calculateCurrentModalPosition(modal);
    modalPositionStyle = {
      top: `${position.top}px`,
      left: `${position.left}px`,
      placement: position.placement,
    };
  }

  modal.style.top = modalPositionStyle.top;
  modal.style.left = modalPositionStyle.left;
  modal.dataset.placement = modalPositionStyle.placement;
}

function lockPageScroll(): void {
  if (scrollLockState) return;
  scrollLockState = {
    bodyOverflow: document.body.style.overflow,
    documentOverflow: document.documentElement.style.overflow,
  };
  document.body.style.overflow = "hidden";
  document.documentElement.style.overflow = "hidden";
}

function unlockPageScroll(): void {
  if (!scrollLockState) return;
  document.body.style.overflow = scrollLockState.bodyOverflow;
  document.documentElement.style.overflow = scrollLockState.documentOverflow;
  scrollLockState = null;
}

function captureTypeTabHighlight(modal: HTMLElement): void {
  const highlight = modal.querySelector<HTMLElement>(".type-tab-highlight");
  if (!highlight) return;
  typeTabHighlightStyle = {
    transform: highlight.style.transform,
    width: highlight.style.width,
    height: highlight.style.height,
    opacity: highlight.style.opacity || "1",
  };
}

function syncTypeTabHighlight(modal: HTMLElement): void {
  const tabs = modal.querySelector<HTMLElement>(".type-tabs");
  const activeTab = modal.querySelector<HTMLElement>(".type-tab.active");
  const highlight = modal.querySelector<HTMLElement>(".type-tab-highlight");
  if (!tabs || !activeTab || !highlight) return;

  highlight.style.transform = `translate3d(${activeTab.offsetLeft}px, ${activeTab.offsetTop}px, 0)`;
  highlight.style.width = `${activeTab.offsetWidth}px`;
  highlight.style.height = `${activeTab.offsetHeight}px`;
  highlight.style.opacity = "1";
  typeTabHighlightStyle = {
    transform: highlight.style.transform,
    width: highlight.style.width,
    height: highlight.style.height,
    opacity: highlight.style.opacity,
  };
}

function bindModalEvents(_overlay: HTMLElement, modal: HTMLElement): void {
  if (!modalState) return;

  // Close actions
  modal.querySelectorAll<HTMLElement>("[data-action='close']").forEach((el) => {
    el.addEventListener("click", closeModal);
  });

  // Type tabs
  modal.querySelectorAll<HTMLElement>(".type-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      const type = tab.dataset.type as SaveType;
      if (!modalState) return;
      captureTypeTabHighlight(modal);
      modalState = { ...modalState, type, error: "" };
      renderModal();
    });
  });

  // Text fields
  modal.querySelectorAll<HTMLTextAreaElement | HTMLInputElement>("[data-field]").forEach((el) => {
    const field = el.dataset.field as keyof ModalState;
    el.addEventListener("input", () => {
      if (!modalState) return;
      if (el.type === "checkbox") {
        (modalState as unknown as Record<string, unknown>)[field] = (el as HTMLInputElement).checked;
      } else {
        (modalState as unknown as Record<string, unknown>)[field] = el.value;
      }
    });
    el.addEventListener("change", () => {
      if (!modalState) return;
      if (el.type === "checkbox") {
        (modalState as unknown as Record<string, unknown>)[field] = (el as HTMLInputElement).checked;
      } else {
        (modalState as unknown as Record<string, unknown>)[field] = el.value;
      }
    });
  });

  // Save button
  const saveBtn = modal.querySelector<HTMLButtonElement>("[data-action='save']");
  if (saveBtn) {
    saveBtn.addEventListener("click", () => void handleSave());
  }

  const createFolderBtn = modal.querySelector<HTMLButtonElement>("[data-action='create-folder']");
  if (createFolderBtn) {
    createFolderBtn.addEventListener("click", () => void handleCreateTarget("folder"));
  }

  const createCategoryBtn = modal.querySelector<HTMLButtonElement>("[data-action='create-category']");
  if (createCategoryBtn) {
    createCategoryBtn.addEventListener("click", () => void handleCreateTarget("category"));
  }

}

async function handleSave(): Promise<void> {
  if (!modalState || modalState.saving) return;
  if (modalState.type === "note" && !modalState.folderId) {
    modalState = { ...modalState, error: "Choose or create a folder first." };
    renderModal();
    return;
  }
  if (modalState.type === "bookmark" && !modalState.categoryId) {
    modalState = { ...modalState, error: "Choose or create a category first." };
    renderModal();
    return;
  }
  modalState = { ...modalState, saving: true, error: "" };
  renderModal();

  const state = modalState;
  const hashtags = state.hashtags
    .split(/[\s,]+/)
    .map((t) => t.replace(/^#/, "").trim())
    .filter(Boolean);

  let content = state.content;
  if (state.type === "note" && hashtags.length > 0) {
    content = content.trimEnd() + "\n\n" + hashtags.map((t) => `#${t}`).join(" ");
  }
  if ((state.type === "note" || state.type === "todo") && state.includeUrl && state.url) {
    content = appendMarkdownSourceLink(content, state.url);
  }

  const payload: SavePayload = {
    type: state.type,
    content,
    url: state.type === "bookmark" ? state.url : state.url || undefined,
    pageTitle: state.pageTitle,
    folderId: state.folderId || undefined,
    categoryId: state.categoryId || undefined,
    hashtags,
  };

  let response: ExtMessage;
  try {
    response = await sendMessage({ type: "SAVE_ITEM", payload }) as ExtMessage;
  } catch (err) {
    if (handleExtensionContextError(err)) return;
    if (!modalState) return;
    modalState = { ...modalState, saving: false, error: err instanceof Error ? err.message : "Could not save item." };
    renderModal();
    return;
  }

  if (!modalState) return;

  if (response.type === "SAVE_SUCCESS") {
    modalState = { ...modalState, saving: false, saved: true };
    renderModal();
    setTimeout(closeModal, 1500);
  } else if (response.type === "SAVE_ERROR") {
    modalState = { ...modalState, saving: false, error: response.error };
    renderModal();
  }
}

function applyFoldersData(data: {
  folders: NoteFolder[];
  categories: BookmarkCategory[];
  lastSelectedNoteFolderId?: string | null;
  lastSelectedBookmarkCategoryId?: string | null;
}): void {
  if (!modalState) return;
  modalState = {
    ...modalState,
    folders: data.folders,
    categories: data.categories,
    folderId: selectPreferredTargetId(data.folders, modalState.folderId || data.lastSelectedNoteFolderId),
    categoryId: selectPreferredTargetId(data.categories, modalState.categoryId || data.lastSelectedBookmarkCategoryId),
  };
}

async function handleCreateTarget(kind: "folder" | "category"): Promise<void> {
  if (!modalState || modalState.creatingTarget) return;
  const name = kind === "folder" ? modalState.newFolderName.trim() : modalState.newCategoryName.trim();
  if (!name) {
    modalState = { ...modalState, error: `${kind === "folder" ? "Folder" : "Category"} name is required.` };
    renderModal();
    return;
  }

  const existing = kind === "folder"
    ? findTargetByName(modalState.folders, name)
    : findTargetByName(modalState.categories, name);
  if (existing) {
    modalState = {
      ...modalState,
      error: `${kind === "folder" ? "Folder" : "Category"} already exists.`,
      folderId: kind === "folder" ? existing._id : modalState.folderId,
      categoryId: kind === "category" ? existing._id : modalState.categoryId,
    };
    renderModal();
    return;
  }

  modalState = { ...modalState, creatingTarget: kind, error: "" };
  renderModal();

  let response: ExtMessage;
  try {
    response = await sendMessage(
      kind === "folder"
        ? { type: "CREATE_NOTE_FOLDER", name }
        : { type: "CREATE_BOOKMARK_CATEGORY", name },
    ) as ExtMessage;
  } catch (err) {
    if (handleExtensionContextError(err)) return;
    if (!modalState) return;
    modalState = {
      ...modalState,
      creatingTarget: null,
      error: err instanceof Error ? err.message : "Could not create destination.",
    };
    renderModal();
    return;
  }

  if (!modalState) return;

  if (response.type === "FOLDERS_RESPONSE") {
    applyFoldersData(response.data);
    modalState = {
      ...modalState,
      folderId: kind === "folder" ? response.data.lastSelectedNoteFolderId ?? modalState.folderId : modalState.folderId,
      categoryId: kind === "category" ? response.data.lastSelectedBookmarkCategoryId ?? modalState.categoryId : modalState.categoryId,
      newFolderName: kind === "folder" ? "" : modalState.newFolderName,
      newCategoryName: kind === "category" ? "" : modalState.newCategoryName,
      creatingTarget: null,
      error: "",
    };
  } else if (response.type === "SAVE_ERROR") {
    modalState = { ...modalState, creatingTarget: null, error: response.error };
  } else {
    modalState = { ...modalState, creatingTarget: null, error: "Could not create destination." };
  }
  renderModal();
}

async function fetchFoldersForModal(): Promise<void> {
  try {
    const resp = await sendMessage({ type: "GET_FOLDERS" }) as ExtMessage;
    if (resp.type !== "FOLDERS_RESPONSE" || !modalState) return;
    applyFoldersData(resp.data);
    renderModal();
  } catch (err) {
    if (handleExtensionContextError(err)) return;
    // non-fatal; the modal can still save into default locations
    console.error("[omanote] failed to load folders for save modal:", err);
  }
}

function openModal(overrideContext?: {
  type?: SaveType;
  content?: string;
  url?: string;
  pageTitle?: string;
  selectionRect?: DOMRect;
}): void {
  if (extensionContextInvalidated) return;
  initShadowHost();
  hideBubble();
  lockPageScroll();

  const selection = window.getSelection();
  const selectedText = selection?.toString().trim() ?? "";
  const pageUrl = window.location.href;
  const pageTitle = document.title;

  // Auto-detect type
  let defaultType: SaveType = "note";
  let defaultContent = selectedText;
  let defaultUrl = "";

  if (overrideContext?.type) {
    defaultType = overrideContext.type;
    defaultContent = overrideContext.content ?? selectedText;
    defaultUrl = overrideContext.url ?? pageUrl;
  } else {
    // Check if selection is a pure URL
    const urlPattern = /^https?:\/\//i;
    if (urlPattern.test(selectedText)) {
      defaultType = "bookmark";
      defaultUrl = selectedText;
    } else {
      defaultUrl = pageUrl;
    }
  }

  modalState = {
    type: defaultType,
    content: defaultContent,
    url: defaultUrl,
    pageTitle: overrideContext?.pageTitle ?? pageTitle,
    folderId: "",
    categoryId: "",
    hashtags: "",
    includeUrl: !!defaultUrl,
    folders: [],
    categories: [],
    newFolderName: "",
    newCategoryName: "",
    creatingTarget: null,
    saving: false,
    saved: false,
    error: "",
  };
  typeTabHighlightStyle = null;
  modalAnchorRect = overrideContext?.selectionRect ?? null;
  modalPositionStyle = null;

  if (!overlayEl) {
    overlayEl = document.createElement("div");
    overlayEl.className = "modal-overlay";
    overlayEl.addEventListener("click", (e) => {
      if (e.target === overlayEl) closeModal();
    });
    const modalDiv = document.createElement("div");
    modalDiv.className = "modal";
    overlayEl.appendChild(modalDiv);
    shadow!.appendChild(overlayEl);
  }
  const activeOverlay = overlayEl;

  renderModal();
  if (extensionContextInvalidated || overlayEl !== activeOverlay) {
    unlockPageScroll();
    return;
  }

  // Keyboard shortcut to save
  const keyHandler = (e: KeyboardEvent): void => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      void handleSave();
    }
    if (e.key === "Escape") {
      closeModal();
    }
  };
  document.addEventListener("keydown", keyHandler, true);
  (activeOverlay as HTMLElement & { _keyHandler?: (e: KeyboardEvent) => void })._keyHandler = keyHandler;

  const resizeHandler = (): void => {
    if (overlayEl !== activeOverlay) return;
    const modalDiv = activeOverlay.querySelector<HTMLElement>(".modal");
    if (modalDiv) {
      applyModalPosition(modalDiv, true);
      syncTypeTabHighlight(modalDiv);
    }
  };
  window.addEventListener("resize", resizeHandler);
  (activeOverlay as HTMLElement & { _resizeHandler?: () => void })._resizeHandler = resizeHandler;

  requestAnimationFrame(() => {
    if (overlayEl !== activeOverlay || extensionContextInvalidated) return;
    activeOverlay.classList.add("visible");
    // Focus the textarea/input
    const first = activeOverlay.querySelector<HTMLElement>("textarea, input");
    first?.focus();
  });

  void fetchFoldersForModal();
}

function closeModal(): void {
  if (!overlayEl) return;
  overlayEl.classList.remove("visible");
  unlockPageScroll();
  const el = overlayEl as HTMLElement & {
    _keyHandler?: (e: KeyboardEvent) => void;
    _resizeHandler?: () => void;
  };
  if (el._keyHandler) {
    document.removeEventListener("keydown", el._keyHandler, true);
    delete el._keyHandler;
  }
  if (el._resizeHandler) {
    window.removeEventListener("resize", el._resizeHandler);
    delete el._resizeHandler;
  }
  setTimeout(() => {
    modalState = null;
    modalAnchorRect = null;
    modalPositionStyle = null;
    typeTabHighlightStyle = null;
    _prevSaved = false;
  }, 150);
}

export function initSelectionBubble(): () => void {
  let lastSelection = "";

  void getBlockedSites().then((sites) => {
    blockedSites = sites;
    if (shouldSuppressSelectionBubbleForUrl(window.location.href, blockedSites)) hideBubble();
  }).catch((err) => {
    if (handleExtensionContextError(err)) return;
  });

  const onStorageChange = (
    changes: Record<string, chrome.storage.StorageChange>,
    area: string,
  ) => {
    if (area !== "local" || !("omanote_blocked_sites" in changes)) return;
    blockedSites = (changes.omanote_blocked_sites.newValue as string[] | undefined) ?? [];
    if (shouldSuppressSelectionBubbleForUrl(window.location.href, blockedSites)) hideBubble();
  };

  chrome.storage?.onChanged?.addListener(onStorageChange);

  const onSelectionChange = () => {
    if (extensionContextInvalidated) return;
    if (shouldSuppressSelectionBubbleForUrl(window.location.href, blockedSites)) {
      lastSelectionRect = null;
      hideBubble();
      return;
    }
    if (bubbleTimeout) clearTimeout(bubbleTimeout);

    const selection = window.getSelection();
    const text = selection?.toString().trim() ?? "";

    if (!text || text === lastSelection) {
      if (!text) {
        lastSelectionRect = null;
        hideBubble();
      }
      return;
    }

    lastSelection = text;

    bubbleTimeout = setTimeout(() => {
      if (extensionContextInvalidated) return;
      const range = selection?.getRangeAt(0);
      if (!range) return;
      const rect = range.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return;
      lastSelectionRect = rect;
      showBubble(rect);
    }, 200);
  };

  const onMouseDown = (e: MouseEvent) => {
    if (extensionContextInvalidated) return;
    if (isEventFromExtensionRoot(e, host)) return;
    hideBubble();
  };

  document.addEventListener("selectionchange", onSelectionChange);
  document.addEventListener("mousedown", onMouseDown);

  return () => {
    document.removeEventListener("selectionchange", onSelectionChange);
    document.removeEventListener("mousedown", onMouseDown);
    chrome.storage?.onChanged?.removeListener(onStorageChange);
    if (bubbleTimeout) {
      clearTimeout(bubbleTimeout);
      bubbleTimeout = null;
    }
    hideBubble();
  };
}

export function handleOpenModalMessage(payload: {
  _defaultType?: SaveType;
  _content?: string;
  context: { selectedText?: string; selectedUrl?: string; pageUrl: string; pageTitle: string };
}): void {
  openModal({
    type: payload._defaultType,
    content: payload._content ?? payload.context.selectedText,
    url: payload.context.selectedUrl ?? payload.context.pageUrl,
    pageTitle: payload.context.pageTitle,
  });
}
