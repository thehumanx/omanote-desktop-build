"use node";

import { isIP } from "node:net";
import { lookup } from "node:dns/promises";
import { isPrivateIpv4, isPrivateIpv6 } from "@omanote/shared";

/**
 * SSRF guards for the Node-runtime Convex actions.
 *
 * `linkPreview` and `rssFetch` both fetch URLs that originate in user input — a
 * page being bookmarked, a feed being subscribed to — so both must refuse hosts
 * that point back at private infrastructure, and both must re-check after every
 * redirect hop, since a public host can 302 to 127.0.0.1.
 *
 * These lived as two byte-identical copies (modulo comments). That is the shape
 * a security bug hides in: a fix applied to one copy silently leaves the other
 * exploitable, and nothing about either file tells you the other exists.
 *
 * The address ranges are shared with `workers/shared/url-guard.ts` (both read
 * `@omanote/shared`'s ip-ranges). What differs is resolution: Workers have no
 * `node:dns`, so that guard inspects the hostname string only and cannot catch
 * a public name resolving to a private address (the `localtest.me` trick);
 * this one resolves and checks every address.
 */

const BLOCKED_HOSTNAMES = new Set(["localhost", "localhost.localdomain", "ip6-localhost"]);

/** Re-exported for the tests that pin these ranges against this guard. */
export { isPrivateIpv4 };

/**
 * True for loopback, link-local, private-range addresses, and IPv6 addresses
 * carrying one. The ranges live in `@omanote/shared` (ip-ranges.ts), shared
 * with the Workers and the client so the copies can't drift again.
 */
export function isPrivateIp(ip: string): boolean {
  if (isIP(ip) === 4) return isPrivateIpv4(ip);
  return isPrivateIpv6(ip);
}

/**
 * Rejects URLs whose host is, or resolves to, a private/loopback/link-local
 * address. Call on the initial URL *and* on every redirect hop.
 *
 * Unlike the Workers copy this resolves hostnames, so a public name pointing at
 * a private address is caught rather than trusted.
 */
export async function assertPublicUrl(url: URL): Promise<void> {
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  if (BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith(".local") || hostname.endsWith(".internal")) {
    throw new Error("URL host is not allowed");
  }
  if (isIP(hostname)) {
    if (isPrivateIp(hostname)) throw new Error("URL host is not allowed");
    return;
  }
  let addresses;
  try {
    addresses = await lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new Error("URL host could not be resolved");
  }
  if (addresses.length === 0 || addresses.some((entry) => isPrivateIp(entry.address))) {
    throw new Error("URL host is not allowed");
  }
}
