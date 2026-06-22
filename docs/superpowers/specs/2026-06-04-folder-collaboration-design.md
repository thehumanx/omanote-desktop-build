# Folder Collaboration Design

Date: 2026-06-04
Status: Approved for implementation planning

## Goal

Add private editable collaboration for note folders and bookmark folders.

An owner can invite another Omanote user by email. The invited user can view, add, edit, and delete folder contents after accepting the invite. They cannot delete the folder itself or manage collaborators. Collaboration is separate from existing public share pages, which remain read-only public snapshots.

The design must preserve Omanote's client-side encryption model and avoid the previous failure mode where shared-folder encryption affected unrelated personal notes or bookmarks.

## Non-Goals

- No public editable links.
- No team or workspace model.
- No strict v1 cryptographic revocation by folder-key rotation after collaborator removal.
- No real-time multi-cursor editing.
- No server-readable shared folder content.
- No in-app invite notifications in v1, though the data model should leave room for them later.

## Core Safety Rule

Personal encryption and collaborative encryption are separate domains.

```text
Personal content -> user's normal content key
Collaborative folder content -> folder collaboration key
Folder collaboration key -> wrapped once per active member
```

No collaboration operation may replace, rotate, reinterpret, or depend on the user's personal content key. Enabling collaboration for one folder must not change access to unrelated personal notes, bookmarks, folders, or categories.

## Recommended Architecture

Use one canonical collaborative folder and one canonical copy of each shared item.

Each collaborative folder has one folder AES-GCM content key. Shared notes or bookmarks in that folder are encrypted with that folder key. Each member has a key grant containing the same folder key wrapped for that member.

This keeps collaboration state centralized:

- one source of truth for folder contents
- one permission model
- one history stream
- simple author attribution
- no replicated copies that can diverge

## Existing System Context

Omanote currently encrypts protected fields in the browser before writing to Convex. Convex stores ciphertext strings such as `enc:v1:...` and does not receive the user's unwrapped content key.

Current public folder sharing uses owner-pushed plaintext snapshots because public viewers do not have the owner's content key. That approach is acceptable for read-only public pages but must not be reused for private editable collaboration.

## Data Model

### `collaborativeFolders`

One row per folder or category that has been made collaborative.

Fields:

- `folderKind`: `note_folder` or `bookmark_folder`
- `folderId`: id of `noteFolders` or `bookmarkCategories`
- `ownerUserId`
- `status`: `active` or `disabled`
- `createdAt`
- `updatedAt`

Indexes:

- by `folderKind`, `folderId`
- by `ownerUserId`, `status`

### `folderCollaborators`

One row per active or formerly active member.

Fields:

- `collaborativeFolderId`
- `userId`
- `role`: `owner` or `editor`
- `emailSnapshot`
- `nameSnapshot`
- `imageUrlSnapshot`
- `addedByUserId`
- `addedAt`
- `updatedAt`
- `removedAt?`

Indexes:

- by `collaborativeFolderId`, `removedAt`
- by `userId`, `removedAt`
- by `collaborativeFolderId`, `userId`

The owner should also have a collaborator row so member lists and avatar stacks can use one query shape.

### `folderInvites`

Tracks pending, accepted, revoked, and expired email invites.

Fields:

- `collaborativeFolderId`
- `folderKind`
- `folderNameSnapshot`
- `inviteeEmail`
- `inviteeEmailLower`
- `inviteTokenHash`
- `status`: `pending`, `accepted`, `revoked`, or `expired`
- `createdByUserId`
- `createdAt`
- `updatedAt`
- `expiresAt?`
- `acceptedAt?`
- `acceptedByUserId?`
- `revokedAt?`

Indexes:

- by `inviteTokenHash`
- by `collaborativeFolderId`, `status`
- by `inviteeEmailLower`, `status`

Store only a token hash in Convex. The raw invite token appears only in the email URL.

### `folderKeyGrants`

Stores per-user wrapped access to a folder collaboration key.

Fields:

- `collaborativeFolderId`
- `userId`
- `wrappedFolderKey`
- `wrapVersion`: initially `v1`
- `wrapAlgorithm`: initially the app's Web Crypto wrapping algorithm
- `createdByUserId`
- `createdAt`
- `revokedAt?`

Indexes:

- by `collaborativeFolderId`, `userId`
- by `userId`, `revokedAt`

