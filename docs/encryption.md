# omanote Encryption and Recovery

Last updated: 2026-04-14

This document describes the current client-side encryption model used by omanote.

## Goal

Encrypt user content before it is sent to Convex so backend/admin access sees ciphertext for protected fields.

## Threat model (what this protects)

- Protects user content at rest in Convex from plaintext exposure in admin/database views.
- Protects against backend-only compromise of encrypted fields.
- Does not hide metadata such as document IDs, `userId`, timestamps, or route/activity structure.

## Key architecture

- Content key: random AES-GCM-256 key per user (generated in browser).
- Passphrase key wrapping: PBKDF2-SHA256 (310,000 iterations) derives an AES-KW wrapping key.
- Wrapped storage format: `wrappedKey` + `salt` stored in `userEncryptionKeys`.
- Encrypted field format: `enc:v1:<base64(12-byte-iv + ciphertext)>`.

Legacy plaintext values remain readable by the app and are only encrypted when rewritten.

## Recovery key architecture

- A human-readable recovery key can unlock the same content key without the passphrase.
- Recovery material is stored as `wrappedRecoveryKey` + `recoverySalt` in `userEncryptionKeys`.
- On recovery-key rotation, the content key is re-wrapped and persisted with new recovery fields.
- Older recovery keys stop working after rotation.

## User flow

1. First setup
- User signs in and sets an encryption passphrase.
- Browser generates content key, wraps it, stores wrapped values in Convex.
- Browser generates a recovery key and downloads a `.txt` file.

2. Existing sign-in
- User unlocks once with passphrase (or recovery key).
- Unwrapped content key is cached locally for session persistence across reloads.

3. Sign-out
- In-memory key and local cached key are cleared.

## Session persistence

- Local key cache uses browser IndexedDB.
- This avoids passphrase prompts on every page reload for the active signed-in user session.
- Cache is invalidated on sign-out and when stale/non-extractable keys are detected.

## Encrypted fields

| Table | Encrypted fields |
|---|---|
| `todos` | `title`, `notes` |
| `notes` | `title`, `body`, `tags[]`, `folderName` |
| `bookmarks` | `url`, `title`, `siteName`, `description`, `thumbnailUrl`, `faviconUrl` |
| `eventEntries` | `label`, `notes` |
| `todoChecklistItems` | `text` |
| `noteFolders` | `name` |
| `bookmarkCategories` | `name` |
| `activityHistory` | `itemTitle`, `diff` |

## Operational caveats

- If users lose both passphrase and latest recovery key, data is unrecoverable by design.
- Rotating/downloading a new recovery key invalidates previously downloaded recovery keys.
- Recovery key files should be stored outside the browser/device and treated like a secret.

## Relevant files

- Client crypto: `src/lib/crypto.ts`
- Encryption session/state: `src/contexts/EncryptionContext.tsx`
- Unlock/setup UI: `src/components/EncryptionGate.tsx`
- App wiring (read/write encryption): `src/app/AppProvider.tsx`
- Settings/data export actions: `src/screens/SettingsScreen.tsx`, `src/components/layout/BottomNav.tsx`
- Convex key storage: `convex/schema.ts`, `convex/encryptionKeys.ts`
