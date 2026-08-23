import { useEffect, useRef, useState, type ChangeEvent } from "react";
import type { Id } from "../../convex/_generated/dataModel";
import { slugify } from "./slug";
import { cropImageToThumbnail } from "./thumbnail-crop";

const DESCRIPTION_SAVE_DEBOUNCE_MS = 600;
const MAX_DESCRIPTION_LENGTH = 280;

type ShareMeta = {
  customSlug?: string;
  description?: string;
  thumbnailStorageId?: Id<"_storage">;
  thumbnailUrl?: string | null;
} | null | undefined;

/**
 * Owns the upload/slug/description editing state for a share's link-preview
 * metadata. A share row only exists once its public link has been turned on
 * at least once, so `share` is nullable — callers should only render the
 * editor once it's defined.
 */
export function useShareLinkMeta({
  share,
  folderName,
  generateUploadUrl,
  setThumbnail,
  setSlug,
  setDescription,
}: {
  share: ShareMeta;
  folderName: string;
  generateUploadUrl: () => Promise<string>;
  setThumbnail: (storageId: Id<"_storage"> | undefined) => Promise<unknown>;
  setSlug: (slug: string | undefined) => Promise<unknown>;
  setDescription: (description: string | undefined) => Promise<unknown>;
}) {
  const [isUploadingThumbnail, setIsUploadingThumbnail] = useState(false);
  const [thumbnailError, setThumbnailError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [slugDraft, setSlugDraft] = useState<string | null>(null);
  const [slugError, setSlugError] = useState<string | null>(null);
  const [isSavingSlug, setIsSavingSlug] = useState(false);

  const [descriptionDraft, setDescriptionDraft] = useState<string | null>(null);
  const [isSavingDescription, setIsSavingDescription] = useState(false);
  const descriptionSaveRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (descriptionSaveRef.current !== null) window.clearTimeout(descriptionSaveRef.current);
    };
  }, []);

  const defaultSlug = slugify(folderName);
  const savedSlug = share?.customSlug;
  const slugValue = slugDraft ?? savedSlug ?? defaultSlug;
  const descriptionValue = descriptionDraft ?? share?.description ?? "";

  const handleThumbnailPick = () => fileInputRef.current?.click();

  const handleThumbnailFileSelected = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setThumbnailError(null);
    setIsUploadingThumbnail(true);
    try {
      const blob = await cropImageToThumbnail(file);
      const uploadUrl = await generateUploadUrl();
      const uploadRes = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": blob.type },
        body: blob,
      });
      if (!uploadRes.ok) throw new Error("Upload failed");
      const { storageId } = (await uploadRes.json()) as { storageId: Id<"_storage"> };
      await setThumbnail(storageId);
    } catch {
      setThumbnailError("Couldn't upload image. Try again.");
    } finally {
      setIsUploadingThumbnail(false);
    }
  };

  const handleThumbnailRemove = async () => {
    setThumbnailError(null);
    setIsUploadingThumbnail(true);
    try {
      await setThumbnail(undefined);
    } finally {
      setIsUploadingThumbnail(false);
    }
  };

  const commitSlug = async (rawValue: string) => {
    const next = slugify(rawValue);
    setSlugDraft(next);
    if (next === (savedSlug ?? defaultSlug)) return;

    // A previously-shared custom link stops resolving the moment its slug
    // changes — the raw share code still works, but anyone holding the old
    // custom URL is left with a dead link. Confirm before doing that.
    if (savedSlug && next !== savedSlug) {
      const proceed = window.confirm(
        `Changing the link from "${savedSlug}" to "${next || defaultSlug}" will break the old link for anyone who already has it. Continue?`,
      );
      if (!proceed) {
        setSlugDraft(savedSlug);
        return;
      }
    }

    setIsSavingSlug(true);
    setSlugError(null);
    try {
      await setSlug(next || undefined);
    } catch (err) {
      setSlugError(err instanceof Error ? err.message : "Couldn't save link");
      setSlugDraft(savedSlug ?? null);
    } finally {
      setIsSavingSlug(false);
    }
  };

  const handleDescriptionChange = (value: string) => {
    const next = value.slice(0, MAX_DESCRIPTION_LENGTH);
    setDescriptionDraft(next);
    if (descriptionSaveRef.current !== null) window.clearTimeout(descriptionSaveRef.current);
    descriptionSaveRef.current = window.setTimeout(async () => {
      setIsSavingDescription(true);
      try {
        await setDescription(next || undefined);
      } finally {
        setIsSavingDescription(false);
      }
    }, DESCRIPTION_SAVE_DEBOUNCE_MS);
  };

  return {
    defaultSlug,
    slugValue,
    onSlugChange: setSlugDraft,
    onSlugCommit: commitSlug,
    isSavingSlug,
    slugError,
    descriptionValue,
    onDescriptionChange: handleDescriptionChange,
    isSavingDescription,
    hasThumbnail: Boolean(share?.thumbnailStorageId),
    thumbnailUrl: share?.thumbnailUrl ?? null,
    isUploadingThumbnail,
    thumbnailError,
    onThumbnailPick: handleThumbnailPick,
    onThumbnailRemove: handleThumbnailRemove,
    onThumbnailFileSelected: handleThumbnailFileSelected,
    fileInputRef,
  };
}
