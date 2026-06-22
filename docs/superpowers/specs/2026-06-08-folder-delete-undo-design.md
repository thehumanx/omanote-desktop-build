# Folder Delete Undo Design

## Goal

Add `Undo` support for note-folder deletes and bookmark-category deletes for both delete flows:

- delete folder/category only
- delete folder/category and its contents

The Undo window should use the existing in-app delete toast behavior and timing.

## Product Behavior

### Scope

This feature applies to:

- note folder delete
- note folder delete with notes
- bookmark category delete
- bookmark category delete with bookmarks

It does not change individual note or bookmark delete behavior.

### User Experience

When a user confirms a folder/category delete:

1. The delete happens immediately using the existing behavior.
2. A toast appears for 5 seconds with an `Undo` action.
3. If the user clicks `Undo` within that window, the deleted folder/category is restored.
4. Contents are also restored to their exact pre-delete state:
   - `delete only` restores the folder/category and reassigns moved items back into it
   - `delete with contents` restores the folder/category and restores the deleted items inside it
5. If the toast expires, the delete stands.

### Toast Copy

The feature should reuse the existing delete toast interaction model.

Expected copy style:

- notes: `Deleted folder: <folder name>`
- bookmarks: `Deleted category: <category name>`

The toast keeps the standard 5-second lifetime and `Undo` label.

## Recommended Approach

Use snapshot-and-restore in the app layer.

The app captures a restore snapshot before performing the delete, then wires the existing toast `Undo` action to a restore flow built from that snapshot.

This approach is preferred because:

- it matches the current toast Undo architecture already used for items
- it avoids introducing a new pending-delete lifecycle on the backend
- it keeps the feature local to folder/category delete flows
- it minimizes risk to sync and data model behavior

## Architecture

### App Layer Ownership

`src/app/AppProvider.tsx` should own folder/category delete Undo orchestration.

Responsibilities:

- build restore snapshots before delete
- show delete toasts with `Undo`
- perform the existing delete mutations
- recreate deleted folders/categories during Undo
- restore affected note/bookmark records to the correct state

This keeps folder/category Undo aligned with the current item delete Undo behavior.

### Snapshot Model

Add an internal snapshot shape for folder/category deletes.

For note folders:

- deleted folder metadata
  - original id
  - name
  - icon
- delete mode
  - `remove_folder_only`
  - `remove_folder_and_notes`
- affected note snapshots
  - note id
  - title/body fallback for toast logging if needed
  - prior `folderId`
  - prior `folderName`
  - deleted state before delete

For bookmark categories:

- deleted category metadata
  - original id
  - name
  - icon
- delete mode
  - `remove_category_only`
  - `remove_category_and_bookmarks`
- affected bookmark snapshots
  - bookmark id
  - prior `categoryId`
  - prior category name if needed for local restore bookkeeping
  - deleted state before delete

The snapshot only needs the data required to restore the deleted container and return affected items to their original membership/deletion state.

### Restore Strategy

#### Note Folder: Delete Only

Current behavior:

- folder is deleted
- notes in that folder are moved to uncategorized by clearing folder linkage

Undo behavior:

1. recreate the folder
2. capture the new folder id
3. update all affected notes back to the recreated folder using the new id and original folder name

#### Note Folder: Delete With Notes

Current behavior:

- folder is deleted
- notes in that folder are soft-deleted

Undo behavior:

1. recreate the folder
2. capture the new folder id
3. restore each affected note
4. update each restored note to point at the recreated folder using the new id and original folder name

#### Bookmark Category: Delete Only

Current behavior:

- category is deleted
- bookmarks still reference the category id, but the UI treats them as `Saved`

Undo behavior:

1. recreate the category
2. capture the new category id
3. update affected bookmarks so their `categoryId` points to the recreated category

#### Bookmark Category: Delete With Bookmarks

Current behavior:

- category is deleted
- bookmarks in that category are soft-deleted

Undo behavior:

1. recreate the category
2. capture the new category id
3. restore each affected bookmark
4. update each restored bookmark so its `categoryId` points to the recreated category

### Important ID Constraint

Restored folders/categories should not rely on reusing the deleted container id.

Instead:

- recreate the folder/category normally
- use the newly returned id
- remap all restored or reassigned items to that new id

This avoids depending on backend resurrection semantics that do not currently exist.

## Data and API Changes

### Existing APIs to Reuse

Prefer reusing the current mutations where possible:

- note restore
- bookmark restore
- note update
- bookmark update
- note folder create
- bookmark category create

### Likely Additions

Folder/category Undo will likely need small helper surfaces so the app can restore membership accurately.

Possible additions:

- app actions for folder/category restore orchestration
- provider-local helper functions for:
  - capturing delete snapshots
  - restoring note-folder snapshots
  - restoring bookmark-category snapshots

Backend additions should stay minimal and only be introduced if existing create/update/restore mutations are insufficient.

## Failure Handling

### Partial Restore Risk

Undo can involve multiple async operations:

- recreate folder/category
- restore deleted items
- update item membership

If one of those fails midway, the app must avoid silent corruption.

Expected behavior:

- log the failure clearly
- stop further restore work when appropriate
- show a failure toast if the restore cannot complete

### Toast Expiry

When the toast expires:

- no extra cleanup step is required
- the deletion remains final under the current model

### Concurrent Deletes

Each folder/category delete toast must keep its own restore snapshot.

Undo must restore the snapshot associated with the toast the user clicked, not the most recent delete globally.

## Testing Strategy

### Unit / Provider Coverage

Add focused tests around the restore orchestration in `AppProvider`.

Cover:

- note folder delete only -> Undo restores folder and note membership
- note folder delete with notes -> Undo restores folder and notes
- bookmark category delete only -> Undo restores category and bookmark membership
- bookmark category delete with bookmarks -> Undo restores category and bookmarks

### Edge Cases

Cover:

- multiple folder/category deletes in sequence keep independent Undo behavior
- Undo uses the correct recreated id for restored membership
- restore failure does not silently leave state inconsistent

### Screen Coverage

UI tests are optional and should stay focused.

Only add screen-level assertions if needed to verify:

- the delete toast appears
- the toast exposes `Undo`

Most behavior should be tested below the screen layer.

## Out of Scope

The following are not part of this feature:

- changing the 5-second toast timeout
- introducing backend delayed-delete finalization
- changing individual note or bookmark delete Undo
- adding redo behavior for folder/category restore
- redesigning the toast UI

## Implementation Notes

Keep the change narrow and local:

- prefer provider helpers over broad reducer changes
- preserve current delete semantics when Undo is not used
- match existing item-delete Undo patterns wherever possible

This should feel like a natural extension of the current delete toast system, not a parallel deletion framework.
