"use node";

import { isIP } from "node:net";
import { lookup } from "node:dns/promises";

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
 * NOT shared with `workers/shared/url-guard.ts`, deliberately. Cloudflare
 * Workers have no `node:net`/`node:dns`, so that copy inspects the hostname
 * string only and cannot catch a public name resolving to a private address
 * (the `localtest.me` trick). It also fails *closed* on unparseable input,
 * where this one can afford to fail open because `isIP()` gates the call. Two
 * runtimes, two threat models, two implementations — but only two, and each
 * says so.
 */

const BLOCKED_HOSTNAMES = new Set(["localhost", "localhost.localdomain", "ip6-localhost"]);

export function isPrivateIpv4(ip: string): boolean {
  const octets = ip.split(".").map(Number);
  if (octets.length !== 4 || octets.some((o) => !Number.isInteger(o) || o < 0 || o > 255)) {
    return true; // malformed — treat as unsafe
  }
  const [a, b] = octets;
  return (
    a === 0 || // 0.0.0.0/8
    a === 10 || // 10.0.0.0/8
    a === 127 || // loopback
    (a === 100 && b >= 64 && b <= 127) || // 100.64.0.0/10 (CGNAT)
    (a === 169 && b === 254) || // link-local / cloud metadata
    (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12
    (a === 192 && b === 168) // 192.168.0.0/16
  );
}

/**
 * True for loopback, link-local, and private-range addresses.
 *
 * Only ever reached for strings `isIP()` has already accepted, which is what
 * makes the final `return false` safe — an unrecognised *valid* IPv6 address is
 * a public one.
 */
export function isPrivateIp(ip: string): boolean {
  if (isIP(ip) === 4) return isPrivateIpv4(ip);
  const lower = ip.toLowerCase();
  // IPv4-mapped IPv6 (::ffff:a.b.c.d)
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIpv4(mapped[1]);
  if (lower === "::" || lower === "::1") return true; // unspecified / loopback
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // fc00::/7 unique local
  if (/^fe[89ab]/.test(lower)) return true; // fe80::/10 link-local
  return false;
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
