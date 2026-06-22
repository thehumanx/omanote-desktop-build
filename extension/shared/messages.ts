import type { AuthState, CaptureContext, FoldersData, RecentItem, SavePayload } from "./types";

export type ExtMessage =
  | { type: "OPEN_AUTH_TAB" }
  | { type: "AUTH_TOKEN_RECEIVED"; token: string; expiresAt: number; user: AuthState["user"] }
  | { type: "DISCONNECT" }
  | { type: "GET_AUTH_STATE" }
  | { type: "AUTH_STATE_RESPONSE"; auth: AuthState | null }
  | { type: "GET_ENCRYPTION_STATE" }
  | { type: "UNLOCK_ENCRYPTION"; passphrase: string }
  | { type: "LOCK_ENCRYPTION" }
  | { type: "ENCRYPTION_STATE_RESPONSE"; isUnlocked: boolean }
  | { type: "ENCRYPTION_ERROR"; error: string }
  | { type: "GET_FOLDERS" }
  | { type: "CREATE_NOTE_FOLDER"; name: string }
  | { type: "CREATE_BOOKMARK_CATEGORY"; name: string }
  | { type: "FOLDERS_RESPONSE"; data: FoldersData }
  | { type: "SAVE_ITEM"; payload: SavePayload }
  | { type: "SAVE_SUCCESS"; itemId: string; itemType: SavePayload["type"] }
  | { type: "SAVE_ERROR"; error: string }
  | { type: "OPEN_SAVE_MODAL"; context: CaptureContext }
  | { type: "GET_RECENT_ITEMS" }
  | { type: "RECENT_ITEMS_RESPONSE"; items: RecentItem[] };
