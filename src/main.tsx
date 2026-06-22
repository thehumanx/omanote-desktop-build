import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ClerkProvider } from "@clerk/react";
import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { useAuth as useClerkAuth } from "@clerk/react";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { registerServiceWorker } from "./lib/push-subscription";
import { isTauri, installExternalLinkHandler } from "./lib/desktop";
import { clerkFrontendApiHost, installClerkNativeFetch } from "./lib/desktop-clerk-fetch";
import "./index.css";

const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined;
const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined;

if (!clerkPublishableKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");
}

if (isTauri()) {
  installExternalLinkHandler();
  // Must be installed before Clerk loads so every Frontend API request
  // carries the session credential the webview can't keep in cookies.
  const frontendApiHost = clerkFrontendApiHost(clerkPublishableKey);
  if (frontendApiHost) {
    installClerkNativeFetch(frontendApiHost);
  }
} else {
  registerServiceWorker();
}

if (!convexUrl) {
  throw new Error("Missing VITE_CONVEX_URL");
}

const convex = new ConvexReactClient(convexUrl);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {/* The Tauri webview (tauri:// origin) can't persist Clerk's cross-site
        cookies, so Clerk must run in native mode: session kept via
        Authorization headers instead of cookies. */}
    <ClerkProvider publishableKey={clerkPublishableKey} standardBrowser={!isTauri()}>
      <ConvexProviderWithClerk client={convex} useAuth={useClerkAuth}>
        <BrowserRouter>
          <ErrorBoundary>
            <App />
          </ErrorBoundary>
        </BrowserRouter>
      </ConvexProviderWithClerk>
    </ClerkProvider>
  </React.StrictMode>,
);
