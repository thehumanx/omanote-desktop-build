import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { ClerkProvider, type ClerkProp } from "@clerk/react";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { useAuth as useClerkAuth } from "@clerk/react";
import { Analytics } from "@vercel/analytics/react";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { registerServiceWorker } from "./lib/push-subscription";
import { isTauri, installExternalLinkHandler } from "./lib/desktop";
import { clerkFrontendApiHost, installClerkNativeFetch } from "./lib/desktop-clerk-fetch";
import "./index.css";

const rawClerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined;
const rawConvexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined;

if (!rawClerkPublishableKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");
}

if (!rawConvexUrl) {
  throw new Error("Missing VITE_CONVEX_URL");
}

// Re-bound as plain `string` (not `string | undefined`) so the async
// `bootstrap` closure below doesn't need to re-narrow across the function
// boundary — the guard clauses above already proved these are defined.
const clerkPublishableKey: string = rawClerkPublishableKey;
const convexUrl: string = rawConvexUrl;

const convex = new ConvexReactClient(convexUrl);

async function bootstrap() {
  // Wrapped in an async bootstrap only so the Tauri branch can await bundling
  // Clerk before the first render — everything else keeps running exactly as
  // it did in the synchronous version.
  let bundledClerk: ClerkProp | undefined;

  if (isTauri()) {
    installExternalLinkHandler();
    // Must be installed before Clerk loads so every Frontend API request
    // carries the session credential the webview can't keep in cookies.
    const frontendApiHost = clerkFrontendApiHost(clerkPublishableKey);
    if (frontendApiHost) {
      installClerkNativeFetch(frontendApiHost);
    }

    // ClerkProvider otherwise hot-loads its runtime from Clerk's CDN
    // (https://<frontend-api>/npm/@clerk/clerk-js@6/...) on every single
    // boot, with no offline fallback — that fetch failing is what left the
    // desktop app on a permanent blank screen with no network. Bundling
    // @clerk/clerk-js locally and passing it via the `Clerk` prop skips that
    // network fetch entirely, letting Clerk read its already-cached session
    // from local storage instead. Dynamically imported (not a static import)
    // so this stays a Tauri-only chunk and the web bundle doesn't pay for it.
    const { Clerk } = await import("@clerk/clerk-js");
    bundledClerk = Clerk;
  }

  // Registers even inside Tauri: the desktop shell loads this same live site
  // in its webview, so it needs the same app-shell precaching to boot offline.
  // Push subscriptions still skip themselves separately (pushUnavailable()),
  // this only adds precaching + the offline navigation fallback.
  registerServiceWorker();

  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      {/* The Tauri webview (tauri:// origin) can't persist Clerk's cross-site
          cookies, so Clerk must run in native mode: session kept via
          Authorization headers instead of cookies. */}
      <ClerkProvider publishableKey={clerkPublishableKey} standardBrowser={!isTauri()} Clerk={bundledClerk}>
        <ConvexProviderWithClerk client={convex} useAuth={useClerkAuth}>
          <HelmetProvider>
            <BrowserRouter>
              <ErrorBoundary>
                <App />
              </ErrorBoundary>
            </BrowserRouter>
          </HelmetProvider>
        </ConvexProviderWithClerk>
      </ClerkProvider>
      <Analytics />
    </React.StrictMode>,
  );
}

void bootstrap();
