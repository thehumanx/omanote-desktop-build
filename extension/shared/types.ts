export type SaveType = "note" | "bookmark" | "todo";

export interface AuthState {
  token: string;
  expiresAt: number;
  user: {
    name: string;
    email: string;
    imageUrl: string | null;
  };
}

export interface NoteFolder {
  _id: string;
  name: string;
  icon?: string;
}

export interface BookmarkCategory {
  _id: string;
  name: string;
  icon?: string;
}

export interface FoldersData {
  folders: NoteFolder[];
  categories: BookmarkCategory[];
  cachedAt: number;
  lastSelectedNoteFolderId?: string | null;
  lastSelectedBookmarkCategoryId?: string | null;
}

export interface SavePayload {
  type: SaveType;
  content: string;
  url?: string;
  pageTitle?: string;
  folderId?: string;
  folderName?: string;
  categoryId?: string;
  hashtags?: string[];
}

export interface CaptureContext {
  selectedText?: string;
  selectedUrl?: string;
  pageUrl: string;
  pageTitle: string;
  triggeredBy: "bubble" | "context-menu" | "popup" | "shortcut";
}

export interface RecentItem {
  id: string;
  type: SaveType;
  title: string;
  savedAt: number;
}
