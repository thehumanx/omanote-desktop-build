export const THUMBNAIL_WIDTH = 1200;
export const THUMBNAIL_HEIGHT = 630;
const THUMBNAIL_QUALITY = 0.8;

/**
 * Center-crops and downsamples an uploaded image to the fixed share-card
 * dimensions (1200x630) client-side, so we never store a full-resolution
 * original for something that's only ever shown as a small preview.
 */
export function cropImageToThumbnail(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const targetRatio = THUMBNAIL_WIDTH / THUMBNAIL_HEIGHT;
      const sourceRatio = img.width / img.height;

      let sx = 0;
      let sy = 0;
      let sWidth = img.width;
      let sHeight = img.height;

      if (sourceRatio > targetRatio) {
        sWidth = img.height * targetRatio;
        sx = (img.width - sWidth) / 2;
      } else {
        sHeight = img.width / targetRatio;
        sy = (img.height - sHeight) / 2;
      }

      const canvas = document.createElement("canvas");
      canvas.width = THUMBNAIL_WIDTH;
      canvas.height = THUMBNAIL_HEIGHT;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not process image"));
        return;
      }

      ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Could not process image"));
            return;
          }
          resolve(blob);
        },
        "image/jpeg",
        THUMBNAIL_QUALITY,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not load image"));
    };

    img.src = objectUrl;
  });
}
