const IMAGES_URL = "https://omanote-page-images.iambishistha.workers.dev";

/**
 * Upload/serve helpers for canvas images.
 *
 * Images are encrypted on the device with the same AES-GCM content key as
 * everything else, so what R2 holds is an opaque blob — the server can't open
 * them any more than it can read a note. The worker's per-user access check is
 * still there, but it now bounds *cost and abuse* rather than being the only
 * thing protecting the content.
 *
 * The one exception is publishing: a public share has to be readable by a
 * visitor with no key, so `publishPageImage` uploads a **decrypted copy** to a
 * separate public prefix. That is an explicit act with a visible consequence,
 * and turning the share off deletes the copy.
 */

/**
 * Formats accepted for upload. Enforced client-side because the worker can no
 * longer see what it is storing — an encrypted blob has no content type. SVG
 * is excluded on purpose: it can carry script, and the *published* copies are
 * served as real images.
 */
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif"]);

/** Hard ceiling the worker enforces on the encrypted upload — a last-resort backstop, not the target (see MAX_UPLOAD_BYTES). */
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/** Target size for what actually gets uploaded — storage is capped per-user, so every image counts against it. */
export const MAX_UPLOAD_BYTES = 800 * 1024;

/**
 * Re-encodes an oversized image as JPEG, shrinking quality then dimensions
 * until it's under MAX_UPLOAD_BYTES (or six attempts in — a pathological
 * image gets uploaded slightly over the target rather than looping forever).
 *
 * GIF is excluded by the caller: canvas re-encoding only ever captures one
 * frame, so "compressing" an animated GIF would silently kill the animation.
 */
async function compressImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  let width = bitmap.width;
  let height = bitmap.height;
  let quality = 0.85;

  // Downscale first if the source is huge — quality alone rarely gets a
  // multi-megapixel photo under the target, and a smaller canvas compresses
  // faster on every subsequent attempt.
  const maxDimension = 2000;
  if (Math.max(width, height) > maxDimension) {
    const scale = maxDimension / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  let lastBlob: Blob | null = null;
  for (let attempt = 0; attempt < 6; attempt++) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new PageImageError("Could not process that image", "type");
    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!blob) throw new PageImageError("Could not process that image", "type");
    lastBlob = blob;
    if (blob.size <= MAX_UPLOAD_BYTES) {
      bitmap.close();
      return blob;
    }
    if (quality > 0.4) {
      quality -= 0.15;
    } else {
      width = Math.round(width * 0.8);
      height = Math.round(height * 0.8);
    }
  }
  bitmap.close();
  // Best effort — the last attempt is the smallest we got, still better than
  // refusing the upload outright.
  return lastBlob!;
}

export type ImageTokenGetter = () => Promise<string | null>;

/** Supplied by EncryptionContext — see encryptBinary/decryptBinary there. */
export interface ImageCrypto {
  encryptBinary: (bytes: ArrayBuffer, mimeType: string) => Promise<ArrayBuffer>;
  decryptBinary: (payload: ArrayBuffer) => Promise<{ bytes: ArrayBuffer; mimeType: string }>;
}

export class PageImageError extends Error {
  constructor(message: string, public code: "type" | "size" | "network" | "auth" | "quota" | "decrypt") {
    super(message);
    this.name = "PageImageError";
  }
}

export function isAllowedImageType(type: string): boolean {
  return ALLOWED_TYPES.has(type);
}

/**
 * Encrypts one image, uploads the ciphertext, and returns the object key.
 *
 * The key is all that goes into the document — the bytes are never addressable
 * without both a session and the content key.
 */
