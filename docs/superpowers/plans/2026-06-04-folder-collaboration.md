# Folder Collaboration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build private editable collaboration for note folders and bookmark folders without affecting unrelated personal encrypted content.

**Architecture:** Collaborative folders become a separate encrypted domain with one folder key and per-user wrapped key grants. Personal content remains encrypted with the existing user content key. Convex enforces membership and stores only ciphertext plus metadata.

**Tech Stack:** React 18, TypeScript, Convex, Convex Test, Vitest, Web Crypto API, Clerk auth.

---

## Reference Docs

- Design spec: `docs/superpowers/specs/2026-06-04-folder-collaboration-design.md`
- Convex rules: `convex/_generated/ai/guidelines.md`
- Current encryption model: `docs/encryption.md`
- Current crypto helpers: `src/lib/crypto.ts`
- Current note mutations: `convex/notes.ts`
- Current bookmark mutations: `convex/bookmarks.ts`
- Current public share modules: `convex/sharedNoteFolders.ts`, `convex/sharedFolders.ts`

## File Structure

- Create `convex/collaboration.ts`: public mutations/queries for enable-collaboration, invites, members, key grants, and history.
- Create `convex/collaborationHelpers.ts`: internal helper functions for ownership, membership, folder lookup, and exact item-scope validation.
- Create `convex/collaboration.test.ts`: Convex tests for permissions, conversion scope, invites, and safety.
- Modify `convex/schema.ts`: add collaboration tables plus collaboration metadata fields on notes/bookmarks/folders/categories.
- Modify `convex/notes.ts`: branch read/write/delete behavior for collaborative note folders while preserving personal behavior.
- Modify `convex/bookmarks.ts`: branch read/write/delete behavior for collaborative bookmark folders while preserving personal behavior.
- Modify `src/lib/crypto.ts`: add public wrapping-key helpers and folder-key wrap/unwrap helpers.
- Create `src/lib/collaboration-crypto.ts`: key resolver utilities that choose personal key vs folder key.
- Create `src/lib/collaboration-crypto.test.ts`: unit tests for key resolver behavior.
- Modify `src/contexts/EncryptionContext.tsx`: generate/read public wrapping key bundle after encryption setup/unlock.
- Modify `src/app/AppProvider.tsx`: fetch shared folders/key grants and decrypt collaborative rows with folder keys.
- Create `src/components/CollaboratorAvatarStack.tsx`: shared avatar stack UI.
- Create `src/components/FolderCollaborationPanel.tsx`: collaborator management UI used by notes and bookmarks.
- Modify `src/components/ShareNoteFolderModal.tsx` and `src/components/ShareFolderModal.tsx`: add private collaboration section separate from public link controls.
- Modify `src/screens/NotesScreen.tsx`, `src/screens/BookmarksScreen.tsx`, `src/components/NoteFolderNav.tsx`, and `src/components/BookmarkCategoryNav.tsx`: shared indicators and owner/editor affordances.

---

### Task 1: Schema and Generated Types

**Files:**
- Modify: `convex/schema.ts`

- [ ] **Step 1: Read Convex guidelines**

Run: `sed -n '1,260p' convex/_generated/ai/guidelines.md`

Expected: output includes "ALWAYS include argument validators" and "Do not store unbounded lists as an array field inside a document."

- [ ] **Step 2: Add collaboration tables and metadata fields**

In `convex/schema.ts`, add the following fields to `notes`:

```ts
    encryptionDomain: v.optional(v.union(v.literal("personal"), v.literal("collaborative"))),
    collaborativeFolderId: v.optional(v.id("collaborativeFolders")),
    createdByUserId: v.optional(v.string()),
    updatedByUserId: v.optional(v.string()),
    deletedByUserId: v.optional(v.string()),
```

Add this index to `notes`:

```ts
    .index("by_collaborativeFolderId_deletedAt_createdAt", ["collaborativeFolderId", "deletedAt", "createdAt"])
```

Add the following fields to `bookmarks`:

```ts
    encryptionDomain: v.optional(v.union(v.literal("personal"), v.literal("collaborative"))),
    collaborativeFolderId: v.optional(v.id("collaborativeFolders")),
    createdByUserId: v.optional(v.string()),
    updatedByUserId: v.optional(v.string()),
    deletedByUserId: v.optional(v.string()),
```

Add this index to `bookmarks`:

```ts
    .index("by_collaborativeFolderId_deletedAt_createdAt", ["collaborativeFolderId", "deletedAt", "createdAt"])
```

Add `collaborativeFolderId` to the existing `noteFolders` table definition so it can serve as a write-once mutex preventing duplicate collaborative folder rows (Convex OCC will serialize concurrent conversion attempts):

```ts
    collaborativeFolderId: v.optional(v.id("collaborativeFolders")),
```

Add `collaborativeFolderId` to the existing `bookmarkCategories` table definition for the same reason:

```ts
    collaborativeFolderId: v.optional(v.id("collaborativeFolders")),
```

Add these tables near the existing public share tables:

```ts
  collaborativeFolders: defineTable({
    folderKind: v.union(v.literal("note_folder"), v.literal("bookmark_folder")),
    folderId: v.union(v.id("noteFolders"), v.id("bookmarkCategories")),
    ownerUserId: v.string(),
    status: v.union(v.literal("converting"), v.literal("active"), v.literal("disabled")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_folderKind_folderId", ["folderKind", "folderId"])
    .index("by_ownerUserId_status", ["ownerUserId", "status"]),
  folderCollaborators: defineTable({
    collaborativeFolderId: v.id("collaborativeFolders"),
    userId: v.string(),
    role: v.union(v.literal("owner"), v.literal("editor")),
    emailSnapshot: v.string(),
    nameSnapshot: v.string(),
    imageUrlSnapshot: v.optional(v.string()),
    addedByUserId: v.string(),
    addedAt: v.number(),
    updatedAt: v.number(),
    removedAt: v.optional(v.number()),
  })
    .index("by_collaborativeFolderId_removedAt", ["collaborativeFolderId", "removedAt"])
    .index("by_userId_removedAt", ["userId", "removedAt"])
    .index("by_collaborativeFolderId_userId", ["collaborativeFolderId", "userId"]),
  folderInvites: defineTable({
    collaborativeFolderId: v.id("collaborativeFolders"),
    folderKind: v.union(v.literal("note_folder"), v.literal("bookmark_folder")),
    folderNameSnapshot: v.string(),
    inviteeEmail: v.string(),
    inviteeEmailLower: v.string(),
    inviteTokenHash: v.string(),
    status: v.union(v.literal("pending"), v.literal("accepted"), v.literal("revoked"), v.literal("expired")),
    createdByUserId: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    expiresAt: v.optional(v.number()),
    acceptedAt: v.optional(v.number()),
    acceptedByUserId: v.optional(v.string()),
    revokedAt: v.optional(v.number()),
  })
    .index("by_inviteTokenHash", ["inviteTokenHash"])
    .index("by_collaborativeFolderId_status", ["collaborativeFolderId", "status"])
    .index("by_inviteeEmailLower_status", ["inviteeEmailLower", "status"]),
  folderKeyGrants: defineTable({
    collaborativeFolderId: v.id("collaborativeFolders"),
    userId: v.string(),
    wrappedFolderKey: v.string(),
    wrapVersion: v.literal("v1"),
    wrapAlgorithm: v.string(),
    createdByUserId: v.string(),
    createdAt: v.number(),
    revokedAt: v.optional(v.number()),
  })
    .index("by_collaborativeFolderId_userId", ["collaborativeFolderId", "userId"])
    .index("by_userId_revokedAt", ["userId", "revokedAt"]),
  userPublicKeyBundles: defineTable({
    userId: v.string(),
    emailLower: v.string(),
    publicKey: v.string(),
    encryptedPrivateKey: v.string(),
    algorithm: v.string(),
    version: v.literal("v1"),
    createdAt: v.number(),
    rotatedAt: v.optional(v.number()),
    revokedAt: v.optional(v.number()),
  })
    .index("by_userId_revokedAt", ["userId", "revokedAt"])
    .index("by_emailLower_revokedAt", ["emailLower", "revokedAt"]),
  collaborativeContentHistory: defineTable({
    collaborativeFolderId: v.id("collaborativeFolders"),
    itemKind: v.union(v.literal("note"), v.literal("bookmark")),
    itemId: v.string(),
    action: v.union(v.literal("created"), v.literal("edited"), v.literal("deleted"), v.literal("restored")),
    actorUserId: v.string(),
    actorNameSnapshot: v.string(),
    actorImageUrlSnapshot: v.optional(v.string()),
    encryptedSnapshot: v.optional(v.string()),
    createdAt: v.number(),
    expiresAt: v.number(),
  })
    .index("by_collaborativeFolderId_createdAt", ["collaborativeFolderId", "createdAt"])
    .index("by_itemKind_itemId_createdAt", ["itemKind", "itemId", "createdAt"])
    .index("by_expiresAt", ["expiresAt"]),
```

- [ ] **Step 3: Run type generation**

Run: `npx convex codegen`

Expected: generated Convex types update without schema errors.

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add convex/schema.ts convex/_generated
git commit -m "feat: add collaboration schema"
```

Expected: commit succeeds.

---

### Task 2: Backend Collaboration Helpers

**Files:**
- Create: `convex/collaborationHelpers.ts`
- Test: `convex/collaborationHelpers.test.ts`

- [ ] **Step 1: Write failing helper tests**

Create `convex/collaborationHelpers.test.ts` with:

```ts
// @vitest-environment edge-runtime

import { describe, expect, it } from "vitest";
import type { Doc, Id } from "./_generated/dataModel";
import { assertBookmarkBelongsToFolder, assertNoteBelongsToFolder } from "./collaborationHelpers";

describe("folder collaboration safety", () => {
  it("rejects converting a note id outside the selected folder", async () => {
    expect(() =>
      assertNoteBelongsToFolder(
        { _id: "note_1" as Id<"notes">, userId: "owner", folderId: "folder_a" as Id<"noteFolders"> } as Doc<"notes">,
        { ownerUserId: "owner", folderId: "folder_b" as Id<"noteFolders"> },
      ),
    ).toThrow("Conversion item does not belong to this folder");
  });

  it("rejects converting a bookmark id outside the selected folder", async () => {
    expect(() =>
      assertBookmarkBelongsToFolder(
        {
          _id: "bookmark_1" as Id<"bookmarks">,
          userId: "owner",
          categoryId: "category_a" as Id<"bookmarkCategories">,
        } as Doc<"bookmarks">,
        { ownerUserId: "owner", categoryId: "category_b" as Id<"bookmarkCategories"> },
      ),
    ).toThrow("Conversion item does not belong to this folder");
  });
});
```

- [ ] **Step 2: Run test to verify it fails because API is missing**

Run: `npm test -- convex/collaborationHelpers.test.ts`

Expected: FAIL because `./collaborationHelpers` does not exist.

- [ ] **Step 3: Implement helper functions**

Create `convex/collaborationHelpers.ts`:

```ts
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

export type FolderKind = "note_folder" | "bookmark_folder";

const CONVERTING_TIMEOUT_MS = 60_000;

export async function getActiveCollaborationByFolder(
  ctx: QueryCtx | MutationCtx,
  args: { folderKind: FolderKind; folderId: Id<"noteFolders"> | Id<"bookmarkCategories"> },
) {
  const existing = await ctx.db
    .query("collaborativeFolders")
    .withIndex("by_folderKind_folderId", (q) => q.eq("folderKind", args.folderKind).eq("folderId", args.folderId))
    .unique();
  if (!existing || existing.status === "disabled") return null;
  // Treat a "converting" row older than 60 s as stuck — allow the caller to retry.
  if (existing.status === "converting" && Date.now() - existing.createdAt > CONVERTING_TIMEOUT_MS) return null;
  return existing;
}

export async function requireFolderOwner(
  ctx: QueryCtx | MutationCtx,
  args: { userId: string; folderKind: FolderKind; folderId: Id<"noteFolders"> | Id<"bookmarkCategories"> },
) {
  const folder =
    args.folderKind === "note_folder"
      ? await ctx.db.get(args.folderId as Id<"noteFolders">)
      : await ctx.db.get(args.folderId as Id<"bookmarkCategories">);
  if (!folder || folder.userId !== args.userId) {
    throw new Error("Folder not found");
  }
  return folder;
}

export async function requireActiveCollaborator(
  ctx: QueryCtx | MutationCtx,
  args: { collaborativeFolderId: Id<"collaborativeFolders">; userId: string },
) {
  const membership = await ctx.db
    .query("folderCollaborators")
    .withIndex("by_collaborativeFolderId_userId", (q) =>
      q.eq("collaborativeFolderId", args.collaborativeFolderId).eq("userId", args.userId),
    )
    .unique();
  if (!membership || membership.removedAt) {
    throw new Error("Folder not found");
  }
  return membership;
}

export function assertNoteBelongsToFolder(
  note: Doc<"notes"> | null,
  args: { ownerUserId: string; folderId: Id<"noteFolders"> },
) {
  if (!note || note.userId !== args.ownerUserId || note.folderId !== args.folderId) {
    throw new Error("Conversion item does not belong to this folder");
  }
}

export function assertBookmarkBelongsToFolder(
  bookmark: Doc<"bookmarks"> | null,
  args: { ownerUserId: string; categoryId: Id<"bookmarkCategories"> },
) {
  if (!bookmark || bookmark.userId !== args.ownerUserId || bookmark.categoryId !== args.categoryId) {
    throw new Error("Conversion item does not belong to this folder");
  }
}
```

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 5: Run helper tests**

Run: `npm test -- convex/collaborationHelpers.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit helper skeleton and tests**

Run:

```bash
git add convex/collaborationHelpers.ts convex/collaborationHelpers.test.ts
git commit -m "feat: add collaboration safety helpers"
```

Expected: commit succeeds.

---

### Task 3: Enable Collaboration Conversion Backend

**Files:**
- Create: `convex/collaboration.ts`
- Modify: `convex/collaborationHelpers.ts`
- Test: `convex/collaboration.test.ts`

- [ ] **Step 1: Add passing note-folder conversion API**

Create `convex/collaboration.ts`:

