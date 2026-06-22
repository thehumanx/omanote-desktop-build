import type { AuthState } from "./types";

export function maskEmail(email: string): string {
  const atIdx = email.indexOf("@");
  if (atIdx === -1) return email;
  const local = email.slice(0, atIdx);
  const domain = email.slice(atIdx);
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}***${domain}`;
}

export function displayAuthName(auth: AuthState): string {
  return auth.user.name || auth.user.email || "Connected account";
}

export function displayAuthEmail(auth: AuthState): string {
  return auth.user.email ? maskEmail(auth.user.email) : "Not available";
}