export async function uploadPageImage(
  file: File,
  getToken: ImageTokenGetter,
  crypto: ImageCrypto,
  // Called once, only when the file actually got recompressed — the caller
  // uses it to give the user a heads-up rather than silently swapping bytes.
  onOptimized?: () => void,
): Promise<{ key: string; bytes: number }> {
  if (!isAllowedImageType(file.type)) {
    throw new PageImageError("That image format isn’t supported", "type");
  }

  let source: Blob = file;
  if (file.size > MAX_UPLOAD_BYTES) {
    if (file.type === "image/gif") {
      throw new PageImageError("That GIF is too large (max 800KB) — resize it before uploading", "size");
    }
    source = await compressImage(file);
    onOptimized?.();
  }
  if (source.size > MAX_IMAGE_BYTES) {
    throw new PageImageError("That image is too large even after compressing it", "size");
  }

  const token = await getToken();
  if (!token) throw new PageImageError("Not signed in", "auth");

  const payload = await crypto.encryptBinary(await source.arrayBuffer(), source.type || file.type);

  const response = await fetch(`${IMAGES_URL}/`, {
    method: "PUT",
    headers: {
      // Opaque by design: the worker stores bytes it cannot interpret.
      "Content-Type": "application/octet-stream",
      Authorization: `Bearer ${token}`,
    },
    body: payload,
  });

  if (!response.ok) {
    // 507 is the worker refusing the upload because the account is at the
    // 200MB cap (see requireStorageBudget). Surfacing that as "Upload failed
    // (507)" tells the user nothing they can act on.
    if (response.status === 507) {
      throw new PageImageError(
        "You're out of storage (200MB). Delete something to free up space, then try again.",
        "quota",
      );
    }
    throw new PageImageError(`Upload failed (${response.status})`, response.status === 401 ? "auth" : "network");
  }

  const { key } = (await response.json()) as { key: string };
  // The plaintext (post-compression) size — what "12.3 KB" should mean to a
  // user, not the somewhat-larger encrypted payload actually on the wire.
  return { key, bytes: source.size };
}

/**
 * Fetches an image, decrypts it, and returns a blob URL.
 *
 * Callers own the returned URL and must revoke it — see PageImageNode, which
 * does so on unmount and on a fetch that resolves after unmount.
 */
export async function fetchPageImageObjectUrl(
  key: string,
  getToken: ImageTokenGetter,
  crypto: ImageCrypto,
): Promise<string> {
  const token = await getToken();
  if (!token) throw new PageImageError("Not signed in", "auth");

  const response = await fetch(`${IMAGES_URL}/${key}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new PageImageError(`Could not load image (${response.status})`, "network");
  }

  try {
    const { bytes, mimeType } = await crypto.decryptBinary(await response.arrayBuffer());
    return URL.createObjectURL(new Blob([bytes], { type: mimeType }));
  } catch {
    // A blob that won't decrypt is not a network problem, and saying "couldn't
    // load" would send someone checking their connection for a key mismatch.
    throw new PageImageError("This image could not be decrypted", "decrypt");
  }
}

/** The unauthenticated URL for an image published alongside a shared canvas. */
export function publicPageImageUrl(key: string): string {
  return `${IMAGES_URL}/${key}`;
}

/**
 * Publishes a **decrypted copy** of an image so a shared canvas can render it.
 *
 * The private object stays encrypted and untouched. This copy is deliberately
 * plaintext — that is what a public link means, and it is the whole reason the
 * privacy policy carves out shared canvases. Deleting the share deletes it.
 *
 * Done client-side rather than as a server-side bucket copy because the server
 * has no key: it cannot turn the stored ciphertext into something a visitor
 * could render.
 */
export async function publishPageImage(
  key: string,
  getToken: ImageTokenGetter,
  crypto: ImageCrypto,
): Promise<string> {
  const token = await getToken();
  if (!token) throw new PageImageError("Not signed in", "auth");

  const source = await fetch(`${IMAGES_URL}/${key}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!source.ok) throw new PageImageError(`Could not read image (${source.status})`, "network");

  const { bytes, mimeType } = await crypto.decryptBinary(await source.arrayBuffer());
  if (!isAllowedImageType(mimeType)) {
    throw new PageImageError("That image format isn’t supported", "type");
  }

  const response = await fetch(`${IMAGES_URL}/publish`, {
    method: "POST",
    headers: { "Content-Type": mimeType, Authorization: `Bearer ${token}` },
    body: bytes,
  });
  if (!response.ok) throw new PageImageError(`Could not publish image (${response.status})`, "network");

  const { key: publicKey } = (await response.json()) as { key: string };
  return publicKey;
}

