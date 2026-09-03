import { useEffect, useMemo } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { installGlobalErrorHandlers, setErrorSink } from "../lib/error-reporting";
import { detectWebClientType } from "../lib/device-info";
import changelogMarkdown from "../../CHANGELOG.md?raw";
import { parseLatestVersion } from "../lib/update-checker";

/**
 * Connects the app's error-reporting seam to the backend.
 *
 * Renders nothing. Mounted inside the authenticated tree because
 * `clientErrors.report` requires an identity — an anonymous write endpoint
 * would be a free unbounded insert, and the landing page is where the signal is
 * thinnest anyway. See docs/pre-launch-audit.md §1.3.
 */
export function ErrorReporter() {
  const report = useMutation(api.clientErrors.report);
  // The running build's version, read from the changelog bundled at build time
  // — the same source the landing page footer uses. Deliberately not
  // UpdateContext's `latestVersion`, which is the newest version *available*
  // and would mislabel every report from a client that hasn't updated.
  const appVersion = useMemo(() => parseLatestVersion(changelogMarkdown)?.version, []);

  useEffect(() => {
    const clientType = detectWebClientType();

    setErrorSink((payload) => {
      // Fire and forget. A failed report must not surface to the user or
      // trigger another report — that is how a monitor turns one broken
      // request into a loop.
      void report({
        context: payload.context,
        name: payload.name,
        message: payload.message,
        stack: payload.stack,
        appVersion,
        clientType,
        at: payload.at,
      }).catch(() => {});
    });

    const removeGlobalHandlers = installGlobalErrorHandlers();

    return () => {
      setErrorSink(null);
      removeGlobalHandlers();
    };
  }, [report, appVersion]);

  // The outbox's discard reporting is *not* wired here. `setCanvasOutboxObserver`
  // is a single slot, so registering a second observer would silently replace
  // AppProvider's and drop the user-facing toast. AppProvider's observer calls
  // reportError itself instead — one observer, both effects.
  return null;
}
