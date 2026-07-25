// Verifies Clerk webhook requests, which are signed the same way Svix signs
// its webhooks (HMAC-SHA256 over "{id}.{timestamp}.{body}", base64-encoded).
// Implemented with Web Crypto instead of the `svix` package because http.ts
// also exports queries/mutations and can't take the "use node" directive.

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Verifies the Svix-format signature Clerk attaches to webhook requests.
 * Returns the parsed JSON body if valid, or null if the signature is missing/invalid.
 */
export async function verifyClerkWebhook(req: Request, signingSecret: string): Promise<unknown | null> {
  const svixId = req.headers.get("svix-id");
  const svixTimestamp = req.headers.get("svix-timestamp");
  const svixSignature = req.headers.get("svix-signature");
  if (!svixId || !svixTimestamp || !svixSignature) return null;

  const body = await req.text();
  const secretBytes = base64ToBytes(
    signingSecret.startsWith("whsec_") ? signingSecret.slice("whsec_".length) : signingSecret,
  );

  const key = await crypto.subtle.importKey(
    "raw",
    Uint8Array.from(secretBytes),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${svixId}.${svixTimestamp}.${body}`),
  );
  const expectedSignature = bytesToBase64(new Uint8Array(signatureBuffer));

  const providedSignatures = svixSignature
    .split(" ")
    .map((entry) => entry.split(",")[1])
    .filter((sig): sig is string => Boolean(sig));

  const isValid = providedSignatures.some((sig) => timingSafeEqual(sig, expectedSignature));
  if (!isValid) return null;

  return JSON.parse(body);
}