```ts
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUserId } from "./utils";
import {
  assertBookmarkBelongsToFolder,
  assertNoteBelongsToFolder,
  getActiveCollaborationByFolder,
} from "./collaborationHelpers";

const noteConversionItem = v.object({
  noteId: v.id("notes"),
  title: v.optional(v.string()),
  body: v.string(),
  tags: v.array(v.string()),
});

const bookmarkConversionItem = v.object({
  bookmarkId: v.id("bookmarks"),
  url: v.string(),
  title: v.string(),
  siteName: v.optional(v.string()),
  description: v.optional(v.string()),
  thumbnailUrl: v.optional(v.string()),
  faviconUrl: v.optional(v.string()),
});

function identityName(identity: { name?: string | null; email?: string | null }) {
  return identity.name ?? identity.email ?? "User";
}

// Multi-batch conversion protocol
// ─────────────────────────────────────────────────────────────────────────────
// Folders with more than 50 items need multiple calls. The protocol is:
//
//   call 1 (isFinalBatch: false) → creates collaborativeFolders row ("converting"),
//                                   adds owner key grant + collaborator row,
//                                   patches batch-1 items.
//   call N (isFinalBatch: false) → reuses the existing "converting" row,
//                                   patches batch-N items.
//   call N+1 (isFinalBatch: true) → patches the last batch of items,
//                                    then sets status → "active".
//
// Every call is a standalone atomic Convex transaction. If a call fails,
// only that batch is rolled back. Previously-converted batches are already
// in the DB but the folder stays "converting", so collaborators cannot
// access it yet. The owner can retry from the failed batch or call
// disableCollaboration to fully revert all converted items back to personal.
// ─────────────────────────────────────────────────────────────────────────────

export const enableNoteFolderCollaboration = mutation({
  args: {
    folderId: v.id("noteFolders"),
    folderName: v.string(),
    wrappedOwnerFolderKey: v.string(),
    wrapAlgorithm: v.string(),
    items: v.array(noteConversionItem),
    isFinalBatch: v.boolean(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    // Including the folder document in the read set lets Convex OCC serialize
    // any concurrent conversion attempt on this folder.
    const folder = await ctx.db.get(args.folderId);
    if (!folder || folder.userId !== userId) throw new Error("Folder not found");

    // Already fully converted — idempotent return.
    if (folder.collaborativeFolderId) {
      const cf = await ctx.db.get(folder.collaborativeFolderId);
      if (cf && cf.status === "active") return cf._id;
    }

    if (args.items.length > 50) throw new Error("Convert at most 50 items per call; call again for the next batch");

    for (const item of args.items) {
      const note = await ctx.db.get(item.noteId);
      // Double-checks: note must belong to this owner AND this folder.
      // Rejects any attempt to touch notes from a different folder.
      assertNoteBelongsToFolder(note, { ownerUserId: userId, folderId: args.folderId });
    }

    const now = Date.now();

    // ── First batch: create the collaborativeFolders row ──────────────────
    let collaborativeFolderId: Id<"collaborativeFolders">;
    if (!folder.collaborativeFolderId) {
      collaborativeFolderId = await ctx.db.insert("collaborativeFolders", {
        folderKind: "note_folder",
        folderId: args.folderId,
        ownerUserId: userId,
        status: "converting",
        createdAt: now,
        updatedAt: now,
      });
      // Write the ID back onto the folder doc (OCC mutex + pointer for next batches).
      await ctx.db.patch(args.folderId, { collaborativeFolderId, name: args.folderName, updatedAt: now });
      // Owner key grant and collaborator row are created once on the first batch.
      await ctx.db.insert("folderKeyGrants", {
        collaborativeFolderId,
        userId,
        wrappedFolderKey: args.wrappedOwnerFolderKey,
        wrapVersion: "v1",
        wrapAlgorithm: args.wrapAlgorithm,
        createdByUserId: userId,
        createdAt: now,
      });
      await ctx.db.insert("folderCollaborators", {
        collaborativeFolderId,
        userId,
        role: "owner",
        emailSnapshot: identity!.email ?? "",
        nameSnapshot: identityName(identity!),
        imageUrlSnapshot: identity!.pictureUrl ?? undefined,
        addedByUserId: userId,
        addedAt: now,
        updatedAt: now,
      });
    } else {
      // ── Subsequent batch: reuse the existing "converting" row ─────────────
      const existingCf = await ctx.db.get(folder.collaborativeFolderId);
      if (!existingCf) throw new Error("Collaboration row missing; call enableNoteFolderCollaboration from the beginning");
      collaborativeFolderId = existingCf._id;
    }

    // Patch only the items in this batch. Server has already verified each
    // note belongs to this folder — no other folder's notes are touched.
    for (const item of args.items) {
      await ctx.db.patch(item.noteId, {
        title: item.title,
        body: item.body,
        tags: item.tags,
        folderName: args.folderName,
        encryptionDomain: "collaborative",
        collaborativeFolderId,
        updatedByUserId: userId,
        updatedAt: now,
      });
    }

    // Only mark active once the client signals this is the last batch.
    if (args.isFinalBatch) {
      await ctx.db.patch(collaborativeFolderId, { status: "active", updatedAt: now });
    }
    return collaborativeFolderId;
  },
});
```

- [ ] **Step 2: Add bookmark-folder conversion API**

Add to `convex/collaboration.ts` after `enableNoteFolderCollaboration`:

```ts
export const enableBookmarkFolderCollaboration = mutation({
  args: {
    categoryId: v.id("bookmarkCategories"),
    categoryName: v.string(),
    wrappedOwnerFolderKey: v.string(),
    wrapAlgorithm: v.string(),
    items: v.array(bookmarkConversionItem),
    isFinalBatch: v.boolean(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    const category = await ctx.db.get(args.categoryId);
    if (!category || category.userId !== userId) throw new Error("Category not found");

    if (category.collaborativeFolderId) {
      const cf = await ctx.db.get(category.collaborativeFolderId);
      if (cf && cf.status === "active") return cf._id;
    }

    if (args.items.length > 50) throw new Error("Convert at most 50 items per call; call again for the next batch");

    for (const item of args.items) {
      const bookmark = await ctx.db.get(item.bookmarkId);
      assertBookmarkBelongsToFolder(bookmark, { ownerUserId: userId, categoryId: args.categoryId });
    }

    const now = Date.now();

    let collaborativeFolderId: Id<"collaborativeFolders">;
    if (!category.collaborativeFolderId) {
      collaborativeFolderId = await ctx.db.insert("collaborativeFolders", {
        folderKind: "bookmark_folder",
        folderId: args.categoryId,
        ownerUserId: userId,
        status: "converting",
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.patch(args.categoryId, { collaborativeFolderId, name: args.categoryName, updatedAt: now });
      await ctx.db.insert("folderKeyGrants", {
        collaborativeFolderId,
        userId,
        wrappedFolderKey: args.wrappedOwnerFolderKey,
        wrapVersion: "v1",
        wrapAlgorithm: args.wrapAlgorithm,
        createdByUserId: userId,
        createdAt: now,
      });
      await ctx.db.insert("folderCollaborators", {
        collaborativeFolderId,
        userId,
        role: "owner",
        emailSnapshot: identity!.email ?? "",
        nameSnapshot: identityName(identity!),
        imageUrlSnapshot: identity!.pictureUrl ?? undefined,
        addedByUserId: userId,
        addedAt: now,
        updatedAt: now,
      });
    } else {
      const existingCf = await ctx.db.get(category.collaborativeFolderId);
      if (!existingCf) throw new Error("Collaboration row missing; call enableBookmarkFolderCollaboration from the beginning");
      collaborativeFolderId = existingCf._id;
    }

    for (const item of args.items) {
      await ctx.db.patch(item.bookmarkId, {
        url: item.url,
        title: item.title,
        siteName: item.siteName,
        description: item.description,
        thumbnailUrl: item.thumbnailUrl,
        faviconUrl: item.faviconUrl,
        encryptionDomain: "collaborative",
        collaborativeFolderId,
        updatedByUserId: userId,
        updatedAt: now,
      });
    }

    if (args.isFinalBatch) {
      await ctx.db.patch(collaborativeFolderId, { status: "active", updatedAt: now });
    }
    return collaborativeFolderId;
  },
});
```

- [ ] **Step 3: Add read queries for folders, members, and grants**

Add these exports to `convex/collaboration.ts`:

```ts
export const listMyCollaborativeFolders = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    const rows = await ctx.db
      .query("folderCollaborators")
      .withIndex("by_userId_removedAt", (q) => q.eq("userId", userId).eq("removedAt", undefined))
      .take(500);
    const folders = [];
    for (const row of rows) {
      const folder = await ctx.db.get(row.collaborativeFolderId);
      if (folder && folder.status === "active") folders.push({ ...folder, role: row.role });
    }
    return folders;
  },
});

export const listMembers = query({
  args: { collaborativeFolderId: v.id("collaborativeFolders") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    const self = await ctx.db
      .query("folderCollaborators")
      .withIndex("by_collaborativeFolderId_userId", (q) =>
        q.eq("collaborativeFolderId", args.collaborativeFolderId).eq("userId", userId),
      )
      .unique();
    if (!self || self.removedAt) throw new Error("Folder not found");
    return ctx.db
      .query("folderCollaborators")
      .withIndex("by_collaborativeFolderId_removedAt", (q) =>
        q.eq("collaborativeFolderId", args.collaborativeFolderId).eq("removedAt", undefined),
      )
      .take(100);
  },
});

export const listMyKeyGrants = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    return ctx.db
      .query("folderKeyGrants")
      .withIndex("by_userId_revokedAt", (q) => q.eq("userId", userId).eq("revokedAt", undefined))
      .take(500);
  },
});

export const listCollaborativeNotes = query({
  args: { collaborativeFolderId: v.id("collaborativeFolders"), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    await requireActiveCollaborator(ctx, { collaborativeFolderId: args.collaborativeFolderId, userId });
    return ctx.db
      .query("notes")
      .withIndex("by_collaborativeFolderId_deletedAt_createdAt", (q) =>
        q.eq("collaborativeFolderId", args.collaborativeFolderId).eq("deletedAt", undefined),
      )
      .take(args.limit ?? 100);
  },
});

export const listCollaborativeBookmarks = query({
  args: { collaborativeFolderId: v.id("collaborativeFolders"), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    await requireActiveCollaborator(ctx, { collaborativeFolderId: args.collaborativeFolderId, userId });
    return ctx.db
      .query("bookmarks")
      .withIndex("by_collaborativeFolderId_deletedAt_createdAt", (q) =>
        q.eq("collaborativeFolderId", args.collaborativeFolderId).eq("deletedAt", undefined),
      )
      .take(args.limit ?? 100);
  },
});
```

- [ ] **Step 4: Run codegen and collaboration tests**

Run: `npx convex codegen`

Expected: PASS.

Run: `npm test -- convex/collaboration.test.ts`

Expected: PASS for the conversion-scope test.

- [ ] **Step 5: Add positive and unrelated-row tests**

Extend `convex/collaboration.test.ts` with these tests:

```ts
it("converts only the selected note folder", async () => {
  const t = convexTest(schema, modules);
  const asOwner = t.withIdentity({ tokenIdentifier: "note-scope-owner", email: "owner@example.com", name: "Owner" });
  const folderA = await asOwner.mutation(api.notes.createNoteFolder, { name: "A" });
  const folderB = await asOwner.mutation(api.notes.createNoteFolder, { name: "B" });
  const noteA = await asOwner.mutation(api.notes.createNote, {
    body: "note a",
    folderId: folderA,
    folderName: "A",
    tags: [],
    createdDateKey: "2026-06-04",
  });
  const noteB = await asOwner.mutation(api.notes.createNote, {
    body: "note b",
    folderId: folderB,
    folderName: "B",
    tags: [],
    createdDateKey: "2026-06-04",
  });

  const collaborativeFolderId = await asOwner.mutation(api.collaboration.enableNoteFolderCollaboration, {
    folderId: folderA,
    folderName: "encrypted-a",
    wrappedOwnerFolderKey: "wrapped-owner-key",
    wrapAlgorithm: "test",
    items: [{ noteId: noteA, title: undefined, body: "encrypted-note-a", tags: [] }],
    isFinalBatch: true,
  });
  const notes = await asOwner.query(api.notes.listNotes, { limit: 20 });
  expect(notes.find((note) => note._id === noteA)?.collaborativeFolderId).toBe(collaborativeFolderId);
  expect(notes.find((note) => note._id === noteB)?.collaborativeFolderId).toBeUndefined();
});

it("converts only the selected bookmark folder", async () => {
  const t = convexTest(schema, modules);
  const asOwner = t.withIdentity({ tokenIdentifier: "bookmark-scope-owner", email: "owner@example.com", name: "Owner" });
  const categoryA = await asOwner.mutation(api.bookmarks.createBookmarkCategory, { name: "A" });
  const categoryB = await asOwner.mutation(api.bookmarks.createBookmarkCategory, { name: "B" });
  const bookmarkA = await asOwner.mutation(api.bookmarks.createBookmark, {
    categoryId: categoryA,
    createdDateKey: "2026-06-04",
    url: "encrypted-a",
    title: "encrypted a",
  });
  const bookmarkB = await asOwner.mutation(api.bookmarks.createBookmark, {
    categoryId: categoryB,
    createdDateKey: "2026-06-04",
    url: "encrypted-b",
    title: "encrypted b",
  });

  const collaborativeFolderId = await asOwner.mutation(api.collaboration.enableBookmarkFolderCollaboration, {
    categoryId: categoryA,
    categoryName: "encrypted-a",
    wrappedOwnerFolderKey: "wrapped-owner-key",
    wrapAlgorithm: "test",
    items: [{ bookmarkId: bookmarkA, url: "encrypted-a2", title: "encrypted a2" }],
    isFinalBatch: true,
  });
  const bookmarks = await asOwner.query(api.bookmarks.listBookmarks, { limit: 20 });
  expect(bookmarks.find((bookmark) => bookmark._id === bookmarkA)?.collaborativeFolderId).toBe(collaborativeFolderId);
  expect(bookmarks.find((bookmark) => bookmark._id === bookmarkB)?.collaborativeFolderId).toBeUndefined();
});
```

Use `asOwner.query(api.notes.listNotes, { limit: 20 })` and `asOwner.query(api.bookmarks.listBookmarks, { limit: 20 })` to inspect returned rows.

Also add a test for the **multi-batch conversion protocol** — this is the most critical flow to verify:

