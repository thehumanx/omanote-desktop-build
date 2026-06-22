# Omanote Folder Collaboration Design

> **Status: PROPOSED 2026-06-03**

## Goal

Add private folder collaboration for note folders and bookmark categories so an owner can invite specific Omanote users to edit a folder.

Collaboration must be invite-only by default. There is no public preview or self-join flow as part of this feature.

## Product Decision

Use an **invite-only collaboration model**.

The folder remains private unless the owner explicitly invites another user. The invite is tied to a specific email address and a specific folder.

This avoids the main risks of public-link collaboration:

- accidental access by people who should not edit the folder
- confusion between read-only sharing and editable collaboration
- unclear revocation behavior for pending access

## Core UX

### Owner flow

1. The owner opens a folder's collaborator settings.
2. They enter a collaborator email address.
3. Omanote sends a single invite email for that folder.
4. The owner can see the pending invite in the collaborator list.
5. The owner can revoke a pending invite at any time.
6. The owner can remove an accepted collaborator at any time.

### Invitee flow

1. The invitee opens the invite link from email.
2. If they are not signed in, they sign in first.
3. Omanote verifies that the signed-in account matches the invited email.
4. The invitee accepts access to that exact folder.
5. The folder appears in their Omanote app and they can edit it.

### Revocation behavior

1. If the owner revokes a pending invite, the invite link becomes invalid immediately.
2. If the owner removes an accepted collaborator, that user loses access immediately.

## Scope

This design covers:

- collaborator membership for note folders and bookmark categories
- owner-managed collaborator add/remove flows
- one email notification for collaborator addition
- invite acceptance after sign-in
- pending invite revocation
- folder header collaborator avatars

This design does not define a team workspace or organization model. It is folder-scoped collaboration only.

## Proposed Behavior

### Access rules

- A folder is private by default.
- Only the owner and explicitly invited collaborators can view or edit it.
- Public preview is not part of this collaboration feature.
- Access is enforced server-side, not only in the UI.

### Owner controls

- The owner can view all collaborators for the folder.
- The owner can add a collaborator by email.
- The owner can revoke a pending invite.
- The owner can remove an accepted collaborator at any time.
- Removing a collaborator revokes future access.

### Avatar display

- Folder headers show collaborator avatars.
- Show up to 3 avatars.
- If more than 3 collaborators exist, show `+x` for the remainder.

## Data Model

This feature needs explicit membership and invite state.

### `folderCollaborators`

Purpose: store active collaborator access for a folder.

One row per folder-user pair.

Fields:

- `folderKind`: `note_folder` or `bookmark_category`
- `folderId`
- `userId`
- `role`: `owner` or `editor`
- `addedByUserId`
- `addedAt`
- `updatedAt`
- `removedAt?`

Notes:

- `userId` should use the stable authenticated identity used elsewhere in Convex.
- The owner should also appear in the collaborator list and avatar strip so the ownership relationship is visible in the same UI as the editors.
- Soft removal is preferred so collaborator history can be audited.

### `folderInvites`

Purpose: track pending collaborator invitations sent by email.

Fields:

- `folderKind`: `note_folder` or `bookmark_category`
- `folderId`
- `folderNameSnapshot`
- `inviteeEmail`
- `inviteToken`
- `status`: `pending`, `accepted`, `revoked`, `expired`
- `createdByUserId`
- `createdAt`
- `updatedAt`
- `acceptedAt?`
- `acceptedByUserId?`
- `revokedAt?`
- `expiresAt?`

Notes:

- The email should contain a private invite link with `inviteToken`.
- The invite should accept only the intended email identity after sign-in.
- Invite tokens are not public share links.
- Invites may be sent to any email address, but acceptance requires a signed-in Omanote account whose verified email matches `inviteeEmail`.

## Backend Design

### Invite creation mutation

When the owner adds a collaborator:

1. Verify ownership of the target folder.
2. Resolve or normalize the invitee email.
3. Create or upsert a pending invite row.
4. Send exactly one collaborator email.
5. Record an invite token that can later be accepted.

The mutation should be idempotent enough that repeated clicks do not create duplicate active invites for the same folder and email.

### Invite revocation mutation

When the owner revokes a pending invite:

1. Verify ownership of the target folder.
2. Confirm the invite is still pending.
3. Mark the invite as revoked.
4. Invalidate the invite token immediately.

The same invite link must stop working as soon as revocation is recorded.

### Invite acceptance mutation

When the invitee opens the invite link:

1. Validate the invite token.
2. Require sign-in if needed.
3. Confirm the signed-in email matches the invited email.
4. Create the collaborator membership row if it does not already exist.
5. Mark the invite as accepted.
6. Redirect the user to the folder inside the app.

If the invite has already been accepted, the flow should still land the user in the folder.

### Collaborator listing query

Provide a query for the owner folder view that returns:

- collaborators with avatars and names
- invite status for pending invites
- whether the current viewer is the owner or a collaborator

This query powers:

- the collaborator list in folder settings
- the avatar strip in the folder header

### Authorization rules

- Only the owner can invite, revoke, or remove collaborators.
- Collaborators can edit folder content, but cannot manage collaborators unless they are the owner.
- Non-collaborators cannot view or edit the folder.

### Folder access check

Any folder query or mutation that loads or edits shared folder content must verify that the current signed-in user is either:

- the owner, or
- an active collaborator

If not, the request must be rejected.

## Frontend Design

### Folder settings panel

Add a collaborator section to the owner folder settings:

- email input
- add collaborator action
- current collaborator list
- revoke action for pending invites
- remove action for accepted collaborators
- pending invite status display

The UI should be fast and simple. This is not a full team admin screen.

### App navigation

After acceptance, the folder should appear in the collaborator's normal app surfaces:

- note folders in Notes
- bookmark categories in Bookmarks

The app should not force the user through a special preview flow once access is granted.

### Avatars

Use the same compact avatar group pattern in folder headers:

- up to 3 visible avatars
- `+x` overflow indicator

This should appear in folder views where collaboration is relevant, not everywhere in the app.

## Email Design

Send one email per collaborator addition.

Email content should clearly say:

- the sender added the recipient as a collaborator
- the target folder name
- the link is for accepting collaboration access
- the recipient must sign in if they are not already authenticated

The email should not mention public preview, because public preview is not part of this feature.

## Error Handling

- If the owner tries to invite themselves, reject the action.
- If the invitee has not created an Omanote account yet, they can sign up first and then accept the invite as long as the authenticated email matches the invite email.
- If a collaborator is removed, their next folder access check should fail immediately.
- If an invite token is invalid, revoked, expired, or already accepted, show a clear acceptance error.

## Privacy and Security

- Folder collaboration must be private by default.
- Invite tokens must be unguessable and single-purpose.
- The invite URL and any future public share URL must be different concepts.
- Authorization must be enforced server-side, not only in the UI.

## Testing

Add tests for:

- owner can create an invite for a collaborator
- invite acceptance succeeds only for the intended authenticated user
- collaborator appears in folder collaborator listings
- owner can revoke a pending invite
- revoked invite token becomes invalid immediately
- owner can remove a collaborator
- removed collaborator loses edit access

Add coverage for both folder kinds:

- note folders
- bookmark categories

## Rollout Notes

This feature can ship without affecting any separate public share feature, because collaboration is private and folder-scoped.

The safest implementation path is:

1. add membership and invite tables
2. wire invite email and acceptance
3. wire owner collaborator management
4. gate folder reads and writes on collaborator membership
5. add avatars and overflow display

## Open Questions

None.
