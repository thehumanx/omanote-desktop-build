import type { QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { slugify } from "./slug";

/**
 * Resolves a `sharedFolders` row (bookmark or todo folder share) from either
 * its random share code or its owner-chosen custom slug — the public route
 * accepts either as the URL segment.
 */
export async function findSharedFolderByCodeOrSlug(ctx: QueryCtx, codeOrSlug: string) {
  const byCode = await ctx.db
    .query("sharedFolders")
    .withIndex("by_shareCode", (q) => q.eq("shareCode", codeOrSlug))
    .unique();
  if (byCode) return byCode;

  return ctx.db
    .query("sharedFolders")
    .withIndex("by_customSlug", (q) => q.eq("customSlug", codeOrSlug))
    .unique();
}

/** Same, for note folder shares. */
export async function findSharedNoteFolderByCodeOrSlug(ctx: QueryCtx, codeOrSlug: string) {
  const byCode = await ctx.db
    .query("sharedNoteFolders")
    .withIndex("by_shareCode", (q) => q.eq("shareCode", codeOrSlug))
    .unique();
  if (byCode) return byCode;

  return ctx.db
    .query("sharedNoteFolders")
    .withIndex("by_customSlug", (q) => q.eq("customSlug", codeOrSlug))
    .unique();
}

/**
 * All shared-folder public links live under one namespace (`/s/<code-or-slug>`)
 * even though bookmark/todo shares and note shares are different tables — so a
 * slug (or a bare code, which a slug must never shadow) has to be unique across
 * both. `excludeSelf` lets a share's own current slug pass the check when it's
 * being re-saved unchanged.
 */
export async function isShareIdentifierTaken(
  ctx: QueryCtx,
  value: string,
  excludeSelf?: { table: "sharedFolders" | "sharedNoteFolders"; id: Id<"sharedFolders"> | Id<"sharedNoteFolders"> },
) {
  const folderByCode = await ctx.db
    .query("sharedFolders")
    .withIndex("by_shareCode", (q) => q.eq("shareCode", value))
    .unique();
  if (folderByCode) return true;

  const noteByCode = await ctx.db
    .query("sharedNoteFolders")
    .withIndex("by_shareCode", (q) => q.eq("shareCode", value))
    .unique();
  if (noteByCode) return true;

  const folderBySlug = await ctx.db
    .query("sharedFolders")
    .withIndex("by_customSlug", (q) => q.eq("customSlug", value))
    .unique();
  if (folderBySlug && !(excludeSelf?.table === "sharedFolders" && folderBySlug._id === excludeSelf.id)) {
    return true;
  }

  const noteBySlug = await ctx.db
    .query("sharedNoteFolders")
    .withIndex("by_customSlug", (q) => q.eq("customSlug", value))
    .unique();
  if (noteBySlug && !(excludeSelf?.table === "sharedNoteFolders" && noteBySlug._id === excludeSelf.id)) {
    return true;
  }

  return false;
}

/**
 * Best-effort default slug for a freshly-created share, derived from the
 * folder/category name so the link shown right after turning sharing on
 * reads as `/s/reading-list` instead of `/s/AeeYbVP5`. Falls back to `undefined`
 * (leaving the share on its random code) if the name doesn't produce a usable
 * slug or it's already taken — the owner can still set one manually.
 */
export async function pickDefaultSlug(ctx: QueryCtx, name: string) {
  const slug = slugify(name);
  if (!slug) return undefined;
  return (await isShareIdentifierTaken(ctx, slug)) ? undefined : slug;
}