```ts
it("multi-batch conversion: folder stays converting until isFinalBatch, all items converted", async () => {
  const t = convexTest(schema, modules);
  const asOwner = t.withIdentity({ tokenIdentifier: "batch-owner", email: "owner@example.com", name: "Owner" });
  const folderId = await asOwner.mutation(api.notes.createNoteFolder, { name: "Big" });
  const noteA = await asOwner.mutation(api.notes.createNote, { body: "a", folderId, folderName: "Big", tags: [], createdDateKey: "2026-06-04" });
  const noteB = await asOwner.mutation(api.notes.createNote, { body: "b", folderId, folderName: "Big", tags: [], createdDateKey: "2026-06-04" });

  // Batch 1 — not final
  const cfId = await asOwner.mutation(api.collaboration.enableNoteFolderCollaboration, {
    folderId,
    folderName: "enc-big",
    wrappedOwnerFolderKey: "wrapped-key",
    wrapAlgorithm: "test",
    items: [{ noteId: noteA, body: "enc-a", tags: [] }],
    isFinalBatch: false,
  });
  const cfAfterBatch1 = await t.run((ctx) => ctx.db.get(cfId));
  expect(cfAfterBatch1?.status).toBe("converting"); // still locked to collaborators

  // Batch 2 — final
  await asOwner.mutation(api.collaboration.enableNoteFolderCollaboration, {
    folderId,
    folderName: "enc-big",
    wrappedOwnerFolderKey: "wrapped-key",
    wrapAlgorithm: "test",
    items: [{ noteId: noteB, body: "enc-b", tags: [] }],
    isFinalBatch: true,
  });
  const cfAfterBatch2 = await t.run((ctx) => ctx.db.get(cfId));
  expect(cfAfterBatch2?.status).toBe("active");

  const notes = await asOwner.query(api.notes.listNotes, { limit: 20 });
  expect(notes.find((n) => n._id === noteA)?.encryptionDomain).toBe("collaborative");
  expect(notes.find((n) => n._id === noteB)?.encryptionDomain).toBe("collaborative");
});

it("calling enableNoteFolderCollaboration on an already-active folder returns idempotently", async () => {
  const t = convexTest(schema, modules);
  const asOwner = t.withIdentity({ tokenIdentifier: "idem-owner", email: "owner@example.com", name: "Owner" });
  const folderId = await asOwner.mutation(api.notes.createNoteFolder, { name: "F" });
  const cfId = await asOwner.mutation(api.collaboration.enableNoteFolderCollaboration, {
    folderId, folderName: "enc-f", wrappedOwnerFolderKey: "k", wrapAlgorithm: "test", items: [], isFinalBatch: true,
  });
  const cfId2 = await asOwner.mutation(api.collaboration.enableNoteFolderCollaboration, {
    folderId, folderName: "enc-f", wrappedOwnerFolderKey: "k", wrapAlgorithm: "test", items: [], isFinalBatch: true,
  });
  expect(cfId2).toBe(cfId); // same ID, no duplicate row
});
```

- [ ] **Step 6: Run tests and typecheck**

Run: `npm test -- convex/collaboration.test.ts convex/notes.test.ts convex/bookmarks.test.ts`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```bash
git add convex/collaboration.ts convex/collaborationHelpers.ts convex/collaboration.test.ts convex/_generated
git commit -m "feat: enable folder collaboration conversion"
```

Expected: commit succeeds.

---

### Task 3B: Invite Email Action

**Files:**
- Create: `convex/collaborationEmail.ts`
- Modify: `convex/collaboration.ts`

Mutations cannot call external HTTP APIs in Convex. Email must be sent from a Convex Action. This task wires a `sendInviteEmail` Action that the `createInvite` mutation schedules via `ctx.scheduler`.

- [ ] **Step 1: Add email action**

Create `convex/collaborationEmail.ts`:

```ts
import { v } from "convex/values";
import { internalAction } from "./_generated/server";

export const sendInviteEmail = internalAction({
  args: {
    inviteeEmail: v.string(),
    inviterName: v.string(),
    folderNameSnapshot: v.string(),
    folderKind: v.union(v.literal("note_folder"), v.literal("bookmark_folder")),
    rawToken: v.string(),
    appBaseUrl: v.string(),
  },
  handler: async (_ctx, args) => {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.error("[collaboration] RESEND_API_KEY is not set — skipping invite email");
      return;
    }

    const fromEmail = process.env.RESEND_FROM_EMAIL ?? "noreply@omanote.app";
    const kindLabel = args.folderKind === "note_folder" ? "note folder" : "bookmark folder";
    const acceptUrl = `${args.appBaseUrl}/collaboration/accept?token=${encodeURIComponent(args.rawToken)}`;

    const html = `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a">
        <h2 style="margin-bottom:4px">You've been invited to collaborate</h2>
        <p style="margin:0 0 24px;color:#666">via Omanote</p>
        <table style="border-collapse:collapse;width:100%;font-size:14px;margin-bottom:24px">
          <tr>
            <td style="padding:6px 12px 6px 0;color:#888;white-space:nowrap;vertical-align:top">From</td>
            <td style="padding:6px 0">${args.inviterName}</td>
          </tr>
          <tr>
            <td style="padding:6px 12px 6px 0;color:#888;white-space:nowrap;vertical-align:top">Folder</td>
            <td style="padding:6px 0"><strong>${args.folderNameSnapshot}</strong> (${kindLabel})</td>
          </tr>
          <tr>
            <td style="padding:6px 12px 6px 0;color:#888;white-space:nowrap;vertical-align:top">Access</td>
            <td style="padding:6px 0">Private — view and edit</td>
          </tr>
        </table>
        <a href="${acceptUrl}" style="display:inline-block;padding:12px 24px;background:#18181b;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:500">Accept invitation</a>
        <p style="margin:24px 0 8px;font-size:13px;color:#888">
          Sign in to Omanote with this email address to accept.<br>
          This link is private — do not share it. It expires in 14 days.
        </p>
        <p style="margin:0;font-size:12px;color:#bbb">
          This is a private collaboration invitation, not a public share link.
        </p>
      </div>
    `;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `Omanote <${fromEmail}>`,
        to: args.inviteeEmail,
        subject: `${args.inviterName} invited you to collaborate on "${args.folderNameSnapshot}"`,
        html,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`[collaboration] Resend error ${res.status}: ${body}`);
    }
  },
});
```

`RESEND_API_KEY` and `RESEND_FROM_EMAIL` are already set from the feedback feature — no new secrets needed. Add one new variable to the Convex dashboard: `APP_BASE_URL` (e.g. `https://omanote.app`). This is the same base URL used to construct the accept link.

- [ ] **Step 2: Schedule email from createInvite**

In `convex/collaboration.ts`, import `internal` from `./_generated/api` and add at the end of `createInvite`, after the `ctx.db.insert` succeeds:

```ts
// Schedule the email outside the transaction so a failed send does not
// roll back the invite row. The raw token is passed here because it exists
// only in this call frame — after this mutation returns it is gone.
await ctx.scheduler.runAfter(0, internal.collaborationEmail.sendInviteEmail, {
  inviteeEmail: args.inviteeEmail.trim(),
  inviterName: identityName(identity!),
  folderNameSnapshot: args.folderNameSnapshot,
  folderKind: folder.folderKind,
  rawToken: token,
  appBaseUrl: process.env.APP_BASE_URL ?? "https://omanote.app",
});
```

`ctx.scheduler.runAfter(0, ...)` runs the Action asynchronously after the mutation commits. If the email fails, the invite row already exists and the owner can re-send by revoking and re-inviting.

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 4: Commit**

Run:

```bash
git add convex/collaborationEmail.ts convex/collaboration.ts
git commit -m "feat: send invite email via scheduled action"
```

Expected: commit succeeds.

---

### Task 4: Public Wrapping Key Crypto

**Files:**
- Modify: `src/lib/crypto.ts`
- Create: `src/lib/collaboration-crypto.ts`
- Create: `src/lib/collaboration-crypto.test.ts`

- [ ] **Step 1: Add failing crypto tests**

Create `src/lib/collaboration-crypto.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { decryptString, encryptString, generateContentKey } from "./crypto";
import {
  createCollaborationKeyPair,
  decryptPrivateWrappingKey,
  encryptPrivateWrappingKey,
  getPublicKeyFingerprint,
  unwrapFolderKeyWithPrivateKey,
  wrapFolderKeyForPublicKey,
} from "./collaboration-crypto";

describe("collaboration crypto", () => {
  it("wraps a folder key for an invitee and unwraps with their private key (ECDH)", async () => {
    // Owner has access to the folder key and the invitee's public key.
    const inviteePair = await createCollaborationKeyPair();
    const folderKey = await generateContentKey();
    const wrapped = await wrapFolderKeyForPublicKey(folderKey, inviteePair.publicKey);
    // Invitee unwraps using their own private key.
    const unwrapped = await unwrapFolderKeyWithPrivateKey(wrapped, inviteePair.privateKey);
    const encrypted = await encryptString("shared body", unwrapped);
    await expect(decryptString(encrypted, folderKey)).resolves.toBe("shared body");
  });

  it("encrypts and decrypts the private wrapping key with the user content key", async () => {
    const pair = await createCollaborationKeyPair();
    const userContentKey = await generateContentKey();
    const encrypted = await encryptPrivateWrappingKey(pair.privateKey, userContentKey);
    const restored = await decryptPrivateWrappingKey(encrypted, userContentKey);
    // Restored key must still be able to unwrap a grant.
    const folderKey = await generateContentKey();
    const wrapped = await wrapFolderKeyForPublicKey(folderKey, pair.publicKey);
    const unwrapped = await unwrapFolderKeyWithPrivateKey(wrapped, restored);
    const ct = await encryptString("check", unwrapped);
    await expect(decryptString(ct, folderKey)).resolves.toBe("check");
  });

  it("produces a short hex fingerprint for a public key", async () => {
    const pair = await createCollaborationKeyPair();
    const { exportPublicWrappingKey } = await import("./collaboration-crypto");
    const pub = await exportPublicWrappingKey(pair.publicKey);
    const fp = await getPublicKeyFingerprint(pub);
    expect(fp).toMatch(/^([0-9a-f]{2}:){7}[0-9a-f]{2}$/);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -- src/lib/collaboration-crypto.test.ts`

Expected: FAIL because `./collaboration-crypto` does not exist.

- [ ] **Step 3: Implement collaboration crypto helpers**

Create `src/lib/collaboration-crypto.ts`:

```ts
import { decryptString, encryptString } from "./crypto";

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToArrayBuffer(value: string): ArrayBuffer {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

// ECDH P-256 key pair used for offline key grants.
// The owner wraps a folder key for the invitee's public key without knowing
// their personal content key. Key generation is ~10× faster than RSA-2048
// and keys are ~4× smaller.
export async function createCollaborationKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey", "deriveBits"],
  );
}

export async function exportPublicWrappingKey(publicKey: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey("raw", publicKey);
  return arrayBufferToBase64(exported);
}

export async function importPublicWrappingKey(publicKeyB64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    base64ToArrayBuffer(publicKeyB64),
    { name: "ECDH", namedCurve: "P-256" },
    true,
    [],
  );
}

export async function exportPrivateWrappingKey(privateKey: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey("pkcs8", privateKey);
  return arrayBufferToBase64(exported);
}

export async function importPrivateWrappingKey(privateKeyB64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "pkcs8",
    base64ToArrayBuffer(privateKeyB64),
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey", "deriveBits"],
  );
}

async function deriveAesKeyFromEcdh(myPrivate: CryptoKey, theirPublic: CryptoKey): Promise<CryptoKey> {
  return crypto.subtle.deriveKey(
    { name: "ECDH", public: theirPublic },
    myPrivate,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

// ECIES-style: owner generates an ephemeral ECDH key pair per grant so the
// same folder key wrapped for the same recipient produces different ciphertext
// each time. The ephemeral public key is stored alongside the ciphertext.
export async function wrapFolderKeyForPublicKey(folderKey: CryptoKey, recipientPublicKey: CryptoKey): Promise<string> {
  const ephemeral = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveKey", "deriveBits"]);
  const aesKey = await deriveAesKeyFromEcdh(ephemeral.privateKey, recipientPublicKey);
  const rawFolderKey = await crypto.subtle.exportKey("raw", folderKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, aesKey, rawFolderKey);
  const epk = await crypto.subtle.exportKey("raw", ephemeral.publicKey);
  return JSON.stringify({
    v: 1,
    epk: arrayBufferToBase64(epk),
    iv: arrayBufferToBase64(iv.buffer),
    ct: arrayBufferToBase64(ct),
  });
}

export async function unwrapFolderKeyWithPrivateKey(wrappedJson: string, privateKey: CryptoKey): Promise<CryptoKey> {
  const parsed = JSON.parse(wrappedJson) as { v: number; epk: string; iv: string; ct: string };
  if (parsed.v !== 1) throw new Error("Unsupported folder key format");
  const ephemeralPublic = await crypto.subtle.importKey(
    "raw",
    base64ToArrayBuffer(parsed.epk),
    { name: "ECDH", namedCurve: "P-256" },
    true,
    [],
  );
  const aesKey = await deriveAesKeyFromEcdh(privateKey, ephemeralPublic);
  const rawFolderKey = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToArrayBuffer(parsed.iv) },
    aesKey,
    base64ToArrayBuffer(parsed.ct),
  );
  return crypto.subtle.importKey("raw", rawFolderKey, { name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
}

// Encrypt the ECDH private key with the user's personal content key so it can
// be stored in Convex for cross-device restore. Never store the raw private key.
export async function encryptPrivateWrappingKey(privateKey: CryptoKey, userContentKey: CryptoKey): Promise<string> {
  return encryptString(await exportPrivateWrappingKey(privateKey), userContentKey);
}

export async function decryptPrivateWrappingKey(encryptedPrivateKey: string, userContentKey: CryptoKey): Promise<CryptoKey> {
  return importPrivateWrappingKey(await decryptString(encryptedPrivateKey, userContentKey));
}

// First 8 bytes of the SHA-256 of the raw public key, formatted as colon-
// separated hex pairs. Display this in the UI so the owner can optionally
// verify the invitee's key out-of-band (e.g. over a call).
export async function getPublicKeyFingerprint(publicKeyB64: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", base64ToArrayBuffer(publicKeyB64));
  return Array.from(new Uint8Array(hash))
    .slice(0, 8)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join(":");
}
```

- [ ] **Step 4: Run crypto tests**

Run: `npm test -- src/lib/collaboration-crypto.test.ts`

Expected: PASS.

- [ ] **Step 5: Run typecheck**

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add src/lib/collaboration-crypto.ts src/lib/collaboration-crypto.test.ts src/lib/crypto.ts
git commit -m "feat: add collaboration key wrapping helpers"
```

Expected: commit succeeds.

---

### Task 4B: EncryptionContext — ECDH Key Lifecycle

**Files:**
- Modify: `src/contexts/EncryptionContext.tsx`
- Modify: `src/lib/crypto.ts` (passphrase rotation)

The ECDH collaboration key pair must be generated once, stored encrypted in Convex, and restored on every unlock. It must also be re-encrypted whenever the user rotates their passphrase. These are three distinct lifecycle events — get all three right before wiring the invite flow.

- [ ] **Step 1: Generate key pair on first encryption setup**

In `EncryptionContext.tsx`, inside the path that handles **first-time encryption setup** (after the content key is generated and before the wrapped key is stored):

```ts
// Generate ECDH collaboration key pair alongside the content key.
const collabPair = await createCollaborationKeyPair();
const encryptedPrivateKey = await encryptPrivateWrappingKey(collabPair.privateKey, contentKey);
const publicKeyB64 = await exportPublicWrappingKey(collabPair.publicKey);

