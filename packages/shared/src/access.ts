export const ALLOWED_EMAIL_DOMAINS = new Set(["gmail.com"]);

export function isAllowedEmailDomain(email: string | null | undefined): boolean {
  const domain = email?.split("@")[1]?.toLowerCase();
  return !!domain && ALLOWED_EMAIL_DOMAINS.has(domain);
}
