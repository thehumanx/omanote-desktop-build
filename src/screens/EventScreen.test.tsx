import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DateKey } from "@omanote/shared";
import type { AppState } from "../app/types";
import { EventScreen } from "./EventScreen";

const { mockState, mockDispatch } = vi.hoisted(() => ({
  mockDispatch: vi.fn(),
  mockState: { current: null as AppState | null },
}));

vi.mock("../app/AppProvider", () => ({
  useApp: () => ({
    state: mockState.current,
    dispatch: mockDispatch,
  }),
}));

vi.mock("../components/layout/useTopChrome", () => ({
  useTopChrome: vi.fn(),
}));

function makeState(): AppState {
  return {
    ui: {
      selectedDateKey: "2026-05-15" as DateKey,
      dateWindowOffset: 0,
      tab: "event",
      todoFilter: "today",
      searchQuery: "",
      searchOpen: false,
      notesDrawerOpen: false,
    },
    todos: [],
    checklistItems: [],
    notes: [],
    deletedNotes: [],
    noteFolders: [],
    bookmarks: [],
    deletedBookmarks: [],
    bookmarkCategories: [],
    events: [],
    habits: [],
    activity: [],
    toasts: [],
  };
}

describe("EventScreen", () => {
  beforeEach(() => {
    mockDispatch.mockReset();
    mockState.current = makeState();
    window.localStorage.clear();
  });

  it("uses an animated nav-active highlight for the active event view toggle", () => {
    render(
      <MemoryRouter>
        <EventScreen />
      </MemoryRouter>,
    );

    const calendarView = screen.getByRole("button", { name: "Calendar view" });
    const highlight = screen.getByTestId("event-view-highlight");

    expect(highlight).toHaveClass("bg-nav-active");
    expect(highlight).toHaveClass("transition-[transform,width,height,opacity]");
    expect(calendarView).toHaveClass("text-nav-active-ink");
    expect(calendarView).not.toHaveClass("bg-nav-active");
    expect(calendarView).not.toHaveClass("bg-app-surface");
  });
});
