import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { BookmarkCategory, NoteFolder, SavePayload } from "../../shared/types";
import type { ExtMessage } from "../../shared/messages";
import { appendMarkdownSourceLink } from "../../shared/markdown";
import { findTargetByName, selectPreferredTargetId } from "../../shared/folder-selection";
import { FolderSelect } from "./FolderSelect";

type SaveType = SavePayload["type"];

function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 2.5);
}

function animateSvgCheck(circle: SVGCircleElement, path: SVGPathElement): void {
  const CIRCLE_LEN = 145, CHECK_LEN = 34;
  const CIRCLE_DUR = 450, CHECK_DUR = 300, CHECK_DELAY = 350;
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

interface SaveFormProps {
  initialType?: SaveType;
  initialContent?: string;
  initialUrl?: string;
  pageTitle?: string;
  onSaved: () => void;
}

function sendMessage(msg: ExtMessage): Promise<ExtMessage> {
  return chrome.runtime.sendMessage(msg);
}

export function SaveForm({
  initialType = "note",
  initialContent = "",
  initialUrl = "",
  pageTitle = "",
  onSaved,
}: SaveFormProps) {
  const [type, setType] = useState<SaveType>(initialType);
  const [content, setContent] = useState(initialContent);
  const [url, setUrl] = useState(initialUrl);
  const [folderId, setFolderId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [includeUrl, setIncludeUrl] = useState(!!initialUrl);
  const [folders, setFolders] = useState<NoteFolder[]>([]);
  const [categories, setCategories] = useState<BookmarkCategory[]>([]);
  const [newFolderName, setNewFolderName] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [creatingTarget, setCreatingTarget] = useState<"folder" | "category" | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const prevHeightRef = useRef<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Record<SaveType, HTMLButtonElement | null>>({
    note: null,
    bookmark: null,
    todo: null,
  });
  const [highlightStyle, setHighlightStyle] = useState<{
    transform: string;
    width: number;
    height: number;
    opacity: number;
  } | null>(null);

  useEffect(() => {
    void sendMessage({ type: "GET_FOLDERS" }).then((resp) => {
      if (resp.type === "FOLDERS_RESPONSE") {
        setFolders(resp.data.folders);
        setCategories(resp.data.categories);
        setFolderId((current) => selectPreferredTargetId(resp.data.folders, current || resp.data.lastSelectedNoteFolderId));
        setCategoryId((current) => selectPreferredTargetId(resp.data.categories, current || resp.data.lastSelectedBookmarkCategoryId));
      }
    }).catch(() => {/* non-fatal */});

    // Focus textarea
    textareaRef.current?.focus();
  }, []);

  // Keyboard save shortcut
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        void handleSave();
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  useLayoutEffect(() => {
    const activeTab = tabRefs.current[type];
    if (!tabsRef.current || !activeTab) {
      setHighlightStyle(null);
      return;
    }

    function updateHighlight() {
      const nextActiveTab = tabRefs.current[type];
      if (!nextActiveTab) return;
      setHighlightStyle({
        transform: `translate3d(${nextActiveTab.offsetLeft}px, ${nextActiveTab.offsetTop}px, 0)`,
        width: nextActiveTab.offsetWidth,
        height: nextActiveTab.offsetHeight,
        opacity: 1,
      });
    }

    updateHighlight();
    window.addEventListener("resize", updateHighlight);
    return () => window.removeEventListener("resize", updateHighlight);
  }, [type]);

  // Animate wrapper height from form height → compact success height
  useLayoutEffect(() => {
    if (!saved || !wrapperRef.current) return;
    const el = wrapperRef.current;
    const prev = prevHeightRef.current;
    if (!prev) return;

    // Measure natural height of success content (no height constraint yet)
    el.style.transition = "none";
    el.style.overflow = "hidden";
    const newHeight = el.offsetHeight; // success state is already rendered here
    // Start from form height
    el.style.height = `${prev}px`;
    void el.offsetHeight; // force reflow to commit start value
    // Animate to success height
    el.style.transition = "height var(--motion-duration-slow) var(--motion-easing-in-out)";
    requestAnimationFrame(() => {
      el.style.height = `${newHeight}px`;
    });
  }, [saved]);

  useEffect(() => {
    if (!saved || !svgRef.current) return;
    const circle = svgRef.current.querySelector("circle") as SVGCircleElement | null;
    const path = svgRef.current.querySelector("path") as SVGPathElement | null;
    if (circle && path) animateSvgCheck(circle, path);
  }, [saved]);


  async function handleSave() {
    if (saving || saved) return;
    const trimmedContent = content.trim();
    const trimmedUrl = url.trim();
    if (type === "bookmark" && !trimmedUrl) {
      setError("URL is required for a bookmark.");
      return;
    }
    if ((type === "note" || type === "todo") && !trimmedContent) {
      setError("Content is required.");
      return;
    }
    if (type === "note" && !folderId) {
      setError("Choose or create a folder first.");
      return;
    }
    if (type === "bookmark" && !categoryId) {
      setError("Choose or create a category first.");
      return;
    }

    setSaving(true);
    setError("");

    const parsedTags = hashtags
      .split(/[\s,]+/)
      .map((t) => t.replace(/^#/, "").trim())
      .filter(Boolean);

    let finalContent = trimmedContent;
    if (type === "note" && parsedTags.length > 0) {
      finalContent = finalContent.trimEnd() + "\n\n" + parsedTags.map((t) => `#${t}`).join(" ");
    }
    if ((type === "note" || type === "todo") && includeUrl && trimmedUrl) {
      finalContent = appendMarkdownSourceLink(finalContent, trimmedUrl);
    }

    const payload: SavePayload = {
      type,
      content: finalContent,
      url: type === "bookmark" ? trimmedUrl : trimmedUrl || undefined,
      pageTitle: pageTitle || undefined,
      folderId: folderId || undefined,
      categoryId: categoryId || undefined,
      hashtags: parsedTags,
    };

    try {
      const resp = await sendMessage({ type: "SAVE_ITEM", payload });
      if (resp.type === "SAVE_SUCCESS") {
        prevHeightRef.current = wrapperRef.current?.offsetHeight ?? null;
        setSaved(true);
        setTimeout(onSaved, 1200);
      } else if (resp.type === "SAVE_ERROR") {
        setError(resp.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateTarget(kind: "folder" | "category") {
    if (creatingTarget) return;
    const name = kind === "folder" ? newFolderName.trim() : newCategoryName.trim();
    if (!name) {
      setError(`${kind === "folder" ? "Folder" : "Category"} name is required.`);
      return;
    }

    const existing = kind === "folder" ? findTargetByName(folders, name) : findTargetByName(categories, name);
    if (existing) {
      if (kind === "folder") setFolderId(existing._id);
      else setCategoryId(existing._id);
      setError(`${kind === "folder" ? "Folder" : "Category"} already exists.`);
      return;
    }

    setCreatingTarget(kind);
    setError("");
    try {
      const resp = await sendMessage(
        kind === "folder"
          ? { type: "CREATE_NOTE_FOLDER", name }
          : { type: "CREATE_BOOKMARK_CATEGORY", name },
      );
      if (resp.type === "FOLDERS_RESPONSE") {
        setFolders(resp.data.folders);
        setCategories(resp.data.categories);
        if (kind === "folder") {
          setFolderId(selectPreferredTargetId(resp.data.folders, resp.data.lastSelectedNoteFolderId));
        } else {
          setFolderId((current) => selectPreferredTargetId(resp.data.folders, current || resp.data.lastSelectedNoteFolderId));
        }
        if (kind === "category") {
          setCategoryId(selectPreferredTargetId(resp.data.categories, resp.data.lastSelectedBookmarkCategoryId));
        } else {
          setCategoryId((current) => selectPreferredTargetId(resp.data.categories, current || resp.data.lastSelectedBookmarkCategoryId));
        }
        if (kind === "folder") setNewFolderName("");
        else setNewCategoryName("");
      } else if (resp.type === "SAVE_ERROR") {
        setError(resp.error);
      } else {
        setError("Could not create destination.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create destination.");
    } finally {
      setCreatingTarget(null);
    }
  }

  const isNote = type === "note";
  const isBookmark = type === "bookmark";
  const isTodo = type === "todo";

  return (
    <div ref={wrapperRef}>
      {saved ? (
        <div className="success-state">
          <svg ref={svgRef} className="success-icon" viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle className="success-circle" cx="26" cy="26" r="23" transform="rotate(-90 26 26)" />
            <path className="success-check" d="M14 26 l8 8 16-16" />
          </svg>
          <span>Saved!</span>
        </div>
      ) : (
        <>
          <div className="type-tabs" ref={tabsRef} role="group" aria-label="Save type">
            {highlightStyle ? (
              <div
                className="type-tab-highlight"
                aria-hidden="true"
                style={highlightStyle}
              >
                <div className="type-tab-highlight-shine" />
              </div>
            ) : null}
            {(["note", "bookmark", "todo"] as SaveType[]).map((t) => (
              <button
                key={t}
                type="button"
                ref={(node) => {
                  tabRefs.current[t] = node;
                }}
                aria-pressed={type === t}
                className={`type-tab ${type === t ? "active" : ""}`}
                onClick={() => { setType(t); setError(""); }}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          <div className="form">
            {(isNote || isTodo) && (
              <div className="field">
                <label className="field-label">{isTodo ? "Task" : "Content"}</label>
                <textarea
                  ref={textareaRef}
                  className="field-textarea"
                  rows={isTodo ? 2 : 3}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder={isTodo ? "What needs to be done?" : "Write a note…"}
                />
              </div>
            )}

            {isBookmark && (
              <div className="field">
                <label className="field-label">URL</label>
                <input
                  className="field-input"
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://"
                  autoFocus
                />
              </div>
            )}

            {isNote && (
              <div className="field">
                <label className="field-label">Folder</label>
                {folders.length > 0 ? (
                  <FolderSelect items={folders} value={folderId} onChange={setFolderId} />
                ) : (
                  <div className="empty-target">Create a folder to organize this note.</div>
                )}
                <div className="create-target-row">
                  <input
                    className="field-input"
                    type="text"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder="New folder"
                  />
                  <button
                    className="btn btn-secondary btn-small"
                    type="button"
                    disabled={creatingTarget !== null}
                    onClick={() => void handleCreateTarget("folder")}
                  >
                    {creatingTarget === "folder" ? "Adding…" : "Add"}
                  </button>
                </div>
              </div>
            )}

            {isBookmark && (
              <div className="field">
                <label className="field-label">Category</label>
                {categories.length > 0 ? (
                  <FolderSelect items={categories} value={categoryId} onChange={setCategoryId} />
                ) : (
                  <div className="empty-target">Create a category to save this bookmark.</div>
                )}
                <div className="create-target-row">
                  <input
                    className="field-input"
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="New category"
                  />
                  <button
                    className="btn btn-secondary btn-small"
                    type="button"
                    disabled={creatingTarget !== null}
                    onClick={() => void handleCreateTarget("category")}
                  >
                    {creatingTarget === "category" ? "Adding…" : "Add"}
                  </button>
                </div>
              </div>
            )}

            {isNote && (
              <div className="field">
                <label className="field-label">Hashtags</label>
                <input
                  className="field-input"
                  type="text"
                  value={hashtags}
                  onChange={(e) => setHashtags(e.target.value)}
                  placeholder="#tag1 #tag2"
                />
              </div>
            )}

            {(isNote || isTodo) && initialUrl && (
              <label className="url-row">
                <input
                  type="checkbox"
                  checked={includeUrl}
                  onChange={(e) => setIncludeUrl(e.target.checked)}
                />
                <span className="url-text" title={initialUrl}>{initialUrl}</span>
              </label>
            )}
          </div>

          {error && <div className="error-msg">{error}</div>}

          <div className="btn-row">
            <button
              className="btn btn-primary"
              onClick={() => void handleSave()}
              disabled={saving}
            >
              {saving ? <span className="spinner" /> : null}
              {saving ? "Saving…" : "Save"}
              {!saving && <span className="shortcut">⌘↩</span>}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
