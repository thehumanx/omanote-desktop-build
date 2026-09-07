import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Check, Copy, X } from "lucide-react";
import type { BookmarkItem, PageItem } from "@omanote/shared";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { BaseModal } from "../BaseModal";
import { cn } from "../ui";
import { ShareEncryptionNotice } from "../ShareEncryptionNotice";
import { ShareLinkMetaEditor } from "../ShareLinkMetaEditor";
import { useShareLinkMeta } from "../../lib/use-share-link-meta";
import { pageDocToShareBlocks } from "../../lib/page-doc";
import { publishBlockImages, unpublishPageImages, type PublishedImage } from "../../lib/page-images";
import { useAuth } from "@clerk/react";
import { useEncryption } from "../../contexts/EncryptionContext";

const DOMAIN = "omanote.com";

function buildShareUrl(codeOrSlug: string) {
  return `https://${DOMAIN}/s/${codeOrSlug}`;
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none",
        checked ? "bg-action-primary" : "bg-app-line",
      )}
    >
      <span
        className={cn(
          "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-app-surface shadow transition duration-200",
          checked ? "translate-x-4" : "translate-x-0",
        )}
      />
    </button>
  );
}

/**
 * Turns public sharing on/off for one canvas.
 *
 * Enabling pushes a plaintext snapshot — the document is encrypted, and a
 * visitor with no key could not read it otherwise. ShareEncryptionNotice says
 * so in the modal rather than leaving it implied, and disabling drops the copy
 * server-side (convex/lib/shareSnapshots.ts).
 */