The server never sees the raw folder key. It stores only wrapped key material.

### `userPublicKeyBundles`

Stores public wrapping material that lets another unlocked client wrap a folder key for this user without seeing or changing this user's personal content key.

Fields:

- `userId`
- `publicKey`
- `algorithm`: initially an asymmetric Web Crypto wrapping algorithm chosen during implementation
- `version`: initially `v1`
- `createdAt`
- `rotatedAt?`
- `revokedAt?`

Indexes:

- by `userId`, `revokedAt`

The corresponding private key must be encrypted locally with the user's personal encryption setup. Convex stores only the public key and encrypted/wrapped private-key material if needed for cross-device restore. The public key cannot decrypt content.

### Shared Content Metadata

Existing `notes` and `bookmarks` rows should gain collaboration metadata rather than moving into unrelated account copies.

Potential fields:

- `collaborativeFolderId?`
- `encryptionDomain`: `personal` or `collaborative`
- `createdByUserId?`
- `updatedByUserId?`
- `deletedByUserId?`

For personal rows, the current `userId` ownership behavior remains. For collaborative rows, `userId` can remain the owner id for compatibility, but authorization must check collaboration membership when `collaborativeFolderId` is present.

### `collaborativeContentHistory`

Stores encrypted restorable snapshots for seven days.

Fields:

- `collaborativeFolderId`
- `itemKind`: `note` or `bookmark`
- `itemId`
- `action`: `created`, `edited`, `deleted`, or `restored`
- `actorUserId`
- `actorNameSnapshot`
- `actorImageUrlSnapshot?`
- `encryptedSnapshot?`
- `createdAt`
- `expiresAt`

Indexes:

- by `collaborativeFolderId`, `createdAt`
- by `itemKind`, `itemId`, `createdAt`
- by `expiresAt`

Use full encrypted snapshots for v1. Diffs are smaller but harder to make reliable with encrypted payloads.

## Encryption Flow

### Enabling Collaboration

The owner must be signed in and encryption-unlocked.

1. Client generates a random AES-GCM folder key.
2. Client decrypts the selected folder name and contents with the owner's personal content key.
3. Client re-encrypts only that folder name and contents with the folder key.
4. Client calls a Convex mutation that marks only those rows as collaborative and stores the re-encrypted values.
5. Client wraps the folder key for the owner and stores the owner key grant.
6. Convex creates `collaborativeFolders` and an owner `folderCollaborators` row.

The conversion must be scoped to one folder/category id. No account-wide re-encryption is allowed.

### Inviting a Collaborator

The owner must have access to the folder key. In v1, this means the owner should be encryption-unlocked before creating an invite.

1. Owner enters an email.
2. Server verifies owner access.
3. Server creates or reuses one pending invite for that folder/email pair.
4. Server sends one email with the raw token.
5. Owner can revoke the pending invite before acceptance.

V1 uses per-user public wrapping keys. If the invitee already has a public key bundle, the owner client creates the invitee's key grant immediately while sending the invite. If the invitee does not have a public key bundle yet, the invite remains pending and acceptance first guides them through encryption setup so the owner can retry/finalize the key grant from collaborator settings.

### Accepting an Invite

1. Invitee opens invite link.
2. App requires sign-in if needed.
3. Server verifies invite token hash, pending status, expiry, and signed-in email match.
4. If the invitee has not set up Omanote encryption, the app guides them through setup first.
5. App verifies a wrapped folder key grant exists for the invitee.
6. Server creates an editor collaborator row and marks the invite accepted.
7. The folder appears in the invitee's Notes or Bookmarks surface.

If no key grant exists yet, acceptance shows a clear "waiting for owner to finish sharing access" state instead of exposing an empty or broken folder.

### Reading and Writing Shared Content

The frontend should introduce a narrow key resolver:

```text
personal item -> decrypt with user content key
collaborative item -> find folder key grant, unwrap folder key, decrypt with folder key
```

All create/update/delete paths must choose the encryption domain before encrypting fields. The UI should not directly decide which key to use in scattered locations.

## Authorization

Server-side checks are mandatory.

Owner can:

- invite collaborators
- revoke pending invites
- remove accepted collaborators
- rename the collaborative folder
- delete the collaborative folder
- create/edit/delete contents

Collaborator can:

- view folder contents
- create notes/bookmarks in the folder
- edit notes/bookmarks in the folder
- delete notes/bookmarks in the folder
- restore content where history allows

