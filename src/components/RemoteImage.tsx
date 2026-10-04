import type { ImgHTMLAttributes } from "react";

/**
 * An image from someone else's server — a bookmark's thumbnail or favicon, a
 * feed's artwork, a link preview.
 *
 * Fetching it tells that server something; this keeps it to the minimum:
 * - `no-referrer`, so the request doesn't say it came from omanote (the
 *   site-wide policy would send our origin);
 * - `lazy`, so only images actually scrolled into view are requested, not
 *   every thumbnail in a long list.
 *
 * Use it for any `src` that isn't ours. Our own assets (page images, share
 * thumbnails in Convex storage, the logo) stay plain `<img>`.
 */
export function RemoteImage(props: ImgHTMLAttributes<HTMLImageElement>) {
  return <img referrerPolicy="no-referrer" loading="lazy" decoding="async" {...props} />;
}
