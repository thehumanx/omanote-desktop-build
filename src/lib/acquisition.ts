import { jsonCodec, readLocalStorageOptional, removeLocalStorage, writeLocalStorage } from "./local-storage";

/**
 * First-touch attribution: where a visitor came from the first time they
 * loaded the site, kept in this browser until they sign up, then sent once
 * (convex/acquisition.ts) so the admin dashboard can show which sources bring
 * people who stay.
 *
 * Deliberately minimal: the referring site's *host* (never the full URL, which
 * can carry search terms), the `utm_*` tags on the landing URL, and the landing
 * path without its query string. Described in the privacy policy.
 */

const FIRST_TOUCH_KEY = "omanote.first-touch";

type FirstTouch = {
  referrerHost?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  landingPath?: string;
  firstSeenAt: number;
};

const firstTouchCodec = jsonCodec(
  (value): value is FirstTouch =>
    typeof value === "object" && value !== null && typeof (value as FirstTouch).firstSeenAt === "number",
);

/** Our own hosts (and Clerk's, on our domain) are navigation, not a source. */
function isOwnHost(host: string, currentHost: string): boolean {
  return host === currentHost || host === "omanote.com" || host.endsWith(".omanote.com");
}

/** What this page load says about where the visitor came from. Exported for tests. */
export function describeFirstTouch(location: Pick<Location, "search" | "pathname" | "hostname">, referrer: string, now: number): FirstTouch {
  const params = new URLSearchParams(location.search);
  let referrerHost: string | undefined;
  try {
    const host = referrer ? new URL(referrer).hostname.replace(/^www\./, "") : "";
    if (host && !isOwnHost(host, location.hostname)) referrerHost = host;
  } catch {
    // Not a URL (some in-app browsers send junk): treat as no referrer.
  }
  const tag = (name: string) => params.get(name)?.trim() || undefined;
  return {
    referrerHost,
    utmSource: tag("utm_source") ?? tag("ref"),
    utmMedium: tag("utm_medium"),
    utmCampaign: tag("utm_campaign"),
    landingPath: location.pathname,
    firstSeenAt: now,
  };
}

/**
 * Called once at boot. Keeps only the *first* visit: later visits (from a
 * bookmark, a shared link) must not overwrite where someone originally found
 * the site.
 */
export function captureFirstTouch(): void {
  if (typeof window === "undefined") return;
  if (readLocalStorageOptional(FIRST_TOUCH_KEY, firstTouchCodec)) return;
  writeLocalStorage(FIRST_TOUCH_KEY, firstTouchCodec, describeFirstTouch(window.location, document.referrer, Date.now()));
}

export function readFirstTouch(): FirstTouch | undefined {
  return readLocalStorageOptional(FIRST_TOUCH_KEY, firstTouchCodec);
}

/** After the server has it (or declined it for an older account), there's nothing left to keep. */
export function clearFirstTouch(): void {
  removeLocalStorage(FIRST_TOUCH_KEY);
}
