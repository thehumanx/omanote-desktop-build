// Buffer isn't available in Convex's default (non-Node) runtime, which is
// where googleAuth.ts and http.ts run (they export queries/mutations
// alongside actions, so "use node" isn't an option there). These use only
// Web-standard APIs (btoa/atob/TextEncoder/TextDecoder) instead.

export function encodeBase64Url(value: unknown): string {
  const json = JSON.stringify(value);
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeBase64Url(value: string): unknown {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const json = new TextDecoder().decode(bytes);
  return JSON.parse(json);
}
