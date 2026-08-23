/**
 * Server-side mirror of src/lib/slug.ts — Convex functions run in a separate
 * bundle from the frontend, so this tiny pure function is duplicated rather
 * than imported across that boundary.
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
