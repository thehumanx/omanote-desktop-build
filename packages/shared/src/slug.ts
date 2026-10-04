/**
 * URL slug for a share's custom link: lowercase ASCII words joined by "-",
 * accents stripped, at most 60 characters. Used by the server to look shares
 * up by slug (convex/lib/shareLookup.ts) and by the client to preview the slug
 * it is about to save (src/lib/use-share-link-meta.ts) — so it lives here,
 * once, rather than as two copies that must stay byte-identical.
 */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}