export function SharePageModal({
  page,
  isTodoDone,
  getBookmark,
  onClose,
}: {
  page: PageItem;
  /** Resolves a checklist block's key to its status, for the published copy. */
  isTodoDone: (todoKey: string) => boolean;
  /** Resolves a link block's bookmark key to its row, for the published preview fields. */
  getBookmark: (bookmarkKey: string) => BookmarkItem | undefined;
  onClose: () => void;
}) {
  const pageId = page.id as Id<"pages">;
  const share = useQuery(api.sharedPages.getPageShare, { pageId });
  const setShareActive = useMutation(api.sharedPages.setShareActive);
  const updateShareSnapshot = useMutation(api.sharedPages.updateShareSnapshot);
  const generateThumbnailUploadUrl = useMutation(api.sharedFolderMeta.generateThumbnailUploadUrl);
  const setPageShareThumbnail = useMutation(api.sharedFolderMeta.setPageShareThumbnail);
  const setPageShareSlug = useMutation(api.sharedFolderMeta.setPageShareSlug);
  const setPageShareDescription = useMutation(api.sharedFolderMeta.setPageShareDescription);

  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const title = page.title?.trim() || "Untitled page";

  const meta = useShareLinkMeta({
    share,
    folderName: title,
    generateUploadUrl: generateThumbnailUploadUrl,
    setThumbnail: (storageId) => {
      if (!share) return Promise.resolve();
      return setPageShareThumbnail({ shareId: share._id, storageId });
    },
    setSlug: (slug) => {
      if (!share) return Promise.resolve();
      return setPageShareSlug({ shareId: share._id, slug });
    },
    setDescription: (description) => {
      if (!share) return Promise.resolve();
      return setPageShareDescription({ shareId: share._id, description });
    },
  });

  const isActive = share?.isActive ?? false;
  const shareUrl = share ? buildShareUrl(share.customSlug || share.shareCode) : null;

  const { getToken } = useAuth();
  const { encryptBinary, decryptBinary } = useEncryption();

  // Read through a ref, not straight off the query. `pushSnapshot` writes this
  // field, so depending on its value directly would rebuild the callback every
  // time the write landed, re-firing the effect below and publishing forever.
  const publishedImagesRef = useRef<PublishedImage[]>([]);
  publishedImagesRef.current = share?.publishedImages ?? [];

  // Same reasoning: callers pass this inline (new function identity every
  // render), so depending on it directly would rebuild pushSnapshot every
  // render, re-firing the effect below and publishing forever.
  const isTodoDoneRef = useRef(isTodoDone);
  isTodoDoneRef.current = isTodoDone;

  const getBookmarkRef = useRef(getBookmark);
  getBookmarkRef.current = getBookmark;

  const pushSnapshot = useCallback(async () => {
    const token = () => getToken({ template: "convex" });
    // Images have to be copied to the public prefix before the snapshot goes
    // out, or the published document would reference keys a visitor cannot
    // read. This is the "decrypted copy on share" step.
    //
    // Passing the existing mapping is what keeps this idempotent: an unchanged
    // image reuses its copy rather than uploading a second one every time this
    // runs (which is on every open of this modal, see the effect below).
    const { blocks, published, obsolete } = await publishBlockImages(
      pageDocToShareBlocks(page.docJson, isTodoDoneRef.current, getBookmarkRef.current),
      token,
      { encryptBinary, decryptBinary },
      publishedImagesRef.current,
    );
    await updateShareSnapshot({
      pageId,
      title: page.title?.trim() || undefined,
      blocks,
      publishedImages: published,
    });
    // Only after the snapshot no longer references them.
    await unpublishPageImages(obsolete, token);
  }, [updateShareSnapshot, pageId, page.title, page.docJson, getToken, encryptBinary, decryptBinary]);

  // Refresh the published copy whenever the modal is open on an active share —
  // the canvas may have been edited since it was last shared.
  useEffect(() => {
    if (!isActive) return;
    void pushSnapshot();
  }, [isActive, pushSnapshot]);

  const toggle = useCallback(
    async (next: boolean) => {
      setBusy(true);
      try {
        // Captured before the mutation clears the row.
        const toUnpublish = next ? [] : publishedImagesRef.current.map((image) => image.publicKey);

        await setShareActive({ pageId, isActive: next, title: page.title?.trim() || undefined });

        if (next) {
          await pushSnapshot();
        } else {
          // Turning the share off has to delete the published copies, not just
          // the snapshot pointing at them. They are *decrypted* bytes on an
          // unauthenticated prefix, so leaving them behind would mean "stop
          // sharing" silently failed to revoke anything for anyone holding a
          // direct image URL.
          //
          // After the mutation, deliberately: the share going dark is the part
          // that must not be blocked by an R2 hiccup.
          await unpublishPageImages(toUnpublish, () => getToken({ template: "convex" }));
        }
      } finally {
        setBusy(false);
      }
    },
    [setShareActive, pageId, page.title, pushSnapshot, getToken],
  );

  const copy = useCallback(() => {
    if (!shareUrl) return;
    void navigator.clipboard?.writeText(shareUrl).then(
      () => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
      },
      // Clipboard access can be denied; leaving the icon unchanged is the
      // honest signal.
      () => {},
    );
  }, [shareUrl]);

  return (
    <BaseModal onClose={onClose} onBackdropMouseDown={onClose} zIndex="z-app-dialog">
      <div
        className="w-full max-w-md rounded-2xl border border-app-line bg-app-surface p-5 shadow-soft"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-app-ink">Share page</h2>
            <p className="mt-0.5 max-w-[300px] truncate text-sm text-app-ink-faint">{title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md text-app-ink-faint transition hover:bg-app-surface-hover hover:text-app-ink-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-app-line bg-app-surface-muted px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-app-ink">Public link</p>
            <p className="mt-0.5 text-xs text-app-ink-faint">Anyone with the link can read this page.</p>
          </div>
          <Toggle checked={isActive} onChange={(next) => { if (!busy) void toggle(next); }} />
        </div>

        {isActive && shareUrl ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 rounded-xl border border-app-line bg-app-surface-muted p-2">
              <span className="min-w-0 flex-1 truncate text-xs text-app-ink-muted">{shareUrl}</span>
              <button
                type="button"
                onClick={copy}
                aria-label={copied ? "Link copied" : "Copy link"}
                className="rounded-full p-1.5 text-app-ink-muted transition hover:bg-app-surface-hover"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>

            <ShareEncryptionNotice noun="page" />

            {share ? <ShareLinkMetaEditor domain={DOMAIN} {...meta} /> : null}
          </div>
        ) : (
          <p className="text-xs text-app-ink-faint">
            Turn on the public link to share this page with anyone.
          </p>
        )}
      </div>
    </BaseModal>
  );
}
