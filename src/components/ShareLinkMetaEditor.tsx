import { Image as ImageIcon, Loader2 } from "lucide-react";
import type { ChangeEvent, RefObject } from "react";

const MAX_DESCRIPTION_LENGTH = 280;

/**
 * Thumbnail / custom-URL / description block shared by the bookmark-todo and
 * note folder share modals. Both wrap the same three `sharedFolders`-shaped
 * fields around different Convex tables, so the editor itself stays table-agnostic
 * and takes plain values + callbacks.
 */
export function ShareLinkMetaEditor({
  domain,
  slugValue,
  defaultSlug,
  onSlugChange,
  onSlugCommit,
  isSavingSlug,
  slugError,
  descriptionValue,
  onDescriptionChange,
  isSavingDescription,
  hasThumbnail,
  thumbnailUrl,
  isUploadingThumbnail,
  thumbnailError,
  onThumbnailPick,
  onThumbnailRemove,
  onThumbnailFileSelected,
  fileInputRef,
}: {
  domain: string;
  slugValue: string;
  defaultSlug: string;
  onSlugChange: (value: string) => void;
  onSlugCommit: (value: string) => void;
  isSavingSlug: boolean;
  slugError: string | null;
  descriptionValue: string;
  onDescriptionChange: (value: string) => void;
  isSavingDescription: boolean;
  hasThumbnail: boolean;
  thumbnailUrl: string | null;
  isUploadingThumbnail: boolean;
  thumbnailError: string | null;
  onThumbnailPick: () => void;
  onThumbnailRemove: () => void;
  onThumbnailFileSelected: (e: ChangeEvent<HTMLInputElement>) => void;
  fileInputRef: RefObject<HTMLInputElement>;
}) {
  return (
    <>
      <div className="rounded-xl border border-app-line bg-app-surface-muted p-3">
        <span className="text-sm font-medium text-app-ink-muted">Link preview</span>
        <p className="mt-0.5 text-xs text-app-ink-faint">
          Shown when this link is shared on social apps or messengers.
        </p>
        <div className="mt-3 flex items-center gap-3">
          <div className="relative flex h-14 w-24 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg border border-app-line bg-app-surface">
            {hasThumbnail ? (
              <img src={thumbnailUrl ?? ""} alt="" className="h-full w-full object-cover" />
            ) : (
              <ImageIcon className="h-5 w-5 text-app-ink-faint" />
            )}
            {isUploadingThumbnail && (
              <div className="absolute inset-0 flex items-center justify-center bg-app-surface/70">
                <Loader2 className="h-4 w-4 animate-spin text-app-ink-faint" />
              </div>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onThumbnailPick}
                disabled={isUploadingThumbnail}
                className="rounded-md border border-app-line bg-app-surface px-2.5 py-1 text-xs font-medium text-app-ink-muted transition hover:bg-app-surface-hover disabled:opacity-50"
              >
                {hasThumbnail ? "Change" : "Upload image"}
              </button>
              {hasThumbnail && (
                <button
                  type="button"
                  onClick={onThumbnailRemove}
                  disabled={isUploadingThumbnail}
                  className="rounded-md px-2.5 py-1 text-xs font-medium text-app-ink-faint transition hover:text-app-ink-muted disabled:opacity-50"
                >
                  Remove
                </button>
              )}
            </div>
            <span className="text-[11px] text-app-ink-faint">1200×630, cropped to fit</span>
            {thumbnailError && <span className="text-[11px] text-danger-ink">{thumbnailError}</span>}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onThumbnailFileSelected}
          />
        </div>
      </div>

      <div className="rounded-xl border border-app-line bg-app-surface-muted p-3">
        <span className="text-sm font-medium text-app-ink-muted">Custom link</span>
        <div className="mt-1.5 flex items-center gap-1 rounded-md border border-app-line bg-app-surface px-2.5 py-1.5">
          <span className="flex-shrink-0 text-[13px] text-app-ink-faint">{domain}/s/</span>
          <input
            type="text"
            value={slugValue}
            onChange={(e) => onSlugChange(e.target.value)}
            onBlur={(e) => onSlugCommit(e.target.value)}
            placeholder={defaultSlug}
            className="min-w-0 flex-1 bg-transparent text-[13px] text-app-ink outline-none"
          />
          {isSavingSlug && <Loader2 className="h-3 w-3 flex-shrink-0 animate-spin text-app-ink-faint" />}
        </div>
        {slugError && <p className="mt-1 text-[11px] text-danger-ink">{slugError}</p>}
      </div>

      <div className="rounded-xl border border-app-line bg-app-surface-muted p-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-app-ink-muted">Description</span>
          <span className="text-[11px] text-app-ink-faint">
            {isSavingDescription ? "Saving…" : `${descriptionValue.length}/${MAX_DESCRIPTION_LENGTH}`}
          </span>
        </div>
        <textarea
          value={descriptionValue}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="Optional description shown on the link preview"
          rows={2}
          className="mt-1.5 w-full resize-none rounded-md border border-app-line bg-app-surface px-2.5 py-1.5 text-[13px] text-app-ink outline-none placeholder:text-app-ink-faint"
        />
      </div>
    </>
  );
}
