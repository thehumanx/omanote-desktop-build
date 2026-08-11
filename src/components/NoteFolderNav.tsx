import type { KeyboardEvent, ReactNode, Ref } from "react";
import { FolderNavActionMenu, FolderNavCard, FolderNavRow } from "./FolderNav";

/**
 * Note-folder-flavoured names over the shared `FolderNav` primitives — see
 * that file for why this is a wrapper rather than its own implementation.
 * `BookmarkCategoryNav.tsx` is the equivalent wrapper for bookmark categories.
 */

export function FolderRow({
  folderName,
  placeholder = "New folder",
  ...rest
}: {
  folderName: string;
  icon?: string;
  count: number;
  selected: boolean;
  onClick: () => void;
  isEditing?: boolean;
  inputValue?: string;
  onInputChange?: (value: string) => void;
  onInputKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
  inputRef?: Ref<HTMLInputElement>;
  duplicateError?: string | null;
  onCancel?: () => void;
  onIconClick?: (ref: React.RefObject<HTMLButtonElement | null>) => void;
  iconPickerActive?: boolean;
  placeholder?: string;
  isShared?: boolean;
  actions?: ReactNode;
}) {
  return <FolderNavRow name={folderName} placeholder={placeholder} {...rest} />;
}

export function FolderCard({
  folderName,
  ...rest
}: {
  folderName: string;
  icon?: string;
  count: number;
  selected: boolean;
  onClick: () => void;
  isShared?: boolean;
  onIconClick?: (ref: React.RefObject<HTMLButtonElement | null>) => void;
  iconPickerActive?: boolean;
  actions?: ReactNode;
}) {
  return <FolderNavCard name={folderName} {...rest} />;
}

export function FolderActionMenu({
  folderId: _folderId,
  folderName,
  ...rest
}: {
  /** Unused by the component itself — kept so existing call sites (which pass
   *  it for symmetry with the other props) don't need to change. */
  folderId: string;
  folderName: string;
  isOpen: boolean;
  menuRef?: Ref<HTMLDivElement>;
  size?: "sm" | "md";
  alwaysVisible?: boolean;
  isShared?: boolean;
  onToggle: () => void;
  onRename: () => void;
  onDelete: () => void;
  onShare: () => void;
}) {
  return <FolderNavActionMenu noun="Folder" name={folderName} {...rest} />;
}
