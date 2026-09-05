import { createContext, useContext } from "react";
import { Node, mergeAttributes } from "@tiptap/core";
import { NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react";
import type { TodoItem } from "@omanote/shared";
import { TodoCheckmark } from "../ui";

/**
 * A checklist line inside a canvas, backed by a real `todos` row.
 *
 * The node stores a **clientKey**, never a server id. The row is created
 * optimistically and only later gets a Convex id, so a server id would be
 * unavailable at the moment the node is inserted and would then have to be
 * written back into the document — an extra document mutation, mid-typing,
 * for every checklist item. A client-generated key is stable from the first
 * keystroke and is what `TodoItem.clientKey` is matched on.
 *
 * Division of ownership (see usePageArtifactSync):
 *   - the document owns the **text**; autosave pushes it to the row's title
 *   - the row owns **status**; the checkbox renders from app state, and
 *     clicking it dispatches the same `todo/toggle` as anywhere else
 */

export interface PageTodoLookup {
  byClientKey: Map<string, TodoItem>;
  onToggle: (todo: TodoItem) => void;
}

const PageTodoContext = createContext<PageTodoLookup>({
  byClientKey: new Map(),
  onToggle: () => {},
});

export const PageTodoProvider = PageTodoContext.Provider;

function PageTodoView({ node }: ReactNodeViewProps) {
  const { byClientKey, onToggle } = useContext(PageTodoContext);
  const todoKey = (node.attrs.todoKey as string | null) ?? null;
  const todo = todoKey ? byClientKey.get(todoKey) : undefined;
  const done = todo?.status === "done";

  return (
    <NodeViewWrapper className="flex items-start gap-2 py-0.5">
      <TodoCheckmark
        // The row may not exist yet (a line typed a moment ago, still
        // debouncing). Disabled rather than hidden so the line doesn't shift
        // when it materialises a beat later.
        disabled={!todo}
        aria-label={done ? "Mark as not done" : "Mark as done"}
        checked={done}
        contentEditable={false}
        onClick={() => { if (todo) onToggle(todo); }}
        align="text"
        size="sm"
        className="mt-0.5 shrink-0"
      />
      <NodeViewContent
        className={["min-w-0 flex-1", done ? "text-app-ink-faint line-through" : "text-app-ink"].join(" ")}
      />
    </NodeViewWrapper>
  );
}

export const PageTodoNode = Node.create({
  name: "pageTodo",
  group: "block",
  content: "inline*",
  defining: true,

  addAttributes() {
    return {
      todoKey: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-todo-key"),
        renderHTML: (attributes) =>
          attributes.todoKey ? { "data-todo-key": attributes.todoKey } : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-page-todo]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-page-todo": "" }), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(PageTodoView);
  },

  addKeyboardShortcuts() {
    return {
      // Enter continues the checklist, matching every list in the app. On an
      // empty item it breaks out into a paragraph instead of stranding the
      // user in a list they cannot leave.
      Enter: ({ editor }) => {
        if (!editor.isActive(this.name)) return false;
        const { $from } = editor.state.selection;
        if ($from.parent.content.size === 0) {
          return editor.commands.setNode("paragraph");
        }
        return editor.chain().insertContentAt(editor.state.selection.to, { type: this.name }).run();
      },
      // Backspace at the start of an item turns it back into a paragraph
      // rather than merging it into the line above.
      Backspace: ({ editor }) => {
        if (!editor.isActive(this.name)) return false;
        const { $from, empty } = editor.state.selection;
        if (!empty || $from.parentOffset !== 0) return false;
        return editor.commands.setNode("paragraph");
      },
    };
  },
});
