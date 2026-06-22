/**
 * Clerk session transport for the Tauri shell.
 *
 * In a browser, Clerk keeps the client session in a cookie on the Frontend
 * API domain. The tauri:// webview can't persist that cross-site cookie, so
 * requests after sign-in arrive anonymous ("You are signed out"). Clerk's
 * native-app flow solves this with `_is_native=1` + an Authorization header
 * echoed back by the API — the same mechanism Clerk's Chrome-extension SDK
 * wires up via request hooks. This SDK version doesn't expose those hooks,
 * so we do it at the fetch level for Frontend API requests only.
 */

const CLIENT_JWT_KEY = "omanote:clerk-client-jwt";

/** Frontend API host is encoded in the publishable key: pk_live_<base64("clerk.example.com$")> */
export function clerkFrontendApiHost(publishableKey: string): string | null {
  const encoded = publishableKey.split("_")[2];
  if (!encoded) return null;
  try {
    return atob(encoded).replace(/\$$/, "");
  } catch {
    return null;
  }
}

export function installClerkNativeFetch(frontendApiHost: string): void {
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    let url: URL;
    try {
      url = new URL(input instanceof Request ? input.url : String(input));
    } catch {
      return originalFetch(input, init);
    }
    if (url.host !== frontendApiHost) {
      return originalFetch(input, init);
    }

    url.searchParams.set("_is_native", "1");
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    const jwt = window.localStorage.getItem(CLIENT_JWT_KEY);
    if (jwt) headers.set("authorization", jwt);

    const request =
      input instanceof Request
        ? new Request(url.toString(), new Request(input, { ...init, headers }))
        : url.toString();
    const response = await originalFetch(
      request,
      input instanceof Request ? undefined : { ...init, headers, credentials: "omit" },
    );

    const returnedJwt = response.headers.get("authorization");
    if (returnedJwt) {
      window.localStorage.setItem(CLIENT_JWT_KEY, returnedJwt);
    }
    return response;
  };
}
