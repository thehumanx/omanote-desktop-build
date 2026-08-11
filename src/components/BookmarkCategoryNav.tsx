import type { KeyboardEvent, ReactNode, Ref } from "react";
import { FolderNavActionMenu, FolderNavCard, FolderNavRow } from "./FolderNav";

/**
 * Bookmark-category-flavoured names over the shared `FolderNav` primitives —
 * see that file for why this is a wrapper rather than its own implementation.
 * `NoteFolderNav.tsx` is the equivalent wrapper for note folders.
 */

export function CategoryRow({
  categoryName,
  placeholder = "New category",
  ...rest
}: {
  categoryName: string;
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
  return <FolderNavRow name={categoryName} placeholder={placeholder} {...rest} />;
}

export function CategoryCard({
  categoryName,
  ...rest
}: {
  categoryName: string;
  icon?: string;
  count: number;
  selected: boolean;
  onClick: () => void;
  isShared?: boolean;
  onIconClick?: (ref: React.RefObject<HTMLButtonElement | null>) => void;
  iconPickerActive?: boolean;
  actions?: ReactNode;
}) {
  return <FolderNavCard name={categoryName} {...rest} />;
}

export function CategoryActionMenu({
  categoryId: _categoryId,
  categoryName,
  ...rest
}: {
  /** Unused by the component itself — kept so existing call sites (which pass
   *  it for symmetry with the other props) don't need to change. */
  categoryId: string;
  categoryName: string;
  isOpen: boolean;
  menuRef?: Ref<HTMLDivElement>;
  size?: "sm" | "md";
  isShared?: boolean;
  alwaysVisible?: boolean;
  onToggle: () => void;
  onRename: () => void;
  onShare: () => void;
  onDelete: () => void;
}) {
  return <FolderNavActionMenu noun="Category" name={categoryName} {...rest} />;
}
