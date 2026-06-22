import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PageHeader } from "./PageHeader";
import { getGreetingForDate } from "./greetings";

const { mockDispatch, mockUiState } = vi.hoisted(() => ({
  mockDispatch: vi.fn(),
  mockUiState: {
    selectedDateKey: "2026-05-11",
    dateWindowOffset: 0,
  },
}));

vi.mock("../../app/AppProvider", () => ({
  useApp: () => ({
    state: {
      ui: mockUiState,
      todos: [
        {
          id: "todo_1",
          title: "First todo",
          priority: "normal",
          status: "open",
          createdAt: 1,
          updatedAt: 1,
          createdDateKey: "2026-05-09",
        },
      ],
      notes: [],
      deletedNotes: [],
      bookmarks: [],
      deletedBookmarks: [],
      events: [],
    },
    dispatch: mockDispatch,
  }),
}));

vi.mock("../../app/auth/AuthContext", () => ({
  useAuth: () => ({ user: { name: "Bibek" } }),
}));

vi.mock("convex/react", () => ({
  useQuery: () => ({ label: "2 notes" }),
}));

vi.mock("../../app/insights-local", () => ({
  useLocalDashboardStat: () => "2 notes",
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
}));

describe("PageHeader", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 11, 12, 0, 0, 0));
    mockDispatch.mockReset();
    mockUiState.selectedDateKey = "2026-05-11";
    mockUiState.dateWindowOffset = 0;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the greeting", () => {
    const expected = getGreetingForDate(new Date(2026, 4, 11, 12, 0, 0, 0), "Bibek");
    render(<PageHeader stat="notes_this_week" />);
    expect(screen.getByText(expected.short)).toBeInTheDocument();
    expect(screen.getByText(expected.full)).toBeInTheDocument();
  });

  it("renders the stat", () => {
    render(<PageHeader stat="notes_this_week" />);
    expect(screen.getByText("2 notes")).toBeInTheDocument();
  });

  it("shows date nav when showDateNav is true", () => {
    render(<PageHeader showDateNav stat="notes_this_week" />);
    expect(screen.getByText("Today · May 11")).toBeInTheDocument();
  });

  it("opens a canvas date picker from the date label and selects a date", () => {
    render(<PageHeader showDateNav stat="notes_this_week" />);

    fireEvent.click(screen.getAllByRole("button", { name: "Open canvas date picker" })[1]!);
    const dialog = screen.getByRole("dialog", { name: "Choose canvas date" });
    expect(dialog).toHaveClass("fixed");
    expect(dialog).toHaveClass("md:top-[calc(var(--omanote-top-chrome-height,58px)+0.5rem)]");
    expect(dialog).toHaveClass("transition-[height]");
    expect(dialog.querySelector(".aria-disabled\\:text-app-line-strong")).not.toBeNull();
    expect(dialog.querySelector(".fill-current")).not.toBeNull();
    fireEvent.click(within(dialog).getByRole("button", { name: /May 10/ }));

    expect(mockDispatch).toHaveBeenCalledWith({ type: "ui/set-selected-date", dateKey: "2026-05-10" });
    expect(screen.queryByRole("dialog", { name: "Choose canvas date" })).not.toBeInTheDocument();
  });

  it("caps date navigation to the first user data date and today", () => {
    const view = render(<PageHeader showDateNav stat="notes_this_week" />);

    expect(screen.getByRole("button", { name: "Next day" })).toBeDisabled();

    mockUiState.selectedDateKey = "2026-05-09";
    view.rerender(<PageHeader showDateNav stat="notes_this_week" />);

    expect(screen.getByRole("button", { name: "Previous day" })).toBeDisabled();
  });

  it("does not show date when showDateNav is false", () => {
    render(<PageHeader stat="notes_this_week" />);
    expect(screen.queryByText("May 11")).not.toBeInTheDocument();
  });

  it("rotates greetings by date within the same time bucket", () => {
    const morningOne = getGreetingForDate(new Date("2026-06-08T09:00:00"), "Bibek");
    const morningTwo = getGreetingForDate(new Date("2026-06-09T09:00:00"), "Bibek");

    expect(morningOne.full).not.toBe(morningTwo.full);
    expect(morningOne.full).toContain("Bibek");
    expect(morningOne.short).toContain("Bibek");
  });
});
