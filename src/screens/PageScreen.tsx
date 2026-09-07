import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Check, Copy, ExternalLink, Share2, Star, Trash2, X } from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { useApp } from "../app/AppProvider";
import { randomId, type BookmarkItem, type PageItem } from "@omanote/shared";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { PageEditor } from "../components/page/PageEditor";
import { SharePageModal } from "../components/page/SharePageModal";
import { BookmarkCategoryIconPicker } from "../components/BookmarkCategoryIconPicker";
import { CategoryIconView } from "../lib/bookmark-category-icon";
import { cn } from "../components/ui";
import { emptyPageDoc, pageDocStats, pageDocToHashtags, pageDocToPreview, pageDocToShareBlocks } from "../lib/page-doc";
import { usePageAutosave } from "../lib/use-page-autosave";
import { usePageArtifactSync } from "../lib/use-page-artifact-sync";
import { SeoHead } from "../seo/SeoHead";
import type { Editor } from "@tiptap/react";
import { useAuth } from "@clerk/react";
import { useEncryption } from "../contexts/EncryptionContext";
import { useUserSettings } from "../contexts/UserSettingsContext";
import { publishBlockImages, unpublishPageImages, type PublishedImage } from "../lib/page-images";

function formatMetaDate(timestamp: number) {
  return new Date(timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** Below the title, same "·"-separated idiom as NotesScreen's folder summary row. */
function PageMetadataRow({ page, docJson }: { page: PageItem; docJson: string }) {
  const stats = useMemo(() => pageDocStats(docJson), [docJson]);

  const items = [
    `Created ${formatMetaDate(page.createdAt)}`,
    `Updated ${formatMetaDate(page.updatedAt)}`,
    `${stats.words} ${stats.words === 1 ? "word" : "words"}`,
    // Counts that are zero add noise to a plain-text page without saying
    // anything useful, unlike the dates/word count above which always apply.
    stats.todos ? `${stats.todos} ${stats.todos === 1 ? "todo" : "todos"}` : null,
    stats.links ? `${stats.links} ${stats.links === 1 ? "link" : "links"}` : null,
    stats.images ? `${stats.images} ${stats.images === 1 ? "image" : "images"}` : null,
  ].filter((item): item is string => item !== null);

  return (
    <div className="flex flex-wrap items-center gap-y-1 text-[11px] text-app-ink-faint">
      {items.map((label, index) => (
        <span key={label} className="flex items-center">
          {index > 0 ? (
            <span className="px-2" aria-hidden="true">
              ·
            </span>
          ) : null}
          <span>{label}</span>
        </span>
      ))}
    </div>
  );
}

/** Icon-only, no border — bg fill only on hover, same idiom as the close button beside it. */
function HeaderActionButton({
  icon: Icon,
  label,
  onClick,
  href,
  danger,
  active,
}: {
  icon: typeof Share2;
  label: string;
  onClick?: () => void;
  href?: string;
  danger?: boolean;
  /** Filled rather than the default outline — used for the star toggle. Stays
   * neutral ink rather than a tint, matching every other active/selected
   * state in the app (SegmentedPill, option cards, etc). */
  active?: boolean;
}) {
  const className = cn(
    "inline-flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-app-surface-hover active:scale-[0.98]",
    danger ? "text-danger-ink" : active ? "text-app-ink" : "text-app-ink-muted hover:text-app-ink",
  );
  if (href) {
    return (
      <a href={href} target="_blank" rel="noreferrer" aria-label={label} title={label} className={className} onClick={onClick}>
        <Icon className="h-4 w-4" />
      </a>
    );
  }
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className={className}>
      <Icon className={cn("h-4 w-4", active && "fill-current")} />
    </button>
  );
}

// Well behind the 800ms autosave: this pushes a plaintext copy to the server,
// so it should settle after the writing stops rather than track it.
const SHARE_SNAPSHOT_DEBOUNCE_MS = 3000;

/**
 * `/p/:pageId` — one page, rendered as a floating overlay with margin on
 * every side (not edge-to-edge) so "Create new page" reads as the composer
 * sheet growing into it rather than a hard cut — see use-create-canvas.ts.
 *
 * Chromeless by design (see AppShell's isChromelessRoute): no top bar, no
 * bottom nav, no read/write toggle. Just the document and a close button. It
 * is still a real route rather than a modal, though — that's what makes
 * "open in new tab" work.
 */
export function PageScreen() {
  const { pageId = "" } = useParams<{ pageId: string }>();
  const { state, dispatch } = useApp();
  const navigate = useNavigate();
  const { settings } = useUserSettings();

  // A canvas created offline is addressed by its clientKey until the server
  // assigns an id, and the URL the user is sitting on still says clientKey —
  // so resolve against both. See AppProvider's optimisticPages.
  const page = useMemo(
    () => state.pages.find((candidate) => candidate.id === pageId || candidate.clientKey === pageId) ?? null,
    [state.pages, pageId],
  );

  const [title, setTitle] = useState(page?.title ?? "");
  const [icon, setIcon] = useState(page?.icon);
  const [docJson, setDocJson] = useState(page?.docJson ?? emptyPageDoc());
  // Held in refs so the autosave callback stays stable and the flush that runs
  // on unmount reads the latest values rather than the ones captured at mount.
  const titleRef = useRef(title);
  const iconRef = useRef(icon);
  const docJsonRef = useRef(docJson);
  titleRef.current = title;
  iconRef.current = icon;
  docJsonRef.current = docJson;
  const pageIdRef = useRef(pageId);
  pageIdRef.current = page?.id ?? pageId;

  // Adopt server state exactly once, when the row first arrives. Re-syncing on
  // every change would fight the user's typing: our own autosave round-trips
  // back through Dexie, and re-seeding from it would reset the caret.
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current || !page) return;
    hydratedRef.current = true;
    setTitle(page.title ?? "");
    setIcon(page.icon);
    setDocJson(page.docJson);
  }, [page]);

  // The artifact sync needs the editor instance, so this has to be state
  // rather than a ref — the hook re-runs once the editor becomes available.
  const [editor, setEditor] = useState<Editor | null>(null);
  const handleEditorReady = useCallback((next: Editor | null) => setEditor(next), []);
  // Lets Enter in the title jump into the body.
  const focusBodyRef = useRef<(() => void) | null>(null);
  focusBodyRef.current = editor ? () => editor.commands.focus("start") : null;

  // Only a canvas the server knows about can own todos (todos.pageId is an
  // id("pages")). While it is still optimistic this is null and checklist
  // blocks simply stay unassigned — their text lives safely in the document
  // until a later pass materialises them.
  const serverPageId = page && page.id !== page.clientKey ? page.id : null;

  const { reconcile, todosByClientKey, bookmarksByClientKey, onToggle } = usePageArtifactSync({
    editor,
    pageId: serverPageId,
    dateKey: page?.createdDateKey ?? state.ui.selectedDateKey,
    todos: state.todos,
    bookmarks: state.bookmarks,
    dispatch,
  });
  const reconcileRef = useRef(reconcile);
  reconcileRef.current = reconcile;

  const todoLookup = useMemo(
    () => ({ byClientKey: todosByClientKey, onToggle }),
    [todosByClientKey, onToggle],
  );
  const bookmarkLookup = useMemo(
    () => ({
      byClientKey: bookmarksByClientKey,
      categories: state.bookmarkCategories,
      onEditSave: (bookmark: BookmarkItem, payload: { categoryId?: string; categoryName?: string; url: string }) =>
        dispatch({
          type: "bookmark/update",
          bookmarkId: bookmark.id,
          url: payload.url,
          categoryId: payload.categoryId,
          categoryName: payload.categoryName,
        }),
    }),
    [bookmarksByClientKey, state.bookmarkCategories, dispatch],
  );

  const save = useCallback(() => {
    // Reconcile first: it can rewrite node attributes (assigning keys to new
    // checklist blocks), and those belong in the same document version we are
    // about to persist. Reading docJson from the editor rather than from state
    // for the same reason — the attribute write lands in the editor
    // synchronously, but React state is a render behind.
    reconcileRef.current();
    const latestDoc = editor && !editor.isDestroyed ? JSON.stringify(editor.getJSON()) : docJsonRef.current;
    dispatch({
      type: "page/update",
      pageId: pageIdRef.current,
      title: titleRef.current.trim() || undefined,
      icon: iconRef.current,
      docJson: latestDoc,
      preview: pageDocToPreview(latestDoc),
      hashtags: pageDocToHashtags(latestDoc, titleRef.current),
    });
  }, [dispatch, editor]);

  const { schedule } = usePageAutosave(save);

  const handleTitleChange = useCallback((next: string) => {
    setTitle(next);
    schedule();
  }, [schedule]);

  const handleDocChange = useCallback((next: string) => {
    setDocJson(next);
    schedule();
  }, [schedule]);

  const handleImageError = useCallback((message: string) => {
    dispatch({
      type: "toast/add",
      toast: { id: randomId(), title: "Couldn't upload image", body: message, tone: "warning", createdAt: Date.now() },
    });
  }, [dispatch]);

  const handleImageOptimized = useCallback((fileName: string) => {
    dispatch({
      type: "toast/add",
      toast: {
        id: randomId(),
        title: "Image optimized",
        highlight: fileName,
        body: "It was over 800KB, so we compressed it to save space.",
        createdAt: Date.now(),
      },
    });
  }, [dispatch]);

  // Icon picks save immediately rather than through the debounce — same
  // instant-feel as every other icon picker in the app (TodoFolderRow etc).
  const handleIconChange = useCallback((next: string | undefined) => {
    setIcon(next);
    iconRef.current = next;
    save();
  }, [save]);

  // A canvas with a live public link has to keep its published copy current —
  // otherwise the share silently serves whatever the document looked like the
  // last time the share modal happened to be open. Debounced well behind
  // autosave: this is a plaintext push, not a local write.
  const { getToken } = useAuth();
  const { encryptBinary, decryptBinary } = useEncryption();
  const activeSharedPageIds = useQuery(api.sharedPages.listMyActivePageIds);
  const updateShareSnapshot = useMutation(api.sharedPages.updateShareSnapshot);
  const isShared = !!serverPageId && !!activeSharedPageIds?.some((id) => String(id) === serverPageId);
  const share = useQuery(api.sharedPages.getPageShare, serverPageId ? { pageId: serverPageId as Id<"pages"> } : "skip");
  const shareUrl = isShared && share ? `https://omanote.com/s/${share.customSlug || share.shareCode}` : null;

  // Read through a ref: this effect *writes* publishedImages, so depending on
  // its value would re-trigger the effect on its own write and republish in a
  // loop. Same reasoning as SharePageModal.
  const publishedImagesRef = useRef<PublishedImage[]>([]);
  publishedImagesRef.current = share?.publishedImages ?? [];

  useEffect(() => {
    if (!isShared || !serverPageId) return;
    const timer = window.setTimeout(() => {
      void (async () => {
        const token = () => getToken({ template: "convex" });
        // The mapping makes this idempotent. This runs on a debounce after
        // every edit, so without it each typing burst uploaded a fresh
        // decrypted copy of every image in the document and abandoned the
        // previous set with nothing left pointing at them.
        const { blocks, published, obsolete } = await publishBlockImages(
          pageDocToShareBlocks(
            docJson,
            (todoKey) => todosByClientKey.get(todoKey)?.status === "done",
            (bookmarkKey) => bookmarksByClientKey.get(bookmarkKey),
          ),
          token,
          { encryptBinary, decryptBinary },
          publishedImagesRef.current,
        );
        await updateShareSnapshot({
          pageId: serverPageId as Id<"pages">,
          title: title.trim() || undefined,
          blocks,
          publishedImages: published,
        });
        // Only once the snapshot no longer references them — an image removed
        // from the document should not outlive it on a public prefix.
        await unpublishPageImages(obsolete, token);
      })();
    }, SHARE_SNAPSHOT_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [isShared, serverPageId, title, docJson, todosByClientKey, bookmarksByClientKey, updateShareSnapshot, getToken, encryptBinary, decryptBinary]);

  const close = useCallback(() => {
    // The autosave hook flushes on unmount, so nothing needs saving here.
    navigate("/canvas");
  }, [navigate]);

  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const iconButtonRef = useRef<HTMLButtonElement>(null);
  const pageUrl = typeof window !== "undefined" ? `${window.location.origin}/p/${page?.id ?? pageId}` : "";

  // Only ever called while shareUrl is set — see the Copy button's isShared guard.
  const copyLink = useCallback(() => {
    if (!shareUrl) return;
    void navigator.clipboard?.writeText(shareUrl).then(
      () => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
      },
      // Clipboard access can be denied (permissions, insecure context) —
      // leaving the icon unchanged is the honest signal.
      () => {},
    );
  }, [shareUrl]);

  const handleDelete = useCallback(() => {
    if (!page) return;
    // Deleting a shared canvas has to take its published plaintext image
    // copies with it. `page/delete` goes through the offline outbox, which
    // discards mutation return values, so the keys are read here while the
    // share row still has them. (The mutation also deactivates the share
    // server-side, so the public URL dies even if this never runs.)
    const orphanedImageKeys = publishedImagesRef.current.map((image) => image.publicKey);
    if (orphanedImageKeys.length) {
      void unpublishPageImages(orphanedImageKeys, () => getToken({ template: "convex" }));
    }
    // showDeleteToast (wired in AppProvider's page/delete case) covers undo.
    dispatch({ type: "page/delete", pageId: page.id });
    navigate("/canvas");
  }, [dispatch, navigate, page, getToken]);

  const toggleStar = useCallback(() => {
    if (!serverPageId) return;
    dispatch({ type: "page/set-flags", pageId: serverPageId, starred: !page?.starred });
  }, [dispatch, serverPageId, page?.starred]);

  // The row genuinely doesn't exist (bad link, deleted page, or a cache that
  // hasn't synced yet). Distinguishing those three needs server state we don't
  // have offline, so say the honest thing and offer the way back.
  if (!page) {
    return (
      <div className="fixed inset-0 z-app-drawer flex flex-col bg-app-canvas p-4">
        <div className="flex h-full w-full flex-col items-center justify-center gap-4 rounded-2xl bg-app-surface-raised px-6 text-center shadow-soft">
          <SeoHead title="Page | omanote" noIndex />
          <p className="text-sm text-app-ink-muted">This page isn’t available on this device.</p>
          <button
            type="button"
            onClick={close}
            className="rounded-full border border-app-line px-4 py-2 text-sm font-medium text-app-ink transition hover:bg-app-surface-hover"
          >
            Back to canvas
          </button>
        </div>
      </div>
    );
  }

  return (
    // Margin on every side, matching ComposerSheet's inset — this reads as
    // the composer sheet growing into a full document rather than a hard cut
    // to an edge-to-edge page. See use-create-canvas.ts for the morph.
    <div
      className="fixed inset-0 z-app-drawer flex flex-col bg-app-canvas p-4"
      style={{
        paddingTop: "calc(1rem + env(safe-area-inset-top))",
        paddingBottom: "calc(1rem + env(safe-area-inset-bottom))",
      }}
    >
      <div
        className={cn(
          "relative flex h-full w-full min-h-0 flex-col overflow-hidden rounded-2xl bg-app-surface-raised shadow-soft",
          settings.canvasDotGrid && "omanote-canvas-grid",
        )}
        style={{ viewTransitionName: "canvas-expand" }}
      >
        <SeoHead title={title.trim() ? `${title.trim()} | omanote` : "Page | omanote"} noIndex />
        {shareOpen && page ? (
          <SharePageModal
            page={page}
            isTodoDone={(todoKey) => todosByClientKey.get(todoKey)?.status === "done"}
            getBookmark={(bookmarkKey) => bookmarksByClientKey.get(bookmarkKey)}
            onClose={() => setShareOpen(false)}
          />
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1024px] px-5 pb-32 pt-6">
            {/* Icon on the left, actions on the right — both inside the same
                1024px column as the content below, not the wider card. */}
            <div className="mb-4 flex items-center justify-between gap-2">
              <button
                ref={iconButtonRef}
                type="button"
                aria-label="Change page icon"
                onClick={() => setIconPickerOpen((open) => !open)}
                className="flex h-10 w-10 items-center justify-center rounded-xl text-app-ink-muted transition hover:bg-app-surface-hover hover:text-app-ink"
              >
                <CategoryIconView icon={icon} size="md" />
              </button>
              <div className="flex items-center gap-2">
                {serverPageId ? (
                  <>
                    <HeaderActionButton icon={ExternalLink} label="Open in new tab" href={pageUrl} />
                    {/* Only shows up once there's an actual public link to hand out. */}
                    {isShared ? (
                      <HeaderActionButton
                        icon={copied ? Check : Copy}
                        label={copied ? "Copied" : "Copy share link"}
                        onClick={copyLink}
                      />
                    ) : null}
                    <HeaderActionButton
                      icon={Star}
                      label={page.starred ? "Unstar" : "Star"}
                      onClick={toggleStar}
                      active={page.starred}
                    />
                    <HeaderActionButton icon={Share2} label="Share" onClick={() => setShareOpen(true)} />
                    <HeaderActionButton icon={Trash2} label="Delete" onClick={handleDelete} danger />
                  </>
                ) : null}
                <button
                  type="button"
                  aria-label="Close page"
                  onClick={close}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full text-app-ink-muted transition hover:bg-app-surface-hover hover:text-app-ink active:scale-[0.98]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            {iconPickerOpen ? (
              <BookmarkCategoryIconPicker
                anchorRef={iconButtonRef}
                currentIcon={icon}
                onSelect={(next) => {
                  handleIconChange(next);
                  setIconPickerOpen(false);
                }}
                onClose={() => setIconPickerOpen(false)}
              />
            ) : null}

            {/* Title + metadata, its own block above the default separator. */}
            <div className="mb-4">
              <input
                value={title}
                onChange={(event) => handleTitleChange(event.target.value)}
                placeholder="Untitled page"
                aria-label="Page title"
                // Enter in the title moves into the body rather than submitting
                // anything — there is no form here, and a newline in a title is
                // not a thing a document has.
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    focusBodyRef.current?.();
                  }
                }}
                className="app-title-font mb-2 w-full border-none bg-transparent text-3xl font-bold text-app-ink outline-none placeholder:text-app-ink-faint md:text-4xl"
              />
              <PageMetadataRow page={page} docJson={docJson} />
            </div>

            <hr className="mb-6 border-t border-app-line" />

            <PageEditor
              docJson={docJson}
              autoFocus={!title && !page.preview}
              todoLookup={todoLookup}
              bookmarkLookup={bookmarkLookup}
              onDocChange={handleDocChange}
              onEditorReady={handleEditorReady}
              onImageError={handleImageError}
              onImageOptimized={handleImageOptimized}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
