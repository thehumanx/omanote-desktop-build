import { useEffect, useRef, useState } from "react";
import { SignInButton, SignUpButton, useAuth } from "@clerk/react";
import { useAction } from "convex/react";
import { MonitorCheck, XCircle } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Button, LoadingSpinner } from "../../components/ui";
import { desktopAuthDeepLink } from "../../lib/desktop-auth";
import { friendlyErrorMessage } from "../../lib/errors";

type Status = "pending" | "ready" | "error";

/**
 * Opened in the system browser by the desktop app. Once the user is signed
 * in here (normal Clerk web flow), we mint a single-use sign-in token via
 * Convex and bounce it back into the app through the omanote:// deep link.
 */
export function DesktopAuthScreen() {
  const { isLoaded, isSignedIn } = useAuth();
  const createSignInToken = useAction(api.desktopAuth.createSignInToken);
  const state = new URLSearchParams(window.location.search).get("state");
  const [status, setStatus] = useState<Status>("pending");
  const [errorMsg, setErrorMsg] = useState("");
  const [deepLink, setDeepLink] = useState<string | null>(null);
  const startedRef = useRef(false);

  const returnHere = `/auth/desktop${state ? `?state=${state}` : ""}`;

  useEffect(() => {
    if (!isLoaded || !isSignedIn || startedRef.current) return;
    startedRef.current = true;

    createSignInToken({})
      .then(({ token }) => {
        const link = desktopAuthDeepLink(token, state);
        setDeepLink(link);
        setStatus("ready");
        // Hand off to the app; the browser shows its "Open omanote?" prompt.
        window.location.href = link;
      })
      .catch((err) => {
        setErrorMsg(
          friendlyErrorMessage(err, "Could not connect the desktop app. Please try again."),
        );
        setStatus("error");
      });
  }, [isLoaded, isSignedIn, createSignInToken, state]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-app-surface-muted p-6">
      <div className="w-full max-w-sm rounded-2xl border border-app-line bg-app-surface px-10 py-10 text-center shadow-sm">
        <img
          src="/android-chrome-192x192.png"
          alt="omanote"
          className="mx-auto mb-5 block h-16 w-16 rounded-2xl"
        />

        <p className="mb-2 text-xs font-bold uppercase tracking-widest text-app-ink-faint">
          omanote desktop
        </p>

        {!isLoaded && (
          <div className="mt-6 flex justify-center">
            <LoadingSpinner />
          </div>
        )}

        {isLoaded && !isSignedIn && (
          <>
            <h1 className="mb-2.5 text-xl font-black tracking-tight text-app-ink">
              Sign in to continue
            </h1>
            <p className="mb-6 text-sm leading-relaxed text-app-ink-faint">
              Sign in to your omanote account to finish setting up the desktop app.
            </p>
            <div className="space-y-3">
              <SignInButton mode="modal" fallbackRedirectUrl={returnHere}>
                <Button className="w-full">Sign in</Button>
              </SignInButton>
              <SignUpButton mode="modal" fallbackRedirectUrl={returnHere}>
                <Button tone="soft" className="w-full">Create account</Button>
              </SignUpButton>
            </div>
          </>
        )}

        {isLoaded && isSignedIn && status === "pending" && (
          <>
            <h1 className="mb-2.5 text-xl font-black tracking-tight text-app-ink">
              Connecting…
            </h1>
            <p className="text-sm leading-relaxed text-app-ink-faint">
              Authorizing your omanote desktop app.
            </p>
            <div className="mt-6 flex justify-center">
              <LoadingSpinner />
            </div>
          </>
        )}

        {status === "ready" && (
          <>
            <MonitorCheck className="mx-auto mb-3 h-10 w-10 text-success-solid" aria-hidden="true" />
            <h1 className="mb-2.5 text-xl font-black tracking-tight text-success-solid">
              Almost there!
            </h1>
            <p className="mb-5 text-sm leading-relaxed text-app-ink-faint">
              Allow your browser to open omanote when asked. If nothing happens, use the
              button below, then you can close this tab.
            </p>
            <Button onClick={() => deepLink && (window.location.href = deepLink)} className="w-full">
              Open omanote
            </Button>
          </>
        )}

        {status === "error" && (
          <>
            <XCircle className="mx-auto mb-3 h-10 w-10 text-danger-solid" aria-hidden="true" />
            <h1 className="mb-2.5 text-xl font-black tracking-tight text-danger-solid">
              Connection failed
            </h1>
            <p className="mb-5 text-sm leading-relaxed text-app-ink-faint">{errorMsg}</p>
            <Button onClick={() => window.location.reload()} className="w-full">
              Try again
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
