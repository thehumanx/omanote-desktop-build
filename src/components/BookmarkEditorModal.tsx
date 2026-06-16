import { useEffect, useMemo, useRef, useState } from "react";
import type { BookmarkCategory, BookmarkItem } from "@omanote/shared";
import { useCanvasDraftValue } from "../app/useCanvasDraftValue";
import { Button, Input } from "./ui";
import { BaseModal } from "./BaseModal";
import { Check, ChevronDown, X } from "lucide-react";
import { useOutsideClick } from "../lib/useOutsideClick";

export function BookmarkEditorModal({
  bookmark,
  categories,
  selectedCategoryId,
  onClose,
  onSave,
  onDelete,
}: {
  bookmark?: BookmarkItem | null;
  categories: BookmarkCategory[];
  selectedCategoryId?: string | null;
  onClose: () => void;
  onSave: (payload: {
    categoryId?: string;
    categoryName?: string;
    url: string;
    draftKey?: string;
  }) => void;
  onDelete?: () => void;
}) {
  const draftKey = bookmark ? `bookmark:${bookmark.id}` : "bookmark:new";
  const modalBodyRef = useRef<HTMLDivElement | null>(null);
  const categoryMenuRef = useRef<HTMLDivElement | null>(null);
  const initialCategoryName =
    (selectedCategoryId ? categories.find((category) => category.id === selectedCategoryId)?.name : undefined) ??
    categories[0]?.name ??
    "";
  const bookmarkCategoryName = bookmark ? categories.find((category) => category.id === bookmark.categoryId)?.name : undefined;
  const { value: categoryName, setValue: setCategoryName } = useCanvasDraftValue(
    draftKey + ":categoryName",
    bookmarkCategoryName ?? initialCategoryName,
  );
  const { value: url, setValue: setUrl } = useCanvasDraftValue(draftKey + ":url", bookmark?.url ?? "");
  type CategoryMenuItem =
    | {
        kind: "existing";
        key: string;
        label: string;
        value: string;
      }
    | {
        kind: "create";
        key: string;
        label: string;
        value: string;
      };
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);
  const [categoryActiveIndex, setCategoryActiveIndex] = useState(0);
  const trimmedCategoryName = categoryName.trim();
  const categoryFilter = trimmedCategoryName.toLowerCase();
  const visibleCategories = useMemo(() => {
    if (!categoryFilter) return categories;
    return categories.filter((category) => category.name.toLowerCase().includes(categoryFilter));
  }, [categories, categoryFilter]);
  const exactCategoryMatch = useMemo(
    () => categories.find((category) => category.name.toLowerCase() === categoryFilter) ?? null,
    [categories, categoryFilter],
  );
  const categoryMenuItems = useMemo(() => {
    const items: CategoryMenuItem[] = visibleCategories.map((category) => ({
      kind: "existing" as const,
      key: category.id,
      label: category.name,
      value: category.name,
    }));

    if (trimmedCategoryName && !exactCategoryMatch) {
      items.push({
        kind: "create" as const,
        key: `create:${categoryFilter}`,
        label: `Create category "${trimmedCategoryName}"`,
        value: trimmedCategoryName,
      });
    }

    return items;
  }, [categoryFilter, exactCategoryMatch, trimmedCategoryName, visibleCategories]);

  useEffect(() => {
    setCategoryName(bookmarkCategoryName ?? initialCategoryName);
  }, [bookmark?.categoryId, bookmarkCategoryName, initialCategoryName, setCategoryName]);
  useEffect(() => {
    if (!categoryMenuOpen) {
      setCategoryActiveIndex(0);
      return;
    }
    setCategoryActiveIndex((current) => Math.min(current, Math.max(0, categoryMenuItems.length - 1)));
  }, [categoryMenuItems.length, categoryMenuOpen]);
  useOutsideClick(categoryMenuRef, categoryMenuOpen, () => setCategoryMenuOpen(false));
  const canSave = Boolean(url.trim());

  const selectCategoryValue = (value: string) => {
    setCategoryName(value);
    setCategoryMenuOpen(false);
  };

  return (
    <BaseModal onClose={onClose}>
      <div ref={modalBodyRef} className="w-full max-w-2xl rounded-xl border border-app-line bg-app-surface p-5 shadow-soft">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-app-ink">{bookmark ? "Edit bookmark" : "Save bookmark"}</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close modal"
              className="rounded-full p-2 text-app-ink-faint transition hover:bg-app-surface-hover hover:text-app-ink"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-4 space-y-4">
            <div ref={categoryMenuRef} className="relative space-y-2">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-app-ink-faint">Category</p>
              <div className="relative">
                <Input
                  value={categoryName}
                  onChange={(event) => {
                    setCategoryName(event.target.value);
                    setCategoryMenuOpen(true);
                  }}
                  onFocus={() => setCategoryMenuOpen(true)}
                  onKeyDown={(event) => {
                    if (!categoryMenuOpen) return;
                    if (event.key === "ArrowDown") {
                      event.preventDefault();
                      setCategoryActiveIndex((current) => (current + 1) % Math.max(1, categoryMenuItems.length));
                      return;
                    }
                    if (event.key === "ArrowUp") {
                      event.preventDefault();
                      setCategoryActiveIndex((current) => (current - 1 + Math.max(1, categoryMenuItems.length)) % Math.max(1, categoryMenuItems.length));
                      return;
                    }
                    if (event.key === "Enter" || event.key === "Tab") {
                      const nextItem = categoryMenuItems[categoryActiveIndex];
                      if (nextItem) {
                        event.preventDefault();
                        selectCategoryValue(nextItem.value);
                      }
                    }
                  }}
                  placeholder="Type a category or choose one"
                  className="h-11 rounded-xl border-app-line bg-app-surface pr-20 focus:border-app-line-strong focus:ring-2 focus:ring-app-focus/15"
                />
                {categoryName.trim() ? (
                  <button
                    type="button"
                    aria-label="Clear category"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      setCategoryName("");
                      setCategoryMenuOpen(true);
                    }}
                    className="absolute right-10 top-1/2 -translate-y-1/2 rounded-full p-1 text-app-ink-faint transition hover:bg-app-surface-hover hover:text-app-ink"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : null}
                <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-app-ink-faint" />
              </div>
              {categoryMenuOpen ? (
                <div
                  className="absolute left-0 right-0 top-full z-20 mt-2 rounded-xl border border-app-line bg-app-surface p-1 shadow-soft"
                  onMouseDown={(event) => {
                    event.preventDefault();
                  }}
                >
                  {categoryMenuItems.length ? (
                    categoryMenuItems.map((item, index) => (
                      <button
                        key={item.key}
                        type="button"
                        className={[
                          "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition",
                          index === categoryActiveIndex ? "bg-app-surface-muted text-app-ink" : "text-app-ink-muted hover:bg-app-surface-hover",
                        ].join(" ")}
                        onMouseEnter={() => setCategoryActiveIndex(index)}
                        onClick={() => {
                          selectCategoryValue(item.value);
                        }}
                      >
                        <span>{item.label}</span>
                        {index === categoryActiveIndex ? <Check className="h-4 w-4 text-app-ink-faint" /> : null}
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-sm text-app-ink-faint">No matching categories</div>
                  )}
                </div>
              ) : null}
            </div>

            <div className="relative">
              <Input
                value={url}
                onChange={(event) => {
                  setUrl(event.target.value);
                }}
                placeholder="URL"
                className="h-11 rounded-xl border-app-line bg-app-surface pr-10 focus:border-app-line-strong focus:ring-2 focus:ring-app-focus/15"
              />
              {url.trim() ? (
                <button
                  type="button"
                  aria-label="Clear URL"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    setUrl("");
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-app-ink-faint transition hover:bg-app-surface-hover hover:text-app-ink"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Button
              disabled={!canSave}
              onClick={() =>
                onSave({
                  categoryId: exactCategoryMatch?.id,
                  categoryName: categoryName.trim() || undefined,
                  url: url.trim(),
                  draftKey,
                })
              }
            >
              Save
            </Button>
            <Button tone="ghost" onClick={onClose}>
              Cancel
            </Button>
            {bookmark && onDelete ? (
              <Button tone="ghost" className="ml-auto text-app-ink-muted" onClick={onDelete}>
                Delete
              </Button>
            ) : null}
          </div>
        </div>
    </BaseModal>
  );
}
