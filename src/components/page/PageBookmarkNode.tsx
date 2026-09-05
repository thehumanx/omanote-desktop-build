import { createContext, useContext, useState } from "react";
import { Node, mergeAttributes } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react";
import { Link2 } from "lucide-react";
import type { BookmarkCategory, BookmarkItem } from "@omanote/shared";
import { BookmarkCard } from "../cards";
import { BookmarkEditorModal } from "../BookmarkEditorModal";

/**
 * A saved link inside a canvas, backed by a real `bookmarks` row so it also
 * appears under Saved.
 *
 * Simpler than PageTodoNode because there is no editable text: the node is an
 * atom holding a URL, so nothing can drift between document and row. The only
 * sync is create-on-insert and delete-both-ways.
 *
 * Renders the same BookmarkCard used on the daily canvas ("surface=canvas")
 * rather than a bespoke summary, so a link looks identical whether it lives
 * inside a page or outside one.
 */

export interface PageBookmarkLookup {
  byClientKey: Map<string, BookmarkItem>;
  categories: BookmarkCategory[];
  onEditSave: (bookmark: BookmarkItem, payload: { categoryId?: string; categoryName?: string; url: string }) => void;
}

const PageBookmarkContext = createContext<PageBookmarkLookup>({
  byClientKey: new Map(),
  categories: [],
  onEditSave: () => {},
});

export const PageBookmarkProvider = PageBookmarkContext.Provider;

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function PageBookmarkView({ node, deleteNode }: ReactNodeViewProps) {
  const { byClientKey, categories, onEditSave } = useContext(PageBookmarkContext);
  const bookmarkKey = (node.attrs.bookmarkKey as string | null) ?? null;
  const url = (node.attrs.url as string | null) ?? "";
  const bookmark = bookmarkKey ? byClientKey.get(bookmarkKey) : undefined;
  const [editing, setEditing] = useState(false);

  return (
    <NodeViewWrapper className="my-2" contentEditable={false} data-drag-handle>
      {bookmark ? (
        <>
          <BookmarkCard
            bookmark={bookmark}
            categoryName={categories.find((category) => category.id === bookmark.categoryId)?.name}
            surface="canvas"
            onEdit={() => setEditing(true)}
            // Removing the block is enough — usePageArtifactSync's reconcile
            // pass (fires on the next autosave tick) sees the block gone and
            // deletes the row, the same "document -> rows" path a manual
            // delete of the text would take.
            onDelete={() => deleteNode()}
          />
          {editing ? (
            <BookmarkEditorModal
              bookmark={bookmark}
              categories={categories}
              selectedCategoryId={bookmark.categoryId}
              onClose={() => setEditing(false)}
              onSave={(payload) => {
                onEditSave(bookmark, payload);
                setEditing(false);
              }}
              onDelete={() => {
                deleteNode();
                setEditing(false);
              }}
            />
          ) : null}
        </>
      ) : (
        // Not yet materialized — the row hasn't landed (still saving, or
        // decryption in flight on a cold load). The URL is all there is.
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 rounded-2xl border border-app-line bg-app-surface p-3 text-sm text-app-ink-muted no-underline"
        >
          <Link2 className="h-4 w-4 shrink-0" />
          <span className="truncate">{hostnameOf(url)}</span>
        </a>
      )}
    </NodeViewWrapper>
  );
}

export const PageBookmarkNode = Node.create({
  name: "pageBookmark",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      bookmarkKey: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-bookmark-key"),
        renderHTML: (attributes) =>
          attributes.bookmarkKey ? { "data-bookmark-key": attributes.bookmarkKey } : {},
      },
      url: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-url"),
        renderHTML: (attributes) => ({ "data-url": attributes.url }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-page-bookmark]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-page-bookmark": "" })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(PageBookmarkView, {
      // Without this, ProseMirror's own atom-node click handling intercepts
      // the mousedown before the browser's native anchor navigation runs, so
      // the link renders but never actually opens. Telling ProseMirror to
      // leave clicks inside an <a> alone is the documented fix.
      stopEvent: ({ event }) => {
        const target = event.target as HTMLElement | null;
        return !!target?.closest("a, button");
      },
    });
  },
});
