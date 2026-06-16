import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InsightsScreen } from "./InsightsScreen";

vi.mock("convex/react", () => ({
  useQuery: () => ({ activeDayStreak: 4 }),
}));

vi.mock("../app/insights-local", () => ({
  useLocalInsights: () => ({
    productivity: {
      completionRate: 50,
      totalCompleted: 4,
      totalCreated: 8,
      avgDaysToComplete: 2,
      medianDaysToComplete: 2,
      overdueCount: 1,
      overdueRate: 20,
      todosWithDueDate: 5,
      createdSparkline: [0, 1, 2],
      completedSparkline: [0, 1, 2],
      peakHour: 15,
      peakHourCount: 3,
      peakDay: 2,
      peakDayCount: 4,
      hourCounts: Array(24).fill(0),
      hourBreakdown: Array.from({ length: 24 }, () => ({ todo: 0, note: 0, bookmark: 0, event: 0 })),
      dayCounts: Array(7).fill(0),
      dayBreakdown: Array.from({ length: 7 }, () => ({ todo: 0, note: 0, bookmark: 0, event: 0 })),
    },
    content: {
      todos: 8,
      notes: 5,
      bookmarks: 3,
      bookmarksByExtension: 1,
      bookmarksByWeb: 2,
      sourceBreakdown: {
        extension: 2,
        web: 14,
        byType: [
          { type: "Todos", extension: 1, web: 7 },
          { type: "Notes", extension: 0, web: 5 },
          { type: "Bookmarks", extension: 1, web: 2 },
          { type: "Events", extension: 0, web: 0 },
        ],
      },
      events: 0,
      topHashtags: [],
      canvasActiveDays: 0,
      canvasTotalArtifacts: 0,
      canvasDensity: 0,
      todosSparkline: [0, 1, 2],
      notesSparkline: [0, 1, 2],
      bookmarksSparkline: [0, 1, 2],
      eventsSparkline: [0, 1, 2],
    },
    heatmap: { days: [] },
    comparison: null,
    folderHighlights: {
      notes: { name: "Ideas", count: 12 },
      bookmarks: { name: "Research", count: 9 },
    },
    streaks: { currentStreak: 4, longestStreak: 11 },
    timingHighlights: {
      averageDayLabel: "Tue",
      averageHourLabel: "around 3pm",
      peakDayLabel: "Wed",
      peakHourLabel: "4pm",
    },
    favoriteArtifact: { type: "notes", count: 5 },
  }),
}));

vi.mock("../app/AppProvider", () => ({
  useApp: () => ({
    state: {
      noteFolders: [{ id: "folder_1", name: "Ideas" }],
      bookmarkCategories: [{ id: "cat_1", name: "Research" }],
      todos: [],
      notes: [],
      bookmarks: [],
      events: [],
    },
  }),
}));

vi.mock("../components/layout/useTopChrome", () => ({
  useTopChrome: vi.fn(),
}));

vi.mock("../components/ModalPortal", () => ({
  ModalPortal: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

describe("InsightsScreen highlights", () => {
  beforeEach(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn(() => ({
        matches: true,
        media: "(max-width: 767px)",
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  it("renders the stat cards", () => {
    render(<InsightsScreen />);

    expect(screen.getByText("Completion")).toBeInTheDocument();
    expect(screen.getByText("Active streak")).toBeInTheDocument();
    expect(screen.getByText("Median time-to-complete")).toBeInTheDocument();
    expect(screen.getByText("Notes momentum")).toBeInTheDocument();
    expect(screen.getByText("Peak hours")).toBeInTheDocument();
    expect(screen.getByText("Day distribution")).toBeInTheDocument();
  });
});
