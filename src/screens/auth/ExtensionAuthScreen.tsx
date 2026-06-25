import { useEffect, useRef, useState } from "react";
import { useAuth, useUser } from "@clerk/react";
import { CheckCircle2, XCircle } from "lucide-react";
import { Button, LoadingSpinner } from "../../components/ui";
import { extensionAuthUser } from "./extension-auth-user";
import { friendlyErrorMessage } from "../../lib/errors";

type Status = "pending" | "success" | "error";

const BRIDGE_TIMEOUT_MS = 4000;

export function ExtensionAuthScreen() {
  const { getToken, isSignedIn, isLoaded } = useAuth();
  const { user } = useUser();
  const isRefresh = new URLSearchParams(window.location.search).get("mode") === "refresh";
  const [status, setStatus] = useState<Status>("pending");
  const [errorMsg, setErrorMsg] = useState("");
  const [showFirefoxHint, setShowFirefoxHint] = useState(false);
  const bridgeReadyRef = useRef(false);
  const ackedRef = useRef(false);

  // The content-script bridge signals back by setting attributes on <html>:
  //   data-omanote-bridge = "ready"        → bridge loaded
  //   data-omanote-auth   = "ok"           → token written to extension storage
  //   data-omanote-auth   = "error:<msg>"  → bridge ran but storage write failed
  // We use DOM attributes (not postMessage) because both isolated worlds share
  // the same DOM, which avoids the cross-world messaging quirks we hit on Chrome
  // and Firefox.
  useEffect(() => {
    const html = document.documentElement;

    function check() {
      if (html.getAttribute("data-omanote-bridge") === "ready") {
        bridgeReadyRef.current = true;
      }
      const authAttr = html.getAttribute("data-omanote-auth");
      if (authAttr && !ackedRef.current) {
        ackedRef.current = true;
        if (authAttr === "ok") {
          setStatus("success");
          setTimeout(() => window.close(), 2500);
        } else {
          setStatus("error");
          setErrorMsg(authAttr.startsWith("error:") ? authAttr.slice(6) : "The extension could not store your session.");
        }
      }
    }

    // Initial check — bridge may have already set attributes before mount.
    check();

    const observer = new MutationObserver(check);
    observer.observe(html, {
      attributes: true,
      attributeFilter: ["data-omanote-bridge", "data-omanote-auth"],
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      setStatus("error");
      setErrorMsg("You must be signed in to connect the extension.");
      return;
    }

    let cancelled = false;

    async function connect() {
      try {
        const token = await getToken({ template: "convex", skipCache: isRefresh });
        if (!token) throw new Error("Could not obtain auth token.");
        if (cancelled) return;

        const expiresAt = Date.now() + 55 * 60 * 1000;
        const authUser = extensionAuthUser(user);

        window.postMessage(
          { type: "OMANOTE_EXT_AUTH", token, expiresAt, user: authUser },
          window.location.origin,
        );

        // If the bridge never ack'd within the timeout, the content script
        // probably didn't run — most often a Firefox host-permissions issue.
        setTimeout(() => {
          if (cancelled || ackedRef.current) return;
          setStatus("error");
          if (!bridgeReadyRef.current) {
            setShowFirefoxHint(true);
            setErrorMsg(
              "The omanote extension didn't respond on this page. " +
              "If you're on Firefox, you likely need to grant host permissions for this site.",
            );
          } else {
            setErrorMsg("The extension received the request but could not save your session. Please try again.");
          }
        }, BRIDGE_TIMEOUT_MS);
      } catch (err) {
        if (cancelled) return;
        setErrorMsg(friendlyErrorMessage(err, "Could not connect the extension. Please try again."));
        setStatus("error");
      }
    }

    void connect();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, getToken, user]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-app-surface-muted p-6">
      <div className="w-full max-w-sm rounded-2xl border border-app-line bg-app-surface px-10 py-10 text-center shadow-sm">
        <img
          src="/android-chrome-192x192.png"
          alt="omanote"
          className="mx-auto mb-5 block h-16 w-16 rounded-2xl"
        />

        <p className="mb-2 text-xs font-bold uppercase tracking-widest text-app-ink-faint">
          omanote extension
        </p>

        {status === "pending" && (
          <>
            <h1 className="mb-2.5 text-xl font-black tracking-tight text-app-ink">
              Connecting…
            </h1>
            <p className="text-sm leading-relaxed text-app-ink-faint">
              {isRefresh ? "Refreshing your omanote extension session." : "Authorizing your omanote extension."} This tab will close automatically.
            </p>
            <div className="mt-6 flex justify-center">
              <LoadingSpinner />
            </div>
          </>
        )}

        {status === "success" && (
          <>
            <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-success-solid" aria-hidden="true" />
            <h1 className="mb-2.5 text-xl font-black tracking-tight text-success-solid">
              Connected!
            </h1>
            <p className="text-sm leading-relaxed text-app-ink-faint">
              Your omanote extension is ready. You can close this tab.
            </p>
          </>
        )}

        {status === "error" && (
          <>
            <XCircle className="mx-auto mb-3 h-10 w-10 text-danger-solid" aria-hidden="true" />
            <h1 className="mb-2.5 text-xl font-black tracking-tight text-danger-solid">
              Connection failed
            </h1>
            <p className={`text-sm leading-relaxed text-app-ink-faint ${showFirefoxHint ? "mb-3" : "mb-5"}`}>
              {errorMsg}
            </p>
            {showFirefoxHint && (
              <div className="mb-5 rounded-lg border border-warning-line bg-warning-surface p-3 text-left text-xs leading-snug text-warning-ink">
                <strong className="block mb-1">Firefox: enable host access</strong>
                Open <code>about:addons</code> → omanote → <em>Permissions</em>, then turn on
                <em> "Access your data for sites in the omanote.com domain"</em>.
                Reload this page afterwards.
              </div>
            )}
            <Button
              onClick={() => window.location.reload()}
              className="w-full"
            >
              Try again
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
