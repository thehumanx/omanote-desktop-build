/**
 * The one place a client-side error becomes a report.
 *
 * omanote had no error reporting at all before this: the top-level
 * `ErrorBoundary` called `console.error`, which nobody reads in production, and
 * ~140 `catch {}` blocks discarded the rest by design. That combination is
 * survivable right up until launch day, when the question stops being "is the
 * code correct" and becomes "did this break for someone, and would we know".
 * See docs/pre-launch-audit.md §1.3.
 *
 * Everything routes through `reportError` so there is exactly one place that
 * decides what leaves the device — which matters more here than in most apps,
 * because in this one the user's content is the thing we promise never to read.
 */

import { ENCRYPTED_PREFIX } from "./crypto";

/** Where scrubbed reports go. Null until an app-level sink registers one. */
export type ErrorSink = (report: ErrorReport) => void;

export interface ErrorReport {
  /** Where in the app this came from — a fixed label, never interpolated. */
  context: string;
  /** Constructor name, e.g. "TypeError". */
  name: string;
  /** Scrubbed message. May be empty if scrubbing removed everything. */
  message: string;
  /** Scrubbed stack, capped to a few frames. */
  stack?: string;
  /** Milliseconds since epoch. */
  at: number;
}

let sink: ErrorSink | null = null;

export function setErrorSink(next: ErrorSink | null) {
  sink = next;
}

const MAX_MESSAGE_LENGTH = 300;
const MAX_STACK_FRAMES = 12;

/**
 * Removes anything that could carry user content out of a string.
 *
 * An error message is not a safe field. `"Failed to decrypt enc:v1:AbC…"` and
 * `"Invalid title: buy anniversary present"` are both plausible, and the second
 * is exactly the material this product promises to keep private. So this is a
 * denylist applied to a field we already treat as untrusted, and the order
 * matters: ciphertext first, because its base64 body would otherwise be
 * partially eaten by the long-token rule and stop being recognisable.
 */
export function scrubForReport(input: string): string {
  return input
    // Ciphertext, including the prefix, so a decrypt failure doesn't ship the payload.
    .replace(new RegExp(`${ENCRYPTED_PREFIX}[A-Za-z0-9+/=_-]*`, "g"), "[ciphertext]")
    // Bearer tokens, JWTs, recovery keys, and anything else long and opaque.
    .replace(/\b[A-Za-z0-9+/=_-]{40,}\b/g, "[redacted]")
    .replace(/\b[\w.+-]+@[\w-]+\.[\w.]+\b/g, "[email]")
    // Query strings and fragments routinely carry tokens and share codes.
    .replace(/(https?:\/\/[^\s?#]+)[?#][^\s]*/g, "$1")
    .slice(0, MAX_MESSAGE_LENGTH);
}

/**
 * Keeps the code path and drops everything else.
 *
 * Stack frames are file/line references rather than data, but bundled frames
 * can carry query strings and inlined values, so they go through the same
 * scrubber. Capped because the tail of a deep stack is rarely what identifies
 * the bug, and an unbounded field is an unbounded write.
 */
function scrubStack(stack: string | undefined): string | undefined {
  if (!stack) return undefined;
  return stack
    .split("\n")
    .slice(0, MAX_STACK_FRAMES)
    .map((line) => scrubForReport(line.trim()))
    .join("\n");
}

/** Builds a report without sending it. Exported for tests and for the sink's own use. */
export function buildErrorReport(error: unknown, context: string): ErrorReport {
  const err = error instanceof Error ? error : undefined;
  const rawMessage = err?.message ?? (typeof error === "string" ? error : "");
  return {
    context,
    name: err?.name ?? "UnknownError",
    message: scrubForReport(rawMessage),
    stack: scrubStack(err?.stack),
    at: Date.now(),
  };
}

/**
 * Reports an error, scrubbed.
 *
 * Never throws and never rejects: a failure here must not become a second
 * error, and reporting is not worth breaking a working page over.
 */
export function reportError(error: unknown, context: string): void {
  try {
    const report = buildErrorReport(error, context);
    // Keeps the existing console behaviour, which is what a developer actually
    // reads while working. The sink is what makes it visible in production.
    console.error(`[omanote] ${context}:`, error);
    sink?.(report);
  } catch {
    // Reporting is best-effort by definition.
  }
}

/**
 * Catches what never reaches a React boundary — rejected promises with no
 * handler, and errors thrown outside the render tree. Returns a cleanup.
 */
export function installGlobalErrorHandlers(): () => void {
  if (typeof window === "undefined") return () => {};

  const onError = (event: ErrorEvent) => reportError(event.error ?? event.message, "window.error");
  const onRejection = (event: PromiseRejectionEvent) => reportError(event.reason, "unhandledrejection");

  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);

  return () => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
  };
}