// Store in memory for this session.
setCollabPrivateKey(collabPair.privateKey);

// Persist to Convex alongside the wrapped content key.
await savePublicKeyBundle({ publicKey: publicKeyB64, encryptedPrivateKey, algorithm: "ECDH-P256-HKDF-AES256GCM-v1" });
```

Add `collabPrivateKey: CryptoKey | null` to the EncryptionContext state and expose it to consumers.

- [ ] **Step 2: Restore key pair on unlock**

In `EncryptionContext.tsx`, inside the path that handles **unlock** (after `contentKey` is derived from passphrase or recovery key):

```ts
// Fetch the user's public key bundle.
const bundle = await getMyPublicKeyBundle(); // Convex query result
if (bundle) {
  // Decrypt the stored private key using the just-unlocked content key.
  const privateKey = await decryptPrivateWrappingKey(bundle.encryptedPrivateKey, contentKey);
  setCollabPrivateKey(privateKey);
} else {
  // First device to unlock after collab was enabled elsewhere — generate a new pair.
  const pair = await createCollaborationKeyPair();
  const encryptedPrivateKey = await encryptPrivateWrappingKey(pair.privateKey, contentKey);
  const publicKeyB64 = await exportPublicWrappingKey(pair.publicKey);
  setCollabPrivateKey(pair.privateKey);
  await savePublicKeyBundle({ publicKey: publicKeyB64, encryptedPrivateKey, algorithm: "ECDH-P256-HKDF-AES256GCM-v1" });
}
```

- [ ] **Step 3: Clear key on sign-out**

In the sign-out path, clear `collabPrivateKey` alongside the content key:

```ts
setCollabPrivateKey(null);
```

This prevents the in-memory private key from being accessible after the user signs out.

- [ ] **Step 4: Re-encrypt on passphrase rotation**

In the passphrase rotation flow (wherever `convex/encryptionKeys.ts` is called to re-wrap the content key), add after the new content key is in memory:

```ts
// The ECDH private key is encrypted with the old content key.
// Re-encrypt it with the new content key so the bundle stays valid after rotation.
const bundle = await getMyPublicKeyBundle();
if (bundle && collabPrivateKey) {
  const newEncryptedPrivateKey = await encryptPrivateWrappingKey(collabPrivateKey, newContentKey);
  await savePublicKeyBundle({
    publicKey: bundle.publicKey, // public key is unchanged
    encryptedPrivateKey: newEncryptedPrivateKey,
    algorithm: bundle.algorithm,
  });
}
```

If this step is skipped, the user's `encryptedPrivateKey` in Convex becomes undecryptable after rotation, silently locking them out of all collaborative folders on next unlock.

- [ ] **Step 5: Run typecheck**

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add src/contexts/EncryptionContext.tsx
git commit -m "feat: wire ECDH collaboration key pair lifecycle in EncryptionContext"
```

Expected: commit succeeds.

---

### Task 5: Public Key Bundle Backend

**Files:**
- Modify: `convex/collaboration.ts`
- Test: `convex/collaboration.test.ts`

- [ ] **Step 1: Add tests for public key bundle save/read**

Add to `convex/collaboration.test.ts`:

```ts
describe("collaboration public key bundles", () => {
  it("saves and reads the authenticated user's active public key bundle", async () => {
    const t = convexTest(schema, modules);
    const asUser = t.withIdentity({ tokenIdentifier: "key-user" });

    await asUser.mutation(api.collaboration.savePublicKeyBundle, {
      publicKey: "public-key",
      encryptedPrivateKey: "encrypted-private-key",
      algorithm: "ECDH-P256-HKDF-AES256GCM-v1",
    });

    await expect(asUser.query(api.collaboration.getMyPublicKeyBundle, {})).resolves.toMatchObject({
      publicKey: "public-key",
      encryptedPrivateKey: "encrypted-private-key",
      algorithm: "ECDH-P256-HKDF-AES256GCM-v1",
      version: "v1",
    });
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -- convex/collaboration.test.ts`

Expected: FAIL because `savePublicKeyBundle` is missing.

- [ ] **Step 3: Add bundle mutations/queries**

Add to `convex/collaboration.ts` after `getMyPublicKeyBundle`:

```ts
export const savePublicKeyBundle = mutation({
  args: {
    publicKey: v.string(),
    encryptedPrivateKey: v.string(),
    algorithm: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    const emailLower = (identity!.email ?? "").trim().toLowerCase();
    const now = Date.now();
    const existing = await ctx.db
      .query("userPublicKeyBundles")
      .withIndex("by_userId_revokedAt", (q) => q.eq("userId", userId).eq("revokedAt", undefined))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        publicKey: args.publicKey,
        encryptedPrivateKey: args.encryptedPrivateKey,
        algorithm: args.algorithm,
        emailLower,
        rotatedAt: now,
      });
      return existing._id;
    }
    return ctx.db.insert("userPublicKeyBundles", {
      userId,
      emailLower,
      publicKey: args.publicKey,
      encryptedPrivateKey: args.encryptedPrivateKey,
      algorithm: args.algorithm,
      version: "v1",
      createdAt: now,
    });
  },
});

export const getMyPublicKeyBundle = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    return ctx.db
      .query("userPublicKeyBundles")
      .withIndex("by_userId_revokedAt", (q) => q.eq("userId", userId).eq("revokedAt", undefined))
      .first();
  },
});

// Used by the owner client when creating a key grant: fetch the invitee's
// public wrapping key by email so the owner can wrap the folder key offline.
export const getCollaboratorPublicKey = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    requireUserId(identity);
    const emailLower = args.email.trim().toLowerCase();
    const bundle = await ctx.db
      .query("userPublicKeyBundles")
      .withIndex("by_emailLower_revokedAt", (q) => q.eq("emailLower", emailLower).eq("revokedAt", undefined))
      .first();
    // Return only public material — never expose encryptedPrivateKey to a third party.
    if (!bundle) return null;
    return { userId: bundle.userId, publicKey: bundle.publicKey, algorithm: bundle.algorithm };
  },
});

// Used by the owner to store a pre-computed key grant for an invitee whose
// public key bundle already exists. Call this before or alongside createInvite.
export const grantFolderKey = mutation({
  args: {
    collaborativeFolderId: v.id("collaborativeFolders"),
    inviteeUserId: v.string(),
    wrappedFolderKey: v.string(),
    wrapAlgorithm: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    const folder = await ctx.db.get(args.collaborativeFolderId);
    if (!folder || folder.ownerUserId !== userId || folder.status !== "active") throw new Error("Folder not found");
    const now = Date.now();
    const existing = await ctx.db
      .query("folderKeyGrants")
      .withIndex("by_collaborativeFolderId_userId", (q) =>
        q.eq("collaborativeFolderId", args.collaborativeFolderId).eq("userId", args.inviteeUserId),
      )
      .unique();
    if (existing && !existing.revokedAt) {
      await ctx.db.patch(existing._id, { wrappedFolderKey: args.wrappedFolderKey, wrapAlgorithm: args.wrapAlgorithm });
      return existing._id;
    }
    return ctx.db.insert("folderKeyGrants", {
      collaborativeFolderId: args.collaborativeFolderId,
      userId: args.inviteeUserId,
      wrappedFolderKey: args.wrappedFolderKey,
      wrapVersion: "v1",
      wrapAlgorithm: args.wrapAlgorithm,
      createdByUserId: userId,
      createdAt: now,
    });
  },
});
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npx convex codegen`

Expected: PASS.

Run: `npm test -- convex/collaboration.test.ts`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add convex/collaboration.ts convex/collaboration.test.ts convex/_generated
git commit -m "feat: store collaboration public key bundles"
```

Expected: commit succeeds.

> **⚠️ Passphrase rotation dependency**: `savePublicKeyBundle` re-encrypts `encryptedPrivateKey` with the current content key. If the user later rotates their passphrase, `encryptedPrivateKey` must be re-encrypted with the new content key or the user loses access to all collaborative folders on next unlock. This is handled in Task 4B Step 4. Verify that step is complete before shipping passphrase rotation alongside collaboration.

---

### Task 6: Invite and Membership Backend

**Files:**
- Modify: `convex/collaboration.ts`
- Test: `convex/collaboration.test.ts`

- [ ] **Step 1: Add invite tests**

Add these tests to `convex/collaboration.test.ts`:

```ts
it("creates one pending invite for a folder and email", async () => {
  const t = convexTest(schema, modules);
  const asOwner = t.withIdentity({ tokenIdentifier: "invite-owner", email: "owner@example.com", name: "Owner" });
  const folderId = await asOwner.mutation(api.notes.createNoteFolder, { name: "Shared" });
  const collaborativeFolderId = await asOwner.mutation(api.collaboration.enableNoteFolderCollaboration, {
    folderId,
    folderName: "encrypted-shared",
    wrappedOwnerFolderKey: "wrapped-owner-key",
    wrapAlgorithm: "test",
    items: [],
    isFinalBatch: true,
  });

  const first = await asOwner.mutation(api.collaboration.createInvite, {
    collaborativeFolderId,
    inviteeEmail: "friend@example.com",
    folderNameSnapshot: "Shared",
    wrappedFolderKey: "wrapped-friend-key",
    wrapAlgorithm: "test",
  });
  const second = await asOwner.mutation(api.collaboration.createInvite, {
    collaborativeFolderId,
    inviteeEmail: "FRIEND@example.com",
    folderNameSnapshot: "Shared",
    wrappedFolderKey: "wrapped-friend-key",
    wrapAlgorithm: "test",
  });

  expect(second.inviteId).toBe(first.inviteId);
  expect(first.token).toBeTruthy();
  expect(second.token).toBeNull();
});

it("revokes a pending invite", async () => {
  const t = convexTest(schema, modules);
  const asOwner = t.withIdentity({ tokenIdentifier: "revoke-owner", email: "owner@example.com", name: "Owner" });
  const asInvitee = t.withIdentity({ tokenIdentifier: "revoke-invitee", email: "friend@example.com", name: "Friend" });
  const folderId = await asOwner.mutation(api.notes.createNoteFolder, { name: "Shared" });
  const collaborativeFolderId = await asOwner.mutation(api.collaboration.enableNoteFolderCollaboration, {
    folderId,
    folderName: "encrypted-shared",
    wrappedOwnerFolderKey: "wrapped-owner-key",
    wrapAlgorithm: "test",
    items: [],
    isFinalBatch: true,
  });
  const invite = await asOwner.mutation(api.collaboration.createInvite, {
    collaborativeFolderId,
    inviteeEmail: "friend@example.com",
    folderNameSnapshot: "Shared",
    wrappedFolderKey: "wrapped-friend-key",
    wrapAlgorithm: "test",
  });

  await asOwner.mutation(api.collaboration.revokeInvite, { inviteId: invite.inviteId });
  await expect(asInvitee.mutation(api.collaboration.acceptInvite, { token: invite.token! })).rejects.toThrow("Invite is no longer active");
});

it("accepts an invite only for the matching email", async () => {
  const t = convexTest(schema, modules);
  const asOwner = t.withIdentity({ tokenIdentifier: "accept-owner", email: "owner@example.com", name: "Owner" });
  const asWrong = t.withIdentity({ tokenIdentifier: "wrong-user", email: "wrong@example.com", name: "Wrong" });
  const asInvitee = t.withIdentity({ tokenIdentifier: "right-user", email: "friend@example.com", name: "Friend" });
  const folderId = await asOwner.mutation(api.notes.createNoteFolder, { name: "Shared" });
  const collaborativeFolderId = await asOwner.mutation(api.collaboration.enableNoteFolderCollaboration, {
    folderId,
    folderName: "encrypted-shared",
    wrappedOwnerFolderKey: "wrapped-owner-key",
    wrapAlgorithm: "test",
    items: [],
    isFinalBatch: true,
  });
  const invite = await asOwner.mutation(api.collaboration.createInvite, {
    collaborativeFolderId,
    inviteeEmail: "friend@example.com",
    folderNameSnapshot: "Shared",
    wrappedFolderKey: "wrapped-friend-key",
    wrapAlgorithm: "test",
  });

  await expect(asWrong.mutation(api.collaboration.acceptInvite, { token: invite.token! })).rejects.toThrow("Invite email does not match");
  await expect(asInvitee.mutation(api.collaboration.acceptInvite, { token: invite.token! })).resolves.toMatchObject({
    collaborativeFolderId,
  });
});

it("removes a collaborator and blocks their member query", async () => {
  const t = convexTest(schema, modules);
  const asOwner = t.withIdentity({ tokenIdentifier: "remove-owner", email: "owner@example.com", name: "Owner" });
  const asInvitee = t.withIdentity({ tokenIdentifier: "remove-invitee", email: "friend@example.com", name: "Friend" });
  const folderId = await asOwner.mutation(api.notes.createNoteFolder, { name: "Shared" });
  const collaborativeFolderId = await asOwner.mutation(api.collaboration.enableNoteFolderCollaboration, {
    folderId,
    folderName: "encrypted-shared",
    wrappedOwnerFolderKey: "wrapped-owner-key",
    wrapAlgorithm: "test",
    items: [],
    isFinalBatch: true,
  });
  const invite = await asOwner.mutation(api.collaboration.createInvite, {
    collaborativeFolderId,
    inviteeEmail: "friend@example.com",
    folderNameSnapshot: "Shared",
    wrappedFolderKey: "wrapped-friend-key",
    wrapAlgorithm: "test",
  });
  await asInvitee.mutation(api.collaboration.acceptInvite, { token: invite.token! });

  await asOwner.mutation(api.collaboration.removeCollaborator, { collaborativeFolderId, userId: "remove-invitee" });
  await expect(asInvitee.query(api.collaboration.listMembers, { collaborativeFolderId })).rejects.toThrow("Folder not found");
});
```

Use `api.collaboration.createInvite`, `revokeInvite`, `acceptInvite`, and `removeCollaborator`.

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- convex/collaboration.test.ts`

Expected: FAIL because invite APIs are missing.

- [ ] **Step 3: Add token hash helper and invite APIs**

In `convex/collaboration.ts`, add:

