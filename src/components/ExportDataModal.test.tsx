import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ExportDataPanel } from "./ExportDataModal";

vi.mock("../app/AppProvider", () => ({
  useApp: () => ({
    state: {
      todos: [{ id: "todo_1", title: "Todo", status: "open", priority: "medium", createdDateKey: "2026-05-12", createdAt: 1 }],
      todoFolders: [],
      notes: [{ id: "note_1", body: "Note", tags: [], createdDateKey: "2026-05-12", createdAt: 1 }],
      bookmarks: [{ id: "bookmark_1", url: "https://example.com", title: "Bookmark", categoryId: "cat_1", createdDateKey: "2026-05-12", createdAt: 1 }],
      events: [{ id: "event_1", label: "Event", loggedAt: 1, createdDateKey: "2026-05-12", createdAt: 1 }],
      checklistItems: [],
      noteFolders: [],
      bookmarkCategories: [{ id: "cat_1", name: "Saved" }],
    },
  }),
}));

describe("ExportDataPanel", () => {
  it("uses shared chrome checkbox fields for export category choices", () => {
    render(<ExportDataPanel />);

    for (const label of ["All", "Todos", "Notes", "Bookmarks", "Events"]) {
      const checkbox = screen.getByRole("checkbox", { name: new RegExp(label) });

      expect(checkbox.querySelector(".omanote-todo-checkmark")).toBeInTheDocument();
      expect(checkbox.querySelector(".omanote-todo-checkmark-done")).toBeInTheDocument();
      expect(checkbox.querySelector("input")).not.toBeInTheDocument();
    }
  });
});