Collaborator cannot:

- delete the folder
- rename the folder in v1
- invite, revoke, or remove collaborators
- manage public sharing for that folder

Removed collaborators lose server access immediately. V1 does not rotate the folder key or re-encrypt content after removal.

## UI Design

### Folder Settings

Existing public share settings should remain distinct from collaboration.

Add a collaboration section with:

- email input
- invite action
- accepted collaborator list
- pending invite list
- revoke action for pending invites
- remove action for accepted collaborators
- owner marker

Copy should make clear that collaboration is private and editable, unlike public sharing.

### Shared Folder Indicators

Shared folders should show:

- shared/collaborative icon or label
- avatar stack with up to three avatars
- `+x` overflow if more than three members exist

This applies in Notes and Bookmarks folder navigation and selected-folder headers where space allows.

### Content Attribution

Shared content should show who added it.

Use actor metadata:

- avatar or fallback initials
- display name where space allows
- compact timestamp or tooltip where useful

Do not expose collaborator emails in compact content cards unless needed in management UI.

## History and Undo

V1 stores full encrypted snapshots for seven days.

Rules:

- On edit, store the previous encrypted snapshot.
- On delete, store the deleted encrypted snapshot and soft-delete the item.
- On restore/undo, verify current membership and restore from the latest restorable snapshot.
- On create, record activity metadata but no snapshot is required unless undo-create is implemented.
- History contents are encrypted with the folder key.
- Actor metadata is stored outside encryption for display and audit.

Retention can be enforced with a scheduled cleanup mutation or a lazy cleanup path.

## Email

Send one invite email per pending invite.

Email should include:

- inviter name
- folder name snapshot
- note vs bookmark folder type
- accept collaboration link
- note that sign-in is required

Email must not describe the invite as a public link.

## Scalability

The model scales by rows rather than unbounded arrays.

Expected v1 limits:

- collaborator limit per folder: 20
- folder content lists should continue using limits/pagination where needed
- history retained for seven days
- member/avatar queries should fetch only active members needed for display, with management UI able to fetch more

Main resource costs:

- additional member/key/invite/history rows
- client-side decryption of shared folder contents
- extra writes for history snapshots

AES-GCM encryption/decryption is not expected to be the bottleneck. The main risk is frontend complexity, so the key resolver and conversion flow need focused tests.

## Rollout Plan

1. Add schema tables and indexes.
2. Add backend authorization helpers for owner/member checks.
3. Add frontend shared-key resolver and crypto helpers.
4. Implement one-folder enable-collaboration conversion.
5. Add invite creation, email sending, revocation, and acceptance.
6. Add collaborative reads/writes for notes and bookmarks.
7. Add collaborator settings UI and avatar indicators.
8. Add content attribution.
9. Add encrypted seven-day history and undo.
10. Add cleanup for expired invites and expired history.

## Testing Requirements

Backend tests:

- owner can enable collaboration for one note folder
- owner can enable collaboration for one bookmark folder
- enabling collaboration does not alter unrelated personal content rows
- collaborator cannot delete or rename folder
- collaborator can create/edit/delete folder content
- non-member cannot read or write collaborative content
- owner can revoke pending invite
- revoked invite token cannot be accepted
- owner can remove accepted collaborator
- removed collaborator loses server access
- public share state remains separate

Frontend/unit tests:

- key resolver chooses personal key for personal items
- key resolver chooses folder key for collaborative items
- missing folder key produces a clear locked/no-access state
- avatar stack shows three avatars plus overflow
- owner-only collaborator controls are hidden for editors
- shared content shows actor attribution

Safety tests:

- converting a folder to collaboration never rewrites unrelated folders
- converting a note folder never rewrites bookmark data
- converting a bookmark folder never rewrites note data
- failure during conversion leaves enough state to retry or show a clear recovery path

## Key-Grant Decision

V1 should add per-user public wrapping keys instead of requiring the owner to be online at the moment an invitee accepts.

This is more implementation work, but it gives the cleanest product flow:

- owner can invite a user who already has Omanote encryption set up
- invitee can accept without coordinating with the owner in real time
- server still never receives usable content keys
- shared folder keys remain separate from personal content keys

If the invitee has not set up encryption yet, their acceptance flow creates their public key bundle first. The owner may need to retry/finalize the invite if the key grant could not be created before the public key existed.