```ts
function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function generateInviteToken() {
  // 53 chars; 53 * 4 = 212 — reject bytes >= 212 to avoid modulo bias.
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const result: string[] = [];
  while (result.length < 24) {
    const bytes = crypto.getRandomValues(new Uint8Array(48));
    for (const b of bytes) {
      if (result.length === 24) break;
      if (b < 212) result.push(chars[b % chars.length]);
    }
  }
  return result.join("");
}

async function sha256(text: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
```

Add mutations:

```ts
const MAX_COLLABORATORS = 5;

export const createInvite = mutation({
  args: {
    collaborativeFolderId: v.id("collaborativeFolders"),
    inviteeEmail: v.string(),
    folderNameSnapshot: v.string(),
    wrappedFolderKey: v.optional(v.string()),
    wrapAlgorithm: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    const folder = await ctx.db.get(args.collaborativeFolderId);
    if (!folder || folder.ownerUserId !== userId || folder.status !== "active") throw new Error("Folder not found");
    const emailLower = normalizeEmail(args.inviteeEmail);
    if (!emailLower || emailLower === normalizeEmail(identity!.email ?? "")) throw new Error("Choose a different collaborator email");

    // Check collaborator cap (includes owner).
    const memberCount = await ctx.db
      .query("folderCollaborators")
      .withIndex("by_collaborativeFolderId_removedAt", (q) =>
        q.eq("collaborativeFolderId", args.collaborativeFolderId).eq("removedAt", undefined),
      )
      .collect()
      .then((rows) => rows.length);
    if (memberCount >= MAX_COLLABORATORS) throw new Error(`Folder already has the maximum of ${MAX_COLLABORATORS} collaborators`);

    // Use the targeted index instead of collecting all pending invites.
    const duplicate = await ctx.db
      .query("folderInvites")
      .withIndex("by_inviteeEmailLower_status", (q) => q.eq("inviteeEmailLower", emailLower).eq("status", "pending"))
      .first();
    if (duplicate && duplicate.collaborativeFolderId === args.collaborativeFolderId) {
      return { inviteId: duplicate._id, token: null };
    }

    const token = generateInviteToken();
    const now = Date.now();
    const inviteId = await ctx.db.insert("folderInvites", {
      collaborativeFolderId: args.collaborativeFolderId,
      folderKind: folder.folderKind,
      folderNameSnapshot: args.folderNameSnapshot,
      inviteeEmail: args.inviteeEmail.trim(),
      inviteeEmailLower: emailLower,
      inviteTokenHash: await sha256(token),
      status: "pending",
      createdByUserId: userId,
      createdAt: now,
      updatedAt: now,
      expiresAt: now + 1000 * 60 * 60 * 24 * 14,
    });
    return { inviteId, token };
  },
});
```

Add these mutations after `createInvite`:

```ts
export const revokeInvite = mutation({
  args: { inviteId: v.id("folderInvites") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    const invite = await ctx.db.get(args.inviteId);
    if (!invite || invite.status !== "pending") throw new Error("Invite is no longer active");
    const folder = await ctx.db.get(invite.collaborativeFolderId);
    if (!folder || folder.ownerUserId !== userId) throw new Error("Folder not found");
    const now = Date.now();
    await ctx.db.patch(args.inviteId, { status: "revoked", revokedAt: now, updatedAt: now });
  },
});

export const acceptInvite = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    const tokenHash = await sha256(args.token);
    const invite = await ctx.db
      .query("folderInvites")
      .withIndex("by_inviteTokenHash", (q) => q.eq("inviteTokenHash", tokenHash))
      .unique();
    if (!invite || invite.status !== "pending") throw new Error("Invite is no longer active");
    if (invite.expiresAt && invite.expiresAt < Date.now()) throw new Error("Invite is no longer active");
    if (normalizeEmail(identity!.email ?? "") !== invite.inviteeEmailLower) throw new Error("Invite email does not match");
    const folder = await ctx.db.get(invite.collaborativeFolderId);
    if (!folder || folder.status !== "active") throw new Error("Folder not found");
    const grant = await ctx.db
      .query("folderKeyGrants")
      .withIndex("by_collaborativeFolderId_userId", (q) =>
        q.eq("collaborativeFolderId", invite.collaborativeFolderId).eq("userId", userId),
      )
      .unique();
    if (!grant || grant.revokedAt) throw new Error("Folder key grant is not ready");

    const now = Date.now();
    // Always use the current identity values to keep snapshots fresh.
    const freshEmail = identity!.email ?? invite.inviteeEmail;
    const freshName = identityName(identity!);
    const freshImage = identity!.pictureUrl ?? undefined;

    const existingMember = await ctx.db
      .query("folderCollaborators")
      .withIndex("by_collaborativeFolderId_userId", (q) =>
        q.eq("collaborativeFolderId", invite.collaborativeFolderId).eq("userId", userId),
      )
      .unique();
    if (existingMember) {
      await ctx.db.patch(existingMember._id, {
        removedAt: undefined,
        emailSnapshot: freshEmail,
        nameSnapshot: freshName,
        imageUrlSnapshot: freshImage,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("folderCollaborators", {
        collaborativeFolderId: invite.collaborativeFolderId,
        userId,
        role: "editor",
        emailSnapshot: freshEmail,
        nameSnapshot: freshName,
        imageUrlSnapshot: freshImage,
        addedByUserId: invite.createdByUserId,
        addedAt: now,
        updatedAt: now,
      });
    }
    await ctx.db.patch(invite._id, { status: "accepted", acceptedAt: now, acceptedByUserId: userId, updatedAt: now });
    return { collaborativeFolderId: invite.collaborativeFolderId, folderKind: folder.folderKind };
  },
});

export const removeCollaborator = mutation({
  args: {
    collaborativeFolderId: v.id("collaborativeFolders"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const ownerUserId = requireUserId(identity);
    const folder = await ctx.db.get(args.collaborativeFolderId);
    if (!folder || folder.ownerUserId !== ownerUserId) throw new Error("Folder not found");
    if (args.userId === ownerUserId) throw new Error("Owner cannot be removed");
    const now = Date.now();
    const member = await ctx.db
      .query("folderCollaborators")
      .withIndex("by_collaborativeFolderId_userId", (q) =>
        q.eq("collaborativeFolderId", args.collaborativeFolderId).eq("userId", args.userId),
      )
      .unique();
    if (member && !member.removedAt) await ctx.db.patch(member._id, { removedAt: now, updatedAt: now });
    const grant = await ctx.db
      .query("folderKeyGrants")
      .withIndex("by_collaborativeFolderId_userId", (q) =>
        q.eq("collaborativeFolderId", args.collaborativeFolderId).eq("userId", args.userId),
      )
      .unique();
    if (grant && !grant.revokedAt) await ctx.db.patch(grant._id, { revokedAt: now });
  },
});
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npx convex codegen`

Expected: PASS.

Run: `npm test -- convex/collaboration.test.ts`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add convex/collaboration.ts convex/collaboration.test.ts convex/_generated
git commit -m "feat: add collaboration invites"
```

Expected: commit succeeds.

---

### Task 7: Collaborative Reads and Writes

**Files:**
- Modify: `convex/notes.ts`
- Modify: `convex/bookmarks.ts`
- Modify: `convex/collaborationHelpers.ts`
- Test: `convex/collaboration.test.ts`

- [ ] **Step 1: Add permission tests**

Add these tests to `convex/collaboration.test.ts`:

```ts
it("lets an editor create and update a note in a collaborative folder", async () => {
  const fixture = await createAcceptedNoteFolderInviteFixture();
  const noteId = await fixture.asInvitee.mutation(api.notes.createNote, {
    body: "encrypted collaborator note",
    tags: [],
    folderId: fixture.folderId,
    folderName: "encrypted-shared",
    collaborativeFolderId: fixture.collaborativeFolderId,
    createdDateKey: "2026-06-04",
  });
  await expect(
    fixture.asInvitee.mutation(api.notes.updateNote, {
      noteId,
      body: "encrypted edited note",
      tags: [],
      collaborativeFolderId: fixture.collaborativeFolderId,
    }),
  ).resolves.toBeNull();
});

it("prevents an editor from deleting a note folder", async () => {
  const fixture = await createAcceptedNoteFolderInviteFixture();
  await expect(fixture.asInvitee.mutation(api.notes.deleteNoteFolder, { folderId: fixture.folderId })).rejects.toThrow("Folder not found");
});

it("lets an editor create and update a bookmark in a collaborative folder", async () => {
  const fixture = await createAcceptedBookmarkFolderInviteFixture();
  const bookmarkId = await fixture.asInvitee.mutation(api.bookmarks.createBookmark, {
    categoryId: fixture.categoryId,
    collaborativeFolderId: fixture.collaborativeFolderId,
    createdDateKey: "2026-06-04",
    url: "encrypted-url",
    title: "encrypted-title",
  });
  await expect(
    fixture.asInvitee.mutation(api.bookmarks.updateBookmark, {
      bookmarkId,
      collaborativeFolderId: fixture.collaborativeFolderId,
      url: "encrypted-url-2",
      title: "encrypted-title-2",
    }),
  ).resolves.toBeNull();
});

it("prevents an editor from deleting a bookmark folder", async () => {
  const fixture = await createAcceptedBookmarkFolderInviteFixture();
  await expect(fixture.asInvitee.mutation(api.bookmarks.deleteBookmarkCategory, { categoryId: fixture.categoryId })).rejects.toThrow(
    "Category not found",
  );
});
```

Add test fixture helpers above these tests:

```ts
async function createAcceptedNoteFolderInviteFixture() {
  const t = convexTest(schema, modules);
  const asOwner = t.withIdentity({ tokenIdentifier: "fixture-owner", email: "owner@example.com", name: "Owner" });
  const asInvitee = t.withIdentity({ tokenIdentifier: "fixture-invitee", email: "friend@example.com", name: "Friend" });
  const folderId = await asOwner.mutation(api.notes.createNoteFolder, { name: "Shared" });
  const collaborativeFolderId = await asOwner.mutation(api.collaboration.enableNoteFolderCollaboration, {
    folderId,
    folderName: "encrypted-shared",
    wrappedOwnerFolderKey: "wrapped-owner-key",
    wrapAlgorithm: "test",
    items: [],
    isFinalBatch: true,
  });
  const invite = await asOwner.mutation(api.collaboration.createInvite, {
    collaborativeFolderId,
    inviteeEmail: "friend@example.com",
    folderNameSnapshot: "Shared",
    wrappedFolderKey: "wrapped-friend-key",
    wrapAlgorithm: "test",
  });
  await asInvitee.mutation(api.collaboration.acceptInvite, { token: invite.token! });
  return { t, asOwner, asInvitee, folderId, collaborativeFolderId };
}

async function createAcceptedBookmarkFolderInviteFixture() {
  const t = convexTest(schema, modules);
  const asOwner = t.withIdentity({ tokenIdentifier: "bookmark-fixture-owner", email: "owner@example.com", name: "Owner" });
  const asInvitee = t.withIdentity({ tokenIdentifier: "bookmark-fixture-invitee", email: "friend@example.com", name: "Friend" });
  const categoryId = await asOwner.mutation(api.bookmarks.createBookmarkCategory, { name: "Shared" });
  const collaborativeFolderId = await asOwner.mutation(api.collaboration.enableBookmarkFolderCollaboration, {
    categoryId,
    categoryName: "encrypted-shared",
    wrappedOwnerFolderKey: "wrapped-owner-key",
    wrapAlgorithm: "test",
    items: [],
    isFinalBatch: true,
  });
  const invite = await asOwner.mutation(api.collaboration.createInvite, {
    collaborativeFolderId,
    inviteeEmail: "friend@example.com",
    folderNameSnapshot: "Shared",
    wrappedFolderKey: "wrapped-friend-key",
    wrapAlgorithm: "test",
  });
  await asInvitee.mutation(api.collaboration.acceptInvite, { token: invite.token! });
  return { t, asOwner, asInvitee, categoryId, collaborativeFolderId };
}
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- convex/collaboration.test.ts`

Expected: FAIL because existing mutations require `folder.userId === current user`.

- [ ] **Step 3: Add optional collaborative args**

In `convex/notes.ts`, add optional `collaborativeFolderId: v.optional(v.id("collaborativeFolders"))` to create/update mutations that place notes in folders.

In `convex/bookmarks.ts`, add optional `collaborativeFolderId: v.optional(v.id("collaborativeFolders"))` to create/update mutations that place bookmarks in categories.

- [ ] **Step 4: Branch authorization**

For collaborative writes:

```ts
if (args.collaborativeFolderId) {
  await requireActiveCollaborator(ctx, { collaborativeFolderId: args.collaborativeFolderId, userId });
  const cf = await ctx.db.get(args.collaborativeFolderId);
  if (!cf || cf.status !== "active") throw new Error("Folder not found");

  // IMPORTANT: set userId to the FOLDER OWNER's userId, not the editor's.
  // This keeps collaborative notes visible in the owner's existing listNotes
  // query (which filters by userId). The actual author is stored separately
  // in createdByUserId / updatedByUserId for attribution display.
  // Collaborator reads use listCollaborativeNotes (by collaborativeFolderId
  // index) so they see items regardless of whose userId is on the row.
  const ownerUserId = cf.ownerUserId;

  await ctx.db.insert("notes", {
    // ...other fields from args...
    userId: ownerUserId,           // owner's userId for list-query compatibility
    folderId: cf.folderId as Id<"noteFolders">,
    encryptionDomain: "collaborative",
    collaborativeFolderId: args.collaborativeFolderId,
    createdByUserId: userId,       // actual author
    updatedByUserId: userId,
    // ...
  });
}
```

Apply the same pattern in `bookmarks.ts`: set `userId = cf.ownerUserId`, `categoryId = cf.folderId`, `createdByUserId = userId`.

For personal writes, keep the existing owner checks unchanged.

- [ ] **Step 5: Run tests and typecheck**

Run: `npm test -- convex/collaboration.test.ts convex/notes.test.ts convex/bookmarks.test.ts`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add convex/notes.ts convex/bookmarks.ts convex/collaborationHelpers.ts convex/collaboration.test.ts
git commit -m "feat: support collaborative folder content writes"
```

Expected: commit succeeds.

---

### Task 8: Frontend Key Resolver

**Files:**
- Create: `src/lib/collaboration-key-resolver.ts`
- Create: `src/lib/collaboration-key-resolver.test.ts`
- Modify: `src/app/AppProvider.tsx`

- [ ] **Step 1: Add key resolver tests**

