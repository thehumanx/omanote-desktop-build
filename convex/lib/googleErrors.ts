import { ConvexError } from "convex/values";

// Google returns Retry-After either as whole seconds or an HTTP-date.
function parseRetryAfterMs(res: Response): number {
  const header = res.headers.get("Retry-After");
  if (!header) return 0;
  const seconds = Number(header);
  if (!Number.isNaN(seconds) && seconds > 0) return seconds * 1000;
  const dateMs = Date.parse(header);
  if (!Number.isNaN(dateMs)) return Math.max(0, dateMs - Date.now());
  return 0;
}

/**
 * Throws for a failed Google API response. On 429 specifically, attaches a
 * `retryAfterMs` to the ConvexError's data so the client outbox
 * (runWithCanvasOutboxFallback / flushCanvasOutbox in canvas-outbox.ts) can
 * wait out the rate limit instead of retrying immediately on next flush.
 */
export function throwGoogleApiError(res: Response | undefined, message: string): never {
  if (res?.status === 429) {
    const retryAfterMs = parseRetryAfterMs(res) || 60_000;
    throw new ConvexError({
      message: "Google is rate-limiting requests right now — this will retry automatically.",
      retryAfterMs,
    });
  }
  throw new ConvexError(message);
}
