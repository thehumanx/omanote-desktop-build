import type { MutationCtx } from "./_generated/server";

type ShareKind = "bookmark_folder" | "note_folder" | "todo_folder";

const SHARE_VIEW_RATE_LIMIT_MS = 6 * 60 * 60 * 1000;
const FALLBACK_VIEWER_TOKEN = "anonymous";
const MAX_VIEWER_TOKEN_LENGTH = 160;

// Viewer tokens are client-supplied, so per-token dedup alone can be bypassed
// by minting fresh tokens. This per-share ceiling bounds how fast the public
// view count can grow no matter how many tokens a caller invents.
export const SHARE_VIEW_HOURLY_CAP = 100;
const SHARE_VIEW_CAP_WINDOW_MS = 60 * 60 * 1000;

function normalizeViewerToken(viewerToken: string | undefined) {
  const trimmed = viewerToken?.trim();
  if (!trimmed) return FALLBACK_VIEWER_TOKEN;
  return trimmed.slice(0, MAX_VIEWER_TOKEN_LENGTH);
}

export async function shouldCountShareView(
  ctx: MutationCtx,
  {
    shareKind,
    shareCode,
    ownerUserId,
    viewerToken,
    now = Date.now(),
  }: {
    shareKind: ShareKind;
    shareCode: string;
    ownerUserId: string;
    viewerToken?: string;
    now?: number;
  },
) {
  const normalizedViewerToken = normalizeViewerToken(viewerToken);
  const existing = await ctx.db
    .query("shareViewBuckets")
    .withIndex("by_shareKind_shareCode_viewerToken", (q) =>
      q.eq("shareKind", shareKind).eq("shareCode", shareCode).eq("viewerToken", normalizedViewerToken),
    )
    .unique();

  if (existing && now - existing.lastCountedAt < SHARE_VIEW_RATE_LIMIT_MS) {
    await ctx.db.patch(existing._id, { lastSeenAt: now });
    return false;
  }

  const countedRecently = await ctx.db
    .query("shareViewBuckets")
    .withIndex("by_shareKind_shareCode_lastCountedAt", (q) =>
      q
        .eq("shareKind", shareKind)
        .eq("shareCode", shareCode)
        .gt("lastCountedAt", now - SHARE_VIEW_CAP_WINDOW_MS),
    )
    .take(SHARE_VIEW_HOURLY_CAP);

  if (countedRecently.length >= SHARE_VIEW_HOURLY_CAP) {
    if (existing) {
      await ctx.db.patch(existing._id, { lastSeenAt: now });
    }
    return false;
  }

  if (existing) {
    await ctx.db.patch(existing._id, {
      lastCountedAt: now,
      lastSeenAt: now,
    });
    return true;
  }

  await ctx.db.insert("shareViewBuckets", {
    ownerUserId,
    shareKind,
    shareCode,
    viewerToken: normalizedViewerToken,
    lastCountedAt: now,
    lastSeenAt: now,
  });
  return true;
}