Create `src/lib/collaboration-key-resolver.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { chooseEncryptionDomain } from "./collaboration-key-resolver";

describe("collaboration key resolver", () => {
  it("uses personal domain when item is not collaborative", () => {
    expect(chooseEncryptionDomain({ encryptionDomain: undefined, collaborativeFolderId: undefined })).toBe("personal");
  });

  it("uses collaborative domain when item has a collaborative folder id", () => {
    expect(chooseEncryptionDomain({ encryptionDomain: "collaborative", collaborativeFolderId: "cf_123" })).toBe("collaborative");
  });

  it("rejects malformed collaborative metadata", () => {
    expect(() => chooseEncryptionDomain({ encryptionDomain: "collaborative", collaborativeFolderId: undefined })).toThrow(
      "Collaborative item is missing folder key metadata",
    );
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -- src/lib/collaboration-key-resolver.test.ts`

Expected: FAIL because resolver file does not exist.

- [ ] **Step 3: Implement resolver**

Create `src/lib/collaboration-key-resolver.ts`:

```ts
export type EncryptionDomain = "personal" | "collaborative";

export function chooseEncryptionDomain(item: {
  encryptionDomain?: EncryptionDomain;
  collaborativeFolderId?: string;
}): EncryptionDomain {
  if (item.encryptionDomain === "collaborative") {
    if (!item.collaborativeFolderId) {
      throw new Error("Collaborative item is missing folder key metadata");
    }
    return "collaborative";
  }
  return "personal";
}
```

- [ ] **Step 4: Integrate reads in AppProvider**

In `src/app/AppProvider.tsx`, fetch:

```ts
const collaborativeFolders = useQuery(api.collaboration.listMyCollaborativeFolders);
const folderKeyGrants = useQuery(api.collaboration.listMyKeyGrants);
```

Build a folder-key map after decrypting key grants. Use `chooseEncryptionDomain` before decrypting notes/bookmarks. If a collaborative item is missing a folder key — either the key grant was revoked or the owner has not yet provided one — do **not** silently drop it. Instead keep it in a separate `lockedCollaborativeItems` list that the UI renders as a visible locked placeholder so the user understands their content exists but is temporarily inaccessible:

```ts
// In AppProvider
const lockedCollaborativeItems: Array<{ id: string; collaborativeFolderId: string; kind: "note" | "bookmark" }> = [];

// When decrypting:
if (!folderKeyMap.has(item.collaborativeFolderId)) {
  lockedCollaborativeItems.push({ id: item._id, collaborativeFolderId: item.collaborativeFolderId, kind: "note" });
  continue; // do not include in decrypted list
}
```

Expose `lockedCollaborativeItems` through context so `NotesScreen` and `BookmarksScreen` can render a "key not available" placeholder card for each locked item.

- [ ] **Step 5: Run tests and typecheck**

Run: `npm test -- src/lib/collaboration-key-resolver.test.ts src/app/AppProvider.test.ts`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add src/lib/collaboration-key-resolver.ts src/lib/collaboration-key-resolver.test.ts src/app/AppProvider.tsx
git commit -m "feat: resolve collaboration encryption keys"
```

Expected: commit succeeds.

---

### Task 9: Enable Collaboration From UI

**Files:**
- Modify: `src/components/ShareNoteFolderModal.tsx`
- Modify: `src/components/ShareFolderModal.tsx`
- Modify: `src/app/AppProvider.tsx`

- [ ] **Step 1: Add UI tests for public-vs-private separation**

Add or extend component tests so the modal renders both:

```ts
expect(screen.getByText("Public link")).toBeInTheDocument();
expect(screen.getByText("Private collaboration")).toBeInTheDocument();
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- src/components/ShareNoteFolderModal.test.tsx src/components/ShareFolderModal.test.tsx`

Expected: FAIL because the private collaboration section is not rendered.

- [ ] **Step 3: Add enable collaboration action**

In each share modal:

- Add a "Private collaboration" section.
- Add an "Enable collaboration" button.
- Disable it while encryption is locked.
- On click:
  1. Gather only the items that belong to the selected folder/category from decrypted app state.
  2. Generate a fresh AES-GCM-256 folder key.
  3. Re-encrypt each item's protected fields with the folder key.
  4. Split items into batches of ≤ 50.
  5. For each batch call `api.collaboration.enableNoteFolderCollaboration` (or Bookmark variant) with `isFinalBatch: false`.
  6. On the last batch, set `isFinalBatch: true`.
  7. If any batch call throws, pause and show a "Conversion paused — tap Resume to continue or Cancel to revert" UI. Do not silently ignore errors.
  8. "Cancel" triggers the disable flow (see Task 14) to re-encrypt already-converted items back to personal key.

The client payload must include explicit item ids and their encrypted replacement fields. The server validates every item belongs to the target folder. It must not ask Convex to convert all user content.

**Mixed-state during batching is safe**: the key resolver (`chooseEncryptionDomain`) checks each item's `encryptionDomain` field individually. Items not yet converted retain `encryptionDomain: "personal"` and are decrypted with the personal key. Converted items have `encryptionDomain: "collaborative"` and use the folder key. The folder stays in `"converting"` status until the final batch succeeds, so collaborators cannot access it in a partial state.

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test -- src/components/ShareNoteFolderModal.test.tsx src/components/ShareFolderModal.test.tsx`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/components/ShareNoteFolderModal.tsx src/components/ShareFolderModal.tsx src/app/AppProvider.tsx
git commit -m "feat: enable collaboration from folder settings"
```

Expected: commit succeeds.

---

### Task 10: Collaborator Management UI

**Files:**
- Create: `src/components/CollaboratorAvatarStack.tsx`
- Create: `src/components/FolderCollaborationPanel.tsx`
- Modify: `src/components/ShareNoteFolderModal.tsx`
- Modify: `src/components/ShareFolderModal.tsx`

- [ ] **Step 1: Add avatar stack tests**

Create `src/components/CollaboratorAvatarStack.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CollaboratorAvatarStack } from "./CollaboratorAvatarStack";

