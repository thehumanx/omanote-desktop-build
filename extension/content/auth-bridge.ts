// Runs on the omanote auth/extension page.
// Bridges the page's window.postMessage to the extension storage/background.
//
// Cross-browser strategy:
// - Listen for the page's `OMANOTE_EXT_AUTH` postMessage (page → content script
//   direction is reliable on both Chrome and Firefox).
// - After processing, signal back to the page by setting an attribute on
//   <html>. Both isolated worlds share the same DOM, so MutationObserver on
//   the page side picks it up immediately. This avoids the content-script →
//   page postMessage path, which can be flaky across worlds.
// - Use `browser.*` if available (Firefox), fall back to `chrome.*`.

declare const browser: typeof chrome | undefined;

(() => {
  const marker = "data-omanote-bridge-installed";
  if (document.documentElement.getAttribute(marker) === "true") {
    document.documentElement.setAttribute("data-omanote-bridge", "ready");
    return;
  }
  document.documentElement.setAttribute(marker, "true");

  const hasBrowserApi = typeof browser !== "undefined";
  const ext: typeof chrome =
    hasBrowserApi ? (browser as typeof chrome) : chrome;

  type ExtensionAuthPayload = {
    token: string;
    expiresAt: number;
    user: { name: string; email: string; imageUrl: string | null };
  };

  function signal(value: string) {
    // setAttribute on documentElement is visible to the page's MutationObserver
    // regardless of isolated-world boundaries.
    document.documentElement.setAttribute("data-omanote-auth", value);
  }

  async function storeAuth(auth: ExtensionAuthPayload): Promise<void> {
    if (hasBrowserApi) {
      await ext.storage.local.set({ omanote_auth: auth });
      return;
    }

    await new Promise<void>((resolve, reject) => {
      chrome.storage.local.set({ omanote_auth: auth }, () => {
        const lastError = chrome.runtime.lastError;
        if (lastError) {
          reject(new Error(lastError.message));
          return;
        }
        resolve();
      });
    });
  }

  function notifyBackground(auth: ExtensionAuthPayload): void {
    const message = {
      type: "AUTH_TOKEN_RECEIVED",
      token: auth.token,
      expiresAt: auth.expiresAt,
      user: auth.user,
    };

    try {
      if (hasBrowserApi) {
        const result = ext.runtime.sendMessage(message);
        if (result && typeof (result as Promise<unknown>).catch === "function") {
          void (result as Promise<unknown>).catch((err) => {
            // Background dormant — storage write is the source of truth.
            console.debug("[omanote auth-bridge] background notify skipped:", err);
          });
        }
        return;
      }

      chrome.runtime.sendMessage(message, () => {
        // Reading lastError prevents Chrome from reporting a noisy unchecked
        // runtime.lastError when no background listener is awake.
        void chrome.runtime.lastError;
      });
    } catch (err) {
      // Background notify is non-fatal. The popup also observes storage changes.
      console.debug("[omanote auth-bridge] background notify skipped:", err);
    }
  }

  // Mark the bridge as loaded so the page can distinguish "bridge never ran"
  // (likely a Firefox host-permissions issue) from "bridge ran but failed".
  document.documentElement.setAttribute("data-omanote-bridge", "ready");
  console.info("[omanote auth-bridge] loaded on", window.location.href);

  window.addEventListener("message", async (event) => {
    if (event.origin !== window.location.origin) return;

    const data = event.data as {
      type?: string;
      token?: string;
      expiresAt?: number;
      user?: unknown;
    };

    if (data?.type !== "OMANOTE_EXT_AUTH") return;
    if (typeof data.token !== "string" || typeof data.expiresAt !== "number") return;

    const rawUser = data.user as Record<string, unknown> | undefined;
    const auth = {
      token: data.token,
      expiresAt: data.expiresAt,
      user: {
        name: typeof rawUser?.name === "string" ? rawUser.name : "",
        email: typeof rawUser?.email === "string" ? rawUser.email : "",
        imageUrl: typeof rawUser?.imageUrl === "string" ? rawUser.imageUrl : null,
      },
    };

    try {
      await storeAuth(auth);
      signal("ok");
      notifyBackground(auth);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error("[omanote auth-bridge]", msg, err);
      signal("error:" + msg);
    }
  });
})();
