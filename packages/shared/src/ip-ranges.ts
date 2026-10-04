/**
 * Which IP literals point at private infrastructure — the one implementation
 * behind every SSRF guard in the repo: the Convex actions
 * (convex/lib/urlGuard.ts), the Cloudflare Workers
 * (workers/shared/url-guard.ts) and the client's link-preview filter
 * (src/lib/attachment-link-preview.ts).
 *
 * There used to be three hand-kept copies. They drifted: the Convex one only
 * recognised IPv4-mapped IPv6 in dotted form, while `new URL()` always writes
 * it in hex (`[::ffff:127.0.0.1]` → `::ffff:7f00:1`), so loopback and the
 * cloud-metadata address passed as public. No runtime-specific imports here,
 * so all three runtimes can share it.
 */

/** True for 0/8, 10/8, loopback, CGNAT, link-local and the RFC 1918 ranges. Malformed input counts as private. */
export function isPrivateIpv4(ip: string): boolean {
  const octets = ip.split(".").map(Number);
  if (octets.length !== 4 || octets.some((o) => !Number.isInteger(o) || o < 0 || o > 255)) {
    return true; // malformed — fail closed
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

/** Expands an IPv6 address to its eight 16-bit groups, or null if it isn't one. */
function ipv6Groups(ip: string): number[] | null {
  let text = ip.toLowerCase();
  // A trailing dotted quad stands for the last two groups.
  const dotted = text.match(/^(.*:)(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted) {
    const octets = dotted[2].split(".").map(Number);
    if (octets.some((o) => !Number.isInteger(o) || o < 0 || o > 255)) return null;
    text = `${dotted[1]}${((octets[0] << 8) | octets[1]).toString(16)}:${((octets[2] << 8) | octets[3]).toString(16)}`;
  }
  if (!/^[0-9a-f:]+$/.test(text)) return null;
  const halves = text.split("::");
  if (halves.length > 2) return null;
  const parse = (part: string) => (part ? part.split(":").map((group) => (/^[0-9a-f]{1,4}$/.test(group) ? parseInt(group, 16) : NaN)) : []);
  const head = parse(halves[0]);
  const tail = halves.length === 2 ? parse(halves[1]) : [];
  const fill = halves.length === 2 ? 8 - head.length - tail.length : 0;
  if (fill < 0) return null;
  const groups = [...head, ...new Array<number>(fill).fill(0), ...tail];
  if (groups.length !== 8 || groups.some((group) => !Number.isInteger(group))) return null;
  return groups;
}

/**
 * The IPv4 address inside an IPv4-mapped (`::ffff:0:0/96`), IPv4-compatible
 * (`::/96`) or NAT64 (`64:ff9b::/96`) IPv6 address, or null. All three reach
 * the IPv4 host, so all three must be judged as that host.
 */
export function embeddedIpv4(ip: string): string | null {
  const groups = ipv6Groups(ip);
  if (!groups) return null;
  const prefix = groups.slice(0, 6);
  const isMapped = prefix.slice(0, 5).every((group) => group === 0) && prefix[5] === 0xffff;
  // `::` and `::1` are themselves, not 0.0.0.0/0.0.0.1.
  const isCompatible = prefix.every((group) => group === 0) && (groups[6] !== 0 || groups[7] > 1);
  const isNat64 = prefix[0] === 0x64 && prefix[1] === 0xff9b && prefix.slice(2).every((group) => group === 0);
  if (!isMapped && !isCompatible && !isNat64) return null;
  return [groups[6] >> 8, groups[6] & 0xff, groups[7] >> 8, groups[7] & 0xff].join(".");
}

/** True for private, loopback, link-local and unique-local IPv6, and anything carrying a private IPv4. Unparseable counts as private. */
export function isPrivateIpv6(ip: string): boolean {
  const groups = ipv6Groups(ip);
  if (!groups) return true; // malformed — fail closed
  const embedded = embeddedIpv4(ip);
  if (embedded) return isPrivateIpv4(embedded);
  if (groups.every((group) => group === 0)) return true; // :: unspecified
  if (groups.slice(0, 7).every((group) => group === 0) && groups[7] === 1) return true; // ::1 loopback
  if ((groups[0] & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
  if ((groups[0] & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  return false;
}

/** Whether `host` is written as an IP address at all (brackets already stripped). */
export function isIpLiteral(host: string): boolean {
  return /^\d+\.\d+\.\d+\.\d+$/.test(host) || host.includes(":");
}

/** For an IP literal: whether it is private. For any other host name: false — resolving names is the caller's job. */
export function isPrivateIpLiteral(host: string): boolean {
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return isPrivateIpv4(host);
  if (host.includes(":")) return isPrivateIpv6(host);
  return false;
}