describe("CollaboratorAvatarStack", () => {
  it("shows three avatars and overflow", () => {
    render(
      <CollaboratorAvatarStack
        members={[
          { userId: "1", name: "Ava" },
          { userId: "2", name: "Ben" },
          { userId: "3", name: "Cam" },
          { userId: "4", name: "Dee" },
        ]}
      />,
    );
    expect(screen.getByLabelText("Ava")).toBeInTheDocument();
    expect(screen.getByLabelText("Ben")).toBeInTheDocument();
    expect(screen.getByLabelText("Cam")).toBeInTheDocument();
    expect(screen.getByText("+1")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -- src/components/CollaboratorAvatarStack.test.tsx`

Expected: FAIL because component does not exist.

- [ ] **Step 3: Implement avatar stack**

Create `src/components/CollaboratorAvatarStack.tsx`:

```tsx
type Member = {
  userId: string;
  name: string;
  imageUrl?: string;
};

function initials(name: string) {
  return name.trim().slice(0, 1).toUpperCase() || "?";
}

export function CollaboratorAvatarStack({ members }: { members: Member[] }) {
  const visible = members.slice(0, 3);
  const overflow = Math.max(0, members.length - visible.length);
  return (
    <div className="flex -space-x-2" aria-label="Collaborators">
      {visible.map((member) => (
        <div
          key={member.userId}
          aria-label={member.name}
          className="flex h-7 w-7 items-center justify-center rounded-full border border-app-surface bg-app-surface-muted text-[11px] font-bold text-app-ink"
        >
          {member.imageUrl ? <img src={member.imageUrl} alt="" className="h-full w-full rounded-full object-cover" /> : initials(member.name)}
        </div>
      ))}
      {overflow > 0 ? (
        <div className="flex h-7 w-7 items-center justify-center rounded-full border border-app-surface bg-app-ink text-[10px] font-bold text-app-surface">
          +{overflow}
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Implement management panel**

Create `src/components/FolderCollaborationPanel.tsx` with:

- email input
- invite button (calls `createInvite`; owner must be encryption-unlocked so the key grant can be created)
- accepted members list (from `listMembers`)
- pending invite list (from `listMembers`, filtered by status)
- revoke button for pending invites (`revokeInvite`)
- remove button for accepted collaborators (`removeCollaborator`)
- **key fingerprint display** when creating a grant for a new member (show `getPublicKeyFingerprint(bundle.publicKey)` so the owner can optionally verify out-of-band)

**New-user "grant pending" state** — handle the case where an invited user has no public key bundle yet (they haven't set up Omanote encryption):

When the owner calls `createInvite` and `getCollaboratorPublicKey` returns `null`:
- Create the invite row (email token)
- Do NOT call `grantFolderKey` yet (no public key to wrap for)
- In the pending invite list, show a "Waiting for invitee to set up encryption" badge

When the invitee later sets up encryption:
- `savePublicKeyBundle` is called on their device
- Their entry in `userPublicKeyBundles` now exists with `emailLower` set
- The owner's panel should poll / re-query `getCollaboratorPublicKey(email)` for pending invites on each open
- When the query returns a bundle, show a **"Finalize access"** button next to that invite
- On click: fetch the invitee's public key, wrap the folder key, call `grantFolderKey`
- After `grantFolderKey` succeeds the invitee can accept their pending invite normally

On the invitee side, if `acceptInvite` throws "Folder key grant is not ready":
- Show: "Almost there — the folder owner needs to finalize your access. Ask them to open the folder's sharing settings."
- Do not show an error state; this is an expected intermediate state.

Use `api.collaboration.listMembers`, `createInvite`, `revokeInvite`, `removeCollaborator`, `grantFolderKey`, and `getCollaboratorPublicKey`.

- [ ] **Step 5: Run tests and typecheck**

Run: `npm test -- src/components/CollaboratorAvatarStack.test.tsx`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add src/components/CollaboratorAvatarStack.tsx src/components/CollaboratorAvatarStack.test.tsx src/components/FolderCollaborationPanel.tsx src/components/ShareNoteFolderModal.tsx src/components/ShareFolderModal.tsx
git commit -m "feat: add collaborator management UI"
```

Expected: commit succeeds.

---

### Task 10B: Real-Time Presence — "User is editing" Indicators

**Files:**
- Modify: `convex/schema.ts`
- Modify: `convex/collaboration.ts`
- Modify: `convex/collaborationCleanup.ts`
- Create: `src/hooks/usePresenceHeartbeat.ts`
- Create: `src/hooks/usePresenceHeartbeat.test.ts`
- Modify: `src/app/AppProvider.tsx`
- Modify: `src/components/NoteInlineEditor.tsx`
- Modify: `src/components/cards.tsx`
- Test: `convex/collaboration.test.ts`

**Goal:** Show a "User A is editing" badge on note/bookmark cards and a conflict-warning banner inside the editor when another collaborator has the same item open. No CRDTs, no cursors — pure presence metadata, no encryption concerns.

---

- [ ] **Step 1: Add presence table to schema**

In `convex/schema.ts`, add after the `collaborativeContentHistory` table:

```ts
  collaborativePresence: defineTable({
    collaborativeFolderId: v.id("collaborativeFolders"),
    itemId: v.string(),
    itemKind: v.union(v.literal("note"), v.literal("bookmark")),
    userId: v.string(),
    actorNameSnapshot: v.string(),
    actorImageUrlSnapshot: v.optional(v.string()),
    lastSeenAt: v.number(),
  })
    .index("by_collaborativeFolderId_itemId", ["collaborativeFolderId", "itemId"])
    .index("by_userId", ["userId"])
    .index("by_lastSeenAt", ["lastSeenAt"]),
```

Run: `npx convex codegen`

Expected: PASS.

---

- [ ] **Step 2: Add failing presence tests**

Add to `convex/collaboration.test.ts`:

```ts
describe("collaborative presence", () => {
  it("upserts a presence row and filters self from listPresenceForFolder", async () => {
    const fixture = await createAcceptedNoteFolderInviteFixture();
    const noteId = await fixture.asOwner.mutation(api.notes.createNote, {
      body: "enc", tags: [], folderId: fixture.folderId, folderName: "enc-shared",
      collaborativeFolderId: fixture.collaborativeFolderId, createdDateKey: "2026-06-04",
    });

    await fixture.asOwner.mutation(api.collaboration.upsertPresence, {
      collaborativeFolderId: fixture.collaborativeFolderId,
      itemId: String(noteId),
      itemKind: "note",
    });

    // Owner does not see themselves.
    const ownerView = await fixture.asOwner.query(api.collaboration.listPresenceForFolder, {
      collaborativeFolderId: fixture.collaborativeFolderId,
    });
    expect(ownerView).toHaveLength(0);

    // Invitee sees the owner's presence.
    const inviteeView = await fixture.asInvitee.query(api.collaboration.listPresenceForFolder, {
      collaborativeFolderId: fixture.collaborativeFolderId,
    });
    expect(inviteeView).toHaveLength(1);
    expect(inviteeView[0].itemId).toBe(String(noteId));
  });

  it("clearPresence removes the row immediately", async () => {
    const fixture = await createAcceptedNoteFolderInviteFixture();
    const noteId = await fixture.asOwner.mutation(api.notes.createNote, {
      body: "enc", tags: [], folderId: fixture.folderId, folderName: "enc-shared",
      collaborativeFolderId: fixture.collaborativeFolderId, createdDateKey: "2026-06-04",
    });

    await fixture.asOwner.mutation(api.collaboration.upsertPresence, {
      collaborativeFolderId: fixture.collaborativeFolderId,
      itemId: String(noteId),
      itemKind: "note",
    });
    await fixture.asOwner.mutation(api.collaboration.clearPresence, {
      collaborativeFolderId: fixture.collaborativeFolderId,
      itemId: String(noteId),
    });

    const inviteeView = await fixture.asInvitee.query(api.collaboration.listPresenceForFolder, {
      collaborativeFolderId: fixture.collaborativeFolderId,
    });
    expect(inviteeView).toHaveLength(0);
  });

  it("non-member cannot upsert or read presence", async () => {
    const fixture = await createAcceptedNoteFolderInviteFixture();
    const outsider = fixture.t.withIdentity({ tokenIdentifier: "outsider", email: "out@example.com", name: "Out" });

    await expect(outsider.mutation(api.collaboration.upsertPresence, {
      collaborativeFolderId: fixture.collaborativeFolderId,
      itemId: "note_1",
      itemKind: "note",
    })).rejects.toThrow("Folder not found");

    await expect(outsider.query(api.collaboration.listPresenceForFolder, {
      collaborativeFolderId: fixture.collaborativeFolderId,
    })).rejects.toThrow("Folder not found");
  });
});
```

Run: `npm test -- convex/collaboration.test.ts`

Expected: FAIL because `upsertPresence`, `clearPresence`, `listPresenceForFolder` are missing.

---

- [ ] **Step 3: Implement presence mutations and query**

Add to `convex/collaboration.ts`:

```ts
export const upsertPresence = mutation({
  args: {
    collaborativeFolderId: v.id("collaborativeFolders"),
    itemId: v.string(),
    itemKind: v.union(v.literal("note"), v.literal("bookmark")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    await requireActiveCollaborator(ctx, { collaborativeFolderId: args.collaborativeFolderId, userId });

    const existing = await ctx.db
      .query("collaborativePresence")
      .withIndex("by_collaborativeFolderId_itemId", (q) =>
        q.eq("collaborativeFolderId", args.collaborativeFolderId).eq("itemId", args.itemId),
      )
      .filter((q) => q.eq(q.field("userId"), userId))
      .first();

    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { lastSeenAt: now });
    } else {
      await ctx.db.insert("collaborativePresence", {
        ...args,
        userId,
        actorNameSnapshot: identity!.name ?? identity!.email ?? "Someone",
        actorImageUrlSnapshot: identity!.pictureUrl ?? undefined,
        lastSeenAt: now,
      });
    }
  },
});

export const clearPresence = mutation({
  args: {
    collaborativeFolderId: v.id("collaborativeFolders"),
    itemId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    const row = await ctx.db
      .query("collaborativePresence")
      .withIndex("by_collaborativeFolderId_itemId", (q) =>
        q.eq("collaborativeFolderId", args.collaborativeFolderId).eq("itemId", args.itemId),
      )
      .filter((q) => q.eq(q.field("userId"), userId))
      .first();
    if (row) await ctx.db.delete(row._id);
  },
});

export const listPresenceForFolder = query({
  args: { collaborativeFolderId: v.id("collaborativeFolders") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    await requireActiveCollaborator(ctx, { collaborativeFolderId: args.collaborativeFolderId, userId });

    const staleThreshold = Date.now() - 60_000;
    const rows = await ctx.db
      .query("collaborativePresence")
      .withIndex("by_collaborativeFolderId_itemId", (q) =>
        q.eq("collaborativeFolderId", args.collaborativeFolderId),
      )
      .collect();

    // Exclude self and stale rows.
    return rows.filter((r) => r.userId !== userId && r.lastSeenAt > staleThreshold);
  },
});
```

---

- [ ] **Step 4: Add stale presence cleanup to collaborationCleanup.ts**

Add to `convex/collaborationCleanup.ts`:

```ts
export const purgeStalePresence = internalMutation({
  args: {},
  handler: async (ctx) => {
    const stale = await ctx.db
      .query("collaborativePresence")
      .withIndex("by_lastSeenAt", (q) => q.lt("lastSeenAt", Date.now() - 120_000))
      .take(200);
    await Promise.all(stale.map((r) => ctx.db.delete(r._id)));
    return { deleted: stale.length };
  },
});
```

Add to the existing cron export:

```ts
crons.interval("purge stale presence", { minutes: 2 }, internal.collaborationCleanup.purgeStalePresence, {});
```

---

- [ ] **Step 5: Create usePresenceHeartbeat hook**

Create `src/hooks/usePresenceHeartbeat.ts`:

```ts
import { useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

const HEARTBEAT_INTERVAL_MS = 15_000;

export function usePresenceHeartbeat(
  collaborativeFolderId: Id<"collaborativeFolders"> | undefined,
  itemId: string | undefined,
  itemKind: "note" | "bookmark",
) {
  const upsert = useMutation(api.collaboration.upsertPresence);
  const clear = useMutation(api.collaboration.clearPresence);

  useEffect(() => {
    if (!collaborativeFolderId || !itemId) return;

    // Fire immediately on mount (editor opened).
    void upsert({ collaborativeFolderId, itemId, itemKind });

    const interval = setInterval(() => {
      void upsert({ collaborativeFolderId, itemId, itemKind });
    }, HEARTBEAT_INTERVAL_MS);

    return () => {
      clearInterval(interval);
      // Best-effort clear — if this fails (e.g. network gone) the 2-min
      // scheduled cleanup will remove the stale row.
      void clear({ collaborativeFolderId, itemId });
    };
  }, [collaborativeFolderId, itemId, itemKind]);
}
```

Create `src/hooks/usePresenceHeartbeat.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { usePresenceHeartbeat } from "./usePresenceHeartbeat";

const mockUpsert = vi.fn();
const mockClear = vi.fn();

vi.mock("convex/react", () => ({
  useMutation: (fn: unknown) => fn === "upsert" ? mockUpsert : mockClear,
}));

describe("usePresenceHeartbeat", () => {
  beforeEach(() => { vi.useFakeTimers(); mockUpsert.mockResolvedValue(undefined); mockClear.mockResolvedValue(undefined); });
  afterEach(() => { vi.useRealTimers(); });

  it("fires upsert on mount and on interval", () => {
    renderHook(() => usePresenceHeartbeat("cf_1" as any, "note_1", "note"));
    expect(mockUpsert).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(15_000);
    expect(mockUpsert).toHaveBeenCalledTimes(2);
  });

  it("calls clear on unmount", () => {
    const { unmount } = renderHook(() => usePresenceHeartbeat("cf_1" as any, "note_1", "note"));
    unmount();
    expect(mockClear).toHaveBeenCalledWith({ collaborativeFolderId: "cf_1", itemId: "note_1" });
  });

  it("does nothing when collaborativeFolderId is undefined", () => {
    renderHook(() => usePresenceHeartbeat(undefined, "note_1", "note"));
    expect(mockUpsert).not.toHaveBeenCalled();
  });
});
```

---

- [ ] **Step 6: Wire presence subscription in AppProvider**

In `src/app/AppProvider.tsx`, subscribe to presence for each active collaborative folder the user has open. Build a map from `itemId → editor list` and expose it through context:

```ts
// Fetch presence for the currently active collaborative folder only
// (not all folders — no need to subscribe to presence you're not viewing).
const activePresence = useQuery(
  api.collaboration.listPresenceForFolder,
  activeCollaborativeFolderId
    ? { collaborativeFolderId: activeCollaborativeFolderId }
    : "skip",
);

// Map itemId → array of active editors (excluding self, excluding stale).
const presenceByItemId = useMemo(() => {
  const map = new Map<string, typeof activePresence>();
  for (const row of activePresence ?? []) {
    const existing = map.get(row.itemId) ?? [];
    map.set(row.itemId, [...existing, row]);
  }
  return map;
}, [activePresence]);
```

Expose `presenceByItemId` through the app context alongside `decryptedNotes` and `decryptedBookmarks`.

---

- [ ] **Step 7: Add heartbeat to NoteInlineEditor and conflict banner**

In `src/components/NoteInlineEditor.tsx`, call the hook when a collaborative note is open:

```ts
usePresenceHeartbeat(
  note.collaborativeFolderId,
  note._id,
  "note",
);
```

Add a conflict-warning banner at the top of the editor when others are present on the same item:

```tsx
const editors = presenceByItemId.get(note._id) ?? [];
{editors.length > 0 && (
  <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
    <span>⚠️</span>
    <span>
      {editors.map((e) => e.actorNameSnapshot).join(", ")}
      {editors.length === 1 ? " is" : " are"} also editing this note.
      Last save wins — check with them before saving.
    </span>
  </div>
)}
```

---

- [ ] **Step 8: Add "is editing" badge to note and bookmark cards**

In `src/components/cards.tsx`, for collaborative items, show a compact badge when another editor is present:

```tsx
const editors = presenceByItemId?.get(item._id) ?? [];
{editors.length > 0 && (
  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
    {editors[0].actorNameSnapshot} is editing
    {editors.length > 1 ? ` +${editors.length - 1}` : ""}
  </span>
)}
```

---

- [ ] **Step 9: Run all tests and typecheck**

Run: `npm test -- convex/collaboration.test.ts src/hooks/usePresenceHeartbeat.test.ts`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

---

- [ ] **Step 10: Commit**

Run:

```bash
git add convex/schema.ts convex/collaboration.ts convex/collaborationCleanup.ts convex/_generated src/hooks/usePresenceHeartbeat.ts src/hooks/usePresenceHeartbeat.test.ts src/app/AppProvider.tsx src/components/NoteInlineEditor.tsx src/components/cards.tsx
git commit -m "feat: real-time presence indicators for collaborative editing"
```

Expected: commit succeeds.

---

### Task 11: Shared Indicators and Attribution

**Files:**
- Modify: `src/screens/NotesScreen.tsx`
- Modify: `src/screens/BookmarksScreen.tsx`
- Modify: `src/components/NoteFolderNav.tsx`
- Modify: `src/components/BookmarkCategoryNav.tsx`
- Modify: `src/components/cards.tsx`
- Modify: `src/components/NoteInlineEditor.tsx`

- [ ] **Step 1: Add focused rendering tests**

Update existing Notes/Bookmarks tests to assert:

```ts
expect(screen.getByLabelText("Collaborators")).toBeInTheDocument();
expect(screen.getByText(/Added by/i)).toBeInTheDocument();
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- src/screens/NotesScreen.test.tsx src/screens/BookmarksScreen.test.tsx`

Expected: FAIL because indicators are missing.

- [ ] **Step 3: Render shared indicators**

Use `CollaboratorAvatarStack` in folder nav rows and selected-folder headers when `collaborativeFolderId` or collaboration metadata exists.

Show author metadata on collaborative content:

```tsx
{item.createdByName ? <span className="text-xs text-app-ink-muted">Added by {item.createdByName}</span> : null}
```

Use the existing text scale in compact cards; avoid adding a large new card or nested card surface.

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test -- src/screens/NotesScreen.test.tsx src/screens/BookmarksScreen.test.tsx`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/screens/NotesScreen.tsx src/screens/BookmarksScreen.tsx src/components/NoteFolderNav.tsx src/components/BookmarkCategoryNav.tsx src/components
git commit -m "feat: show shared folder indicators"
```

Expected: commit succeeds.

---

### Task 12: History and Undo

**Files:**
- Modify: `convex/collaboration.ts`
- Modify: `convex/notes.ts`
- Modify: `convex/bookmarks.ts`
- Modify: `src/components/cards.tsx`
- Modify: `src/app/AppProvider.tsx`
- Test: `convex/collaboration.test.ts`

- [ ] **Step 1: Add history tests**

Add these tests to `convex/collaboration.test.ts`:

```ts
it("stores encrypted history before editing a collaborative note", async () => {
  const fixture = await createAcceptedNoteFolderInviteFixture();
  const noteId = await fixture.asInvitee.mutation(api.notes.createNote, {
    body: "encrypted original",
    tags: [],
    folderId: fixture.folderId,
    folderName: "encrypted-shared",
    collaborativeFolderId: fixture.collaborativeFolderId,
    createdDateKey: "2026-06-04",
  });
  await fixture.asInvitee.mutation(api.notes.updateNote, {
    noteId,
    body: "encrypted edited",
    tags: [],
    collaborativeFolderId: fixture.collaborativeFolderId,
    encryptedHistorySnapshot: "encrypted original snapshot",
  });
  const history = await fixture.asInvitee.query(api.collaboration.listHistoryForItem, {
    collaborativeFolderId: fixture.collaborativeFolderId,
    itemKind: "note",
    itemId: String(noteId),
  });
  expect(history[0]).toMatchObject({ encryptedSnapshot: "encrypted original snapshot", action: "edited" });
});

it("restores a deleted collaborative bookmark from history", async () => {
  const fixture = await createAcceptedBookmarkFolderInviteFixture();
  const bookmarkId = await fixture.asInvitee.mutation(api.bookmarks.createBookmark, {
    categoryId: fixture.categoryId,
    collaborativeFolderId: fixture.collaborativeFolderId,
    createdDateKey: "2026-06-04",
    url: "encrypted-url",
    title: "encrypted-title",
  });
  await fixture.asInvitee.mutation(api.bookmarks.deleteBookmark, {
    bookmarkId,
    collaborativeFolderId: fixture.collaborativeFolderId,
    encryptedHistorySnapshot: JSON.stringify({ url: "encrypted-url", title: "encrypted-title" }),
  });
  await fixture.asInvitee.mutation(api.collaboration.restoreLatestHistory, {
    collaborativeFolderId: fixture.collaborativeFolderId,
    itemKind: "bookmark",
    itemId: String(bookmarkId),
  });
  const bookmarks = await fixture.asInvitee.query(api.bookmarks.listBookmarks, {
    categoryId: fixture.categoryId,
    limit: 20,
  });
  expect(bookmarks.some((bookmark) => bookmark._id === bookmarkId && !bookmark.deletedAt)).toBe(true);
});

it("does not let removed collaborators restore history", async () => {
  const fixture = await createAcceptedNoteFolderInviteFixture();
  await fixture.asOwner.mutation(api.collaboration.removeCollaborator, {
    collaborativeFolderId: fixture.collaborativeFolderId,
    userId: "fixture-invitee",
  });
  await expect(
    fixture.asInvitee.mutation(api.collaboration.restoreLatestHistory, {
      collaborativeFolderId: fixture.collaborativeFolderId,
      itemKind: "note",
      itemId: "note_1",
    }),
  ).rejects.toThrow("Folder not found");
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- convex/collaboration.test.ts`

Expected: FAIL because history APIs are missing.

- [ ] **Step 3: Add history write helper**

In `convex/collaboration.ts`, import `type MutationCtx` and `type Id`, then add this helper:

```ts
async function recordCollaborativeHistory(ctx: MutationCtx, args: {
  collaborativeFolderId: Id<"collaborativeFolders">;
  itemKind: "note" | "bookmark";
  itemId: string;
  action: "created" | "edited" | "deleted" | "restored";
  actorUserId: string;
  actorNameSnapshot: string;
  actorImageUrlSnapshot?: string;
  encryptedSnapshot?: string;
}) {
  const now = Date.now();
  await ctx.db.insert("collaborativeContentHistory", {
    ...args,
    createdAt: now,
    expiresAt: now + 1000 * 60 * 60 * 24 * 7,
  });
}
```

- [ ] **Step 4: Record snapshots on edit/delete**

In the `updateNote` and `deleteNote` collaborative paths (and their bookmark equivalents), add an `encryptedHistorySnapshot` argument and record history before patching:

```ts
// Client encrypts the CURRENT state of the item with the folder key before
// overwriting. The snapshot is an opaque ciphertext string — Convex stores
// it without parsing it.
// Format: encryptedSnapshot is the result of:
//   encryptString(JSON.stringify({ body, title, tags }), folderKey)
// for notes, and:
//   encryptString(JSON.stringify({ url, title, siteName, description }), folderKey)
// for bookmarks.
// The server never sees field names or values inside the blob.
```

Add `encryptedHistorySnapshot: v.optional(v.string())` to `updateNote`, `deleteNote`, `updateBookmark`, `deleteBookmark` mutation args. If provided and the item is collaborative, call `recordCollaborativeHistory` with that value as `encryptedSnapshot`.

- [ ] **Step 5: Add restore mutation**

Add `restoreLatestHistory` mutation in `convex/collaboration.ts`:

```ts
export const restoreLatestHistory = mutation({
  args: {
    collaborativeFolderId: v.id("collaborativeFolders"),
    itemKind: v.union(v.literal("note"), v.literal("bookmark")),
    itemId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    await requireActiveCollaborator(ctx, { collaborativeFolderId: args.collaborativeFolderId, userId });

    const row = await ctx.db
      .query("collaborativeContentHistory")
      .withIndex("by_itemKind_itemId_createdAt", (q) =>
        q.eq("itemKind", args.itemKind).eq("itemId", args.itemId),
      )
      .order("desc")
      .first();

    if (!row || !row.encryptedSnapshot || row.expiresAt < Date.now()) {
      throw new Error("No restorable snapshot found");
    }

    // The snapshot is an opaque encrypted blob. Restore it as the item's
    // primary encrypted content field — the client decrypts and re-renders.
    // For notes: patch `body` with the snapshot blob (client knows to
    // treat it as JSON.stringified { body, title, tags } after decrypt).
    // For bookmarks: patch `url` with the snapshot blob.
    // The client is responsible for splitting the decrypted JSON back into
    // individual fields and calling updateNote/updateBookmark with them.
    // The server only performs the soft-undelete (clear deletedAt).
    if (args.itemKind === "note") {
      const docId = args.itemId as Id<"notes">;
      await ctx.db.patch(docId, { deletedAt: undefined, body: row.encryptedSnapshot, updatedByUserId: userId, updatedAt: Date.now() });
    } else {
      const docId = args.itemId as Id<"bookmarks">;
      await ctx.db.patch(docId, { deletedAt: undefined, url: row.encryptedSnapshot, updatedByUserId: userId, updatedAt: Date.now() });
    }

    await recordCollaborativeHistory(ctx, {
      collaborativeFolderId: args.collaborativeFolderId,
      itemKind: args.itemKind,
      itemId: args.itemId,
      action: "restored",
      actorUserId: userId,
      actorNameSnapshot: identity!.name ?? identity!.email ?? "User",
    });
  },
});
```

**Restore UX**: after `restoreLatestHistory` resolves, the client re-fetches the item. It sees a single encrypted blob in `body`/`url`. It decrypts that blob with the folder key, `JSON.parse`s the result into `{ body, title, tags }` (or bookmark fields), and immediately calls `updateNote`/`updateBookmark` with `isFinalBatch: true` equivalent to re-save the individual fields correctly. This two-step approach keeps the server clean while letting the client handle field parsing.

- [ ] **Step 6: Run tests and typecheck**

Run: `npm test -- convex/collaboration.test.ts`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```bash
git add convex/collaboration.ts convex/notes.ts convex/bookmarks.ts convex/collaboration.test.ts
git commit -m "feat: add collaborative history undo"
```

Expected: commit succeeds.

---

### Task 13: Scheduled History Cleanup

**Files:**
- Create: `convex/collaborationCleanup.ts`
- Test: `convex/collaborationCleanup.test.ts`

- [ ] **Step 1: Write failing cleanup test**

Create `convex/collaborationCleanup.test.ts`:

```ts
// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import modules from "./_generated/modules";

describe("history cleanup", () => {
  it("deletes history rows whose expiresAt is in the past", async () => {
    const t = convexTest(schema, modules);
    const asOwner = t.withIdentity({ tokenIdentifier: "cleanup-owner", email: "owner@example.com", name: "Owner" });
    const folderId = await asOwner.mutation(api.notes.createNoteFolder, { name: "CF" });
    const collaborativeFolderId = await asOwner.mutation(api.collaboration.enableNoteFolderCollaboration, {
      folderId,
      folderName: "encrypted-cf",
      wrappedOwnerFolderKey: "key",
      wrapAlgorithm: "test",
      items: [],
      isFinalBatch: true,
    });
    // Insert an already-expired history row directly.
    await t.run(async (ctx) => {
      await ctx.db.insert("collaborativeContentHistory", {
        collaborativeFolderId,
        itemKind: "note",
        itemId: "note_expired",
        action: "edited",
        actorUserId: "cleanup-owner",
        actorNameSnapshot: "Owner",
        encryptedSnapshot: "enc:v1:stub",
        createdAt: Date.now() - 1000 * 60 * 60 * 24 * 8,
        expiresAt: Date.now() - 1,
      });
    });
    await asOwner.mutation(api.collaborationCleanup.purgeExpiredHistory, {});
    const history = await asOwner.query(api.collaboration.listHistoryForItem, {
      collaborativeFolderId,
      itemKind: "note",
      itemId: "note_expired",
    });
    expect(history).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -- convex/collaborationCleanup.test.ts`

Expected: FAIL because `purgeExpiredHistory` is missing.

- [ ] **Step 3: Implement cleanup mutation and cron**

Create `convex/collaborationCleanup.ts`:

```ts
import { cronJobs } from "convex/server";
import { mutation } from "./_generated/server";
import { internal } from "./_generated/api";

export const purgeExpiredHistory = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const expired = await ctx.db
      .query("collaborativeContentHistory")
      .withIndex("by_expiresAt", (q) => q.lt("expiresAt", now))
      .take(200);
    await Promise.all(expired.map((row) => ctx.db.delete(row._id)));
    return { deleted: expired.length };
  },
});

const crons = cronJobs();
crons.daily("purge expired collaboration history", { hourUTC: 3, minuteUTC: 0 }, internal.collaborationCleanup.purgeExpiredHistory, {});
export default crons;
```

Make `purgeExpiredHistory` an internal mutation and call it from the cron. Adjust the import to use `internalMutation` from `./_generated/server` and export the cron as default.

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test -- convex/collaborationCleanup.test.ts`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add convex/collaborationCleanup.ts convex/collaborationCleanup.test.ts
git commit -m "feat: schedule daily cleanup of expired collaboration history"
```

Expected: commit succeeds.

---

### Task 14: Disable Collaboration

**Files:**
- Modify: `convex/collaboration.ts`
- Modify: `src/components/FolderCollaborationPanel.tsx`
- Test: `convex/collaboration.test.ts`

This provides the reverse of enable-collaboration: re-encrypts folder content with the owner's personal key and marks the collaborative folder disabled. Without this, owners have no way to leave the collaboration model.

- [ ] **Step 1: Add backend disable mutation**

Add to `convex/collaboration.ts`:

```ts
// disableCollaboration follows the same batching protocol as enableCollaboration.
//
// Call sequence (client-side):
//   batch 1 … N (isFinalBatch: false) — re-encrypt items with personal key.
//   final call  (isFinalBatch: true, items: []) — revoke grants, remove members,
//               clear mutex, mark disabled.
//
// Can also be called on a folder that is still "converting" (partial conversion
// was abandoned). In that case only items that were already converted
// (encryptionDomain === "collaborative") need to be in the items list.
// Personal-domain items can be omitted — they are unaffected by disable.
//
// EXIT PLAN: if the owner's app crashes during disable, some items may be
// re-encrypted (personal) while others are still collaborative-encrypted.
// The owner's key resolver handles this correctly because each item's
// encryptionDomain field still matches which key was used. Re-running disable
// with the remaining collaborative items will finish the job cleanly.

export const disableCollaboration = mutation({
  args: {
    collaborativeFolderId: v.id("collaborativeFolders"),
    // Items re-encrypted with the owner's personal content key by the client.
    // Pass up to 50 per call; omit personal-domain items entirely.
    items: v.array(
      v.object({
        kind: v.union(v.literal("note"), v.literal("bookmark")),
        id: v.string(),
        encryptedFields: v.record(v.string(), v.string()),
      }),
    ),
    isFinalBatch: v.boolean(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const userId = requireUserId(identity);
    const folder = await ctx.db.get(args.collaborativeFolderId);
    // Allow "converting" as well — owner may want to abort a mid-conversion.
    if (!folder || folder.ownerUserId !== userId || folder.status === "disabled") throw new Error("Folder not found");

    if (args.items.length > 50) throw new Error("Disable at most 50 items per call");

    const now = Date.now();
    // Patch each item back to the personal encryption domain.
    for (const item of args.items) {
      const docId = item.id as Id<"notes"> | Id<"bookmarks">;
      await ctx.db.patch(docId, {
        ...item.encryptedFields,
        encryptionDomain: "personal",
        collaborativeFolderId: undefined,
        updatedByUserId: undefined,
        updatedAt: now,
      });
    }

    if (!args.isFinalBatch) return;

    // ── Final cleanup (runs once, after all item batches) ─────────────────
    // Revoke all key grants so collaborators lose crypto access immediately.
    const grants = await ctx.db
      .query("folderKeyGrants")
      .withIndex("by_collaborativeFolderId_userId", (q) => q.eq("collaborativeFolderId", args.collaborativeFolderId))
      .collect();
    await Promise.all(grants.filter((g) => !g.revokedAt).map((g) => ctx.db.patch(g._id, { revokedAt: now })));
    // Mark all collaborators removed.
    const members = await ctx.db
      .query("folderCollaborators")
      .withIndex("by_collaborativeFolderId_removedAt", (q) =>
        q.eq("collaborativeFolderId", args.collaborativeFolderId).eq("removedAt", undefined),
      )
      .collect();
    await Promise.all(members.map((m) => ctx.db.patch(m._id, { removedAt: now, updatedAt: now })));
    // Clear the OCC mutex field on the source folder.
    if (folder.folderKind === "note_folder") {
      await ctx.db.patch(folder.folderId as Id<"noteFolders">, { collaborativeFolderId: undefined, updatedAt: now });
    } else {
      await ctx.db.patch(folder.folderId as Id<"bookmarkCategories">, { collaborativeFolderId: undefined, updatedAt: now });
    }
    await ctx.db.patch(args.collaborativeFolderId, { status: "disabled", updatedAt: now });
  },
});
```

- [ ] **Step 2: Add disable test**

Add to `convex/collaboration.test.ts`:

```ts
it("disables collaboration and restores personal encryption domain", async () => {
  const fixture = await createAcceptedNoteFolderInviteFixture();
  const noteId = await fixture.asOwner.mutation(api.notes.createNote, {
    body: "encrypted-collab-body",
    tags: [],
    folderId: fixture.folderId,
    folderName: "encrypted-shared",
    collaborativeFolderId: fixture.collaborativeFolderId,
    createdDateKey: "2026-06-04",
  });

  await fixture.asOwner.mutation(api.collaboration.disableCollaboration, {
    collaborativeFolderId: fixture.collaborativeFolderId,
    items: [{ kind: "note", id: String(noteId), encryptedFields: { body: "enc:v1:personal-re-encrypted" } }],
    isFinalBatch: true,
  });

  const note = await fixture.asOwner.query(api.notes.getNote, { noteId });
  expect(note?.encryptionDomain).toBe("personal");
  expect(note?.collaborativeFolderId).toBeUndefined();
  // Removed collaborator can no longer list members.
  await expect(
    fixture.asInvitee.query(api.collaboration.listMembers, { collaborativeFolderId: fixture.collaborativeFolderId }),
  ).rejects.toThrow("Folder not found");
});
```

- [ ] **Step 3: Add frontend disable button**

In `FolderCollaborationPanel.tsx`, add a "Turn off collaboration" button visible only to the owner:

- Show a confirmation dialog: "All collaborators will immediately lose access. Your content will be re-encrypted with your personal key. This cannot be undone while offline."
- On confirm:
  1. Gather all items in the folder that have `encryptionDomain === "collaborative"` from app state (skip personal items — they need no re-encryption).
  2. Decrypt each item with the folder key, then re-encrypt with the owner's personal content key.
  3. Split into batches of ≤ 50.
  4. Call `api.collaboration.disableCollaboration` for each batch with `isFinalBatch: false`.
  5. On the last batch, set `isFinalBatch: true` to trigger grant revocation and membership cleanup.
  6. If any batch fails, show "Revert paused — tap Resume to continue." The folder key is still valid for any remaining unconverted items, so resuming is always safe.
  7. **Exit guarantee**: because each item's `encryptionDomain` is the ground truth, a crash mid-disable leaves each item in a deterministically correct state. On next app load, the key resolver decrypts each item with whichever key its `encryptionDomain` indicates. The owner re-runs the disable flow starting from the first item that still has `encryptionDomain === "collaborative"`.

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test -- convex/collaboration.test.ts`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add convex/collaboration.ts convex/collaboration.test.ts src/components/FolderCollaborationPanel.tsx
git commit -m "feat: disable collaboration and restore personal encryption"
```

Expected: commit succeeds.

---

### Task 15: Final Verification and Documentation

**Files:**
- Modify: `docs/folder-collaboration.md`
- Modify: `docs/encryption.md`

- [ ] **Step 1: Update documentation**

Update `docs/folder-collaboration.md` to point to the implemented design and summarize:

- private collaboration is separate from public sharing
- shared folder content uses a folder key (AES-GCM-256)
- folder keys are distributed via ECDH P-256 key grants (ECIES scheme)
- each member has a wrapped key grant stored in `folderKeyGrants`
- v1 removal does not rotate the folder key — warn users in the UI when removing a collaborator
- collaboration can be disabled by the owner, which re-encrypts content with the personal key
- history is retained for 7 days and cleaned up nightly

Update `docs/encryption.md` encrypted fields section with collaborative encryption domain notes.

- [ ] **Step 2: Run full verification**

Run: `npm test`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

- [ ] **Step 3: Manual safety check**

In a local dev session:

1. Create two note folders and two bookmark folders.
2. Add at least one item to each.
3. Enable collaboration on one note folder.
4. Verify the unrelated note folder still decrypts.
5. Verify both bookmark folders still decrypt.
6. Enable collaboration on one bookmark folder.
7. Verify the unrelated bookmark folder still decrypts.
8. Invite a second account. Verify the key fingerprint is displayed in the UI.
9. Accept invite and edit one shared item.
10. Verify owner sees edited item with collaborator attribution.
11. Attempt to invite a 6th collaborator — verify it is rejected with a clear error.
12. Remove collaborator. Verify the UI warns that the removed user may still have a cached key.
13. Verify removed collaborator no longer sees the shared folder after refresh.
14. As owner, disable collaboration on the note folder. Verify it re-encrypts and returns to personal mode.
15. Verify the previously collaborative items are still readable with the personal key.

- [ ] **Step 4: Commit docs**

Run:

```bash
git add docs/folder-collaboration.md docs/encryption.md
git commit -m "docs: document folder collaboration encryption"
```

Expected: commit succeeds.
