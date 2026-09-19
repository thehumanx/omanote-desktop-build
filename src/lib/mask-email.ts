/**
 * Partially hides an email address for display: `bishistha@x.com` becomes
 * `bi***@x.com`.
 *
 * Used anywhere an address is shown but doesn't need to be *read* — the
 * profile menu, the feedback dialog, the Google connection row, and the guest
 * chips on a todo. The point is screen sharing: enough of the address to
 * recognise which one it is, not enough to harvest.
 *
 * Lived in `update-checker.ts` until it had five consumers and no connection
 * to update checking left.
 */
export function maskEmail(email: string): string {
  const atIdx = email.indexOf("@");
  if (atIdx === -1) return email;
  const local = email.slice(0, atIdx);
  const domain = email.slice(atIdx);
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}***${domain}`;
}