/** Shared by unpublishPageImage and deletePageImage — same DELETE endpoint handles both prefixes (see the worker's canAccessKey). */
async function deleteImageObject(key: string, getToken: ImageTokenGetter): Promise<void> {
  const token = await getToken();
  if (!token) throw new PageImageError("Not signed in", "auth");

  const response = await fetch(`${IMAGES_URL}/${key}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok && response.status !== 404) {
    throw new PageImageError(`Could not delete image (${response.status})`, "network");
  }
}

/** Deletes a published copy. Safe to call for a key that is already gone. */
export async function unpublishPageImage(publicKey: string, getToken: ImageTokenGetter): Promise<void> {
  return deleteImageObject(publicKey, getToken);
}

/**
 * Deletes a batch of published copies, ignoring individual failures.
 *
 * Callers run this *after* the share has already been turned off server-side,
 * so there is nothing useful to do about one key failing — the share is
 * already dark, and throwing here would only turn a partial cleanup into a
 * visible error on an operation the user experienced as succeeding. A missed
 * object is a leaked copy; surfacing it as a failed unshare would be worse.
 */
export async function unpublishPageImages(
  publicKeys: readonly string[],
  getToken: ImageTokenGetter,
): Promise<void> {
  await Promise.allSettled(publicKeys.map((key) => deleteImageObject(key, getToken)));
}

/** Deletes a private image — used when a user removes an image block from a page. */
export async function deletePageImage(objectKey: string, getToken: ImageTokenGetter): Promise<void> {
  return deleteImageObject(objectKey, getToken);
}

/** A published plaintext copy, and the private object it was made from. */
export interface PublishedImage {
  sourceKey: string;
  publicKey: string;
}

/**
 * Replaces every private image key in a set of share blocks with a published
 * public copy.
 *
 * `alreadyPublished` is the mapping stored on the share row. Passing it makes
 * a re-publish reuse the existing copy for an unchanged image instead of
 * minting a new one — necessary because the snapshot is rebuilt from the
 * document, whose urls are always private `u/` keys. Without it, every refresh
 * (and the share modal refreshes on open) uploaded a fresh decrypted copy and
 * abandoned the previous one, with nothing left pointing at it to delete.
 *
 * Returns the rewritten blocks, the mapping to persist, and `obsolete` — the
 * public keys that are no longer referenced and must now be deleted from R2.
 */
export async function publishBlockImages(
  blocks: Array<{ type: string; url?: string }>,
  getToken: ImageTokenGetter,
  crypto: ImageCrypto,
  alreadyPublished: readonly PublishedImage[] = [],
): Promise<{
  blocks: Array<{ type: string; url?: string }>;
  published: PublishedImage[];
  obsolete: string[];
}> {
  const existing = new Map(alreadyPublished.map((image) => [image.sourceKey, image.publicKey]));
  const published: PublishedImage[] = [];

  const next = await Promise.all(
    blocks.map(async (block) => {
      if (block.type !== "image" || !block.url) return block;
      const sourceKey = block.url;

      // Defensive: a key already under the public prefix would be a copy from
      // an earlier publish, so it is its own source.
      if (sourceKey.startsWith("p/")) {
        published.push({ sourceKey, publicKey: sourceKey });
        return block;
      }

      const reused = existing.get(sourceKey);
      if (reused) {
        published.push({ sourceKey, publicKey: reused });
        return { ...block, url: reused };
      }

      try {
        const publicKey = await publishPageImage(sourceKey, getToken, crypto);
        published.push({ sourceKey, publicKey });
        return { ...block, url: publicKey };
      } catch {
        // One image failing must not block publishing the rest of the
        // document; the public page skips a block with no url.
        return { ...block, url: "" };
      }
    }),
  );

  // Anything previously published whose source is no longer in the document —
  // the image was deleted or replaced, so its public copy has to go too.
  const liveKeys = new Set(published.map((image) => image.publicKey));
  const obsolete = alreadyPublished
    .map((image) => image.publicKey)
    .filter((publicKey) => !liveKeys.has(publicKey));

  return { blocks: next, published, obsolete };
}
