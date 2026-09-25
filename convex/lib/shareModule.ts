import type { GenericId } from "convex/values";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { AuthIdentity } from "../utils";
import { generateShareCode, pickDefaultSlug } from "./shareLookup";
import { shouldCountShareView } from "../shareViews";

/**
 * The parts of a public share that are identical for bookmark categories,
 * todo folders, note folders and canvases. `sharedFolders.ts`,
 * `sharedTodoFolders.ts`, `sharedNoteFolders.ts` and `sharedPages.ts` each
 * used to carry a copy; they now keep only what differs — their argument
 * names, snapshot shape and public projection — and call these.
 *
 * Convex types `withIndex` per table, so the lookups here go through `any`.
 * Each module's `ShareSpec` is the one place its table/index/field names are
 * spelled out, so a typo there fails its own tests, not silently.
 */

type ShareTable = "sharedFolders" | "sharedNoteFolders" | "sharedPages";

type ShareRow = {
  _id: GenericId<ShareTable>;
  userId: string;
  shareCode: string;
  isActive: boolean;
  viewCount: number;
  thumbnailStorageId?: GenericId<"_storage">;
};

export type ShareSpec = {
  table: ShareTable;
  /** The index keyed on the shared thing's id, e.g. "by_categoryId". */
  index: string;
  /** The share row's field holding that id, e.g. "categoryId". */
  parentField: string;
  /** Extra fields every new row of this kind carries (e.g. `type: "todo"`). */
  insertExtras?: Record<string, unknown>;
  /** Turns sharing off and drops the plaintext snapshot (lib/shareSnapshots.ts). */
  deactivate: (ctx: MutationCtx, shareId: any) => Promise<unknown>;
  /** What the owner calls the thing in errors: "Folder", "Category", "Canvas". */
  noun: string;
};

/** The share row for `parentId`, or null. No ownership check. */
export async function findShareByParent<T extends ShareRow = ShareRow>(ctx: QueryCtx, spec: ShareSpec, parentId: string): Promise<T | null> {
  return (ctx.db.query(spec.table) as any).withIndex(spec.index, (q: any) => q.eq(spec.parentField, parentId)).unique();
}

/** The caller's own share row for `parentId`, or null if absent or someone else's. */
export async function findOwnShare<T extends ShareRow = ShareRow>(ctx: QueryCtx, spec: ShareSpec, parentId: string, userId: string): Promise<T | null> {
  const share = await findShareByParent<T>(ctx, spec, parentId);
  return share && share.userId === userId ? share : null;
}

/**
 * Turns a share on or off, creating it (with a slug derived from `slugSource`,
 * which the client sends because names are stored encrypted) on first enable.
 * Returns the share code, or null when disabling something never shared.
 */
export async function setShareActive(
  ctx: MutationCtx,
  spec: ShareSpec,
  args: { parentId: string; isActive: boolean; slugSource?: string; identity: AuthIdentity; userId: string },
): Promise<string | null> {
  const parent = await ctx.db.get(args.parentId as GenericId<any>);
  if (!parent || (parent as { userId?: string }).userId !== args.userId) {
    throw new Error(`${spec.noun} not found`);
  }

  const existing = await findShareByParent(ctx, spec, args.parentId);
  if (existing) {
    if (existing.userId !== args.userId) throw new Error("Not authorized");
    if (args.isActive) await ctx.db.patch(existing._id, { isActive: true });
    else await spec.deactivate(ctx, existing._id);
    return existing.shareCode;
  }

  if (!args.isActive) return null;

  const shareCode = generateShareCode();
  const customSlug = args.slugSource ? await pickDefaultSlug(ctx, args.slugSource) : undefined;
  await ctx.db.insert(spec.table, {
    [spec.parentField]: args.parentId,
    userId: args.userId,
    shareCode,
    customSlug,
    isActive: true,
    viewCount: 0,
    ownerName: args.identity.name ?? "Anonymous",
    ownerImageUrl: args.identity.pictureUrl ?? undefined,
    createdAt: Date.now(),
    ...spec.insertExtras,
  } as any);
  return shareCode;
}

/** The owner's view of their share: the row plus a resolved thumbnail URL. */
export async function getOwnShareWithThumbnail<T extends ShareRow>(
  ctx: QueryCtx,
  spec: ShareSpec,
  parentId: string,
): Promise<(T & { thumbnailUrl: string | null }) | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  const share = await findOwnShare<T>(ctx, spec, parentId, identity.tokenIdentifier);
  if (!share) return null;
  const thumbnailUrl = share.thumbnailStorageId ? await ctx.storage.getUrl(share.thumbnailStorageId) : null;
  return { ...share, thumbnailUrl };
}

/** Counts a public view, deduped per viewer (see shareViews.ts). */
export async function recordView(
  ctx: MutationCtx,
  share: ShareRow | null,
  shareKind: Parameters<typeof shouldCountShareView>[1]["shareKind"],
  viewerToken: string | undefined,
) {
  if (!share || !share.isActive) return;
  const now = Date.now();
  const shouldCount = await shouldCountShareView(ctx, {
    shareKind,
    shareCode: share.shareCode,
    ownerUserId: share.userId,
    viewerToken,
    now,
  });
  if (!shouldCount) return;
  await ctx.db.patch(share._id, { viewCount: share.viewCount + 1, lastViewedAt: now } as any);
}

/** Ids of everything the caller currently shares publicly, for list badges. */
export async function listMyActiveShareParentIds(ctx: QueryCtx, spec: ShareSpec, filter?: (row: any) => boolean): Promise<string[]> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return [];
  const shares: any[] = await (ctx.db.query(spec.table) as any)
    .withIndex("by_userId_isActive", (q: any) => q.eq("userId", identity.tokenIdentifier).eq("isActive", true))
    .take(500);
  return shares.filter((row) => (filter ? filter(row) : true) && row[spec.parentField]).map((row) => String(row[spec.parentField]));
}
