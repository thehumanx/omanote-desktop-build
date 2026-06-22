import { ConvexError } from "convex/values";

/**
 * Raw Convex client errors look like:
 *   "[CONVEX M(account:deleteMyData)] [Request ID: ...] Server Error Uncaught Error: ..."
 * These (and other transport-level failures) must never reach the UI.
 */
function isTransportErrorMessage(message: string): boolean {
  return (
    message.startsWith("[CONVEX") ||
    message.includes("[Request ID:") ||
    message.includes("Server Error") ||
    message.includes("Failed to fetch") ||
    message.includes("NetworkError") ||
    message.startsWith("Uncaught ")
  );
}

/**
 * Returns a message that is safe to show to users.
 *
 * - `ConvexError` application data (a string, or an object with a `message`)
 *   is shown as-is — it is authored by our backend for end users.
 * - Locally-thrown `Error` messages pass through, since those are written as
 *   user-facing copy (e.g. "Incorrect passphrase. Please try again.").
 * - Anything transport-level or otherwise technical (Convex server error
 *   strings, network failures, DOMExceptions from WebCrypto, non-Error
 *   throwables) collapses to `fallback`.
 */
export function friendlyErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ConvexError) {
    const data: unknown = err.data;
    if (typeof data === "string" && data.trim()) return data;
    if (
      data !== null &&
      typeof data === "object" &&
      typeof (data as { message?: unknown }).message === "string"
    ) {
      return (data as { message: string }).message;
    }
    return fallback;
  }
  if (typeof DOMException !== "undefined" && err instanceof DOMException) {
    return fallback;
  }
  if (err instanceof Error) {
    const message = err.message.trim();
    if (!message || isTransportErrorMessage(message)) return fallback;
    return message;
  }
  return fallback;
}
