import type { FolderCardActions } from "./FolderGalleryCard";
import type { FolderTabEditing } from "./FolderTab";

/** What every folder-gallery preview needs to know about its folder. */
export type GalleryFolder = {
  key: string;
  name: string;
  icon?: string;
  color?: string;
  pinned?: boolean;
  /** Has an active public share link. */
  shared?: boolean;
  lastUpdated: number;
  /** Tab controls, passed straight through to the card. */
  onIconClick?: (anchor: HTMLButtonElement) => void;
  editing?: FolderTabEditing;
  actions?: FolderCardActions;
};
