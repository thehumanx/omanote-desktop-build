// @vitest-environment edge-runtime

import { describe, expect, it } from "vitest";
import {
  buildFavoriteArtifactType,
  buildFolderActivityHighlights,
  buildStreakHighlights,
  buildTimingHighlights,
} from "./insights-local";

describe("insights highlight helpers", () => {
  it("returns the most active note folder and bookmark category by created count", () => {
    expect(
      buildFolderActivityHighlights([
        { kind: "notes", folderId: "f1", folderName: "Ideas", createdAt: 1000, deletedAt: undefined },
        { kind: "notes", folderId: "f1", folderName: "Ideas", createdAt: 2000, deletedAt: undefined },
        { kind: "notes", folderId: "f2", folderName: "Work", createdAt: 3000, deletedAt: undefined },
        { kind: "bookmarks", folderId: "c1", folderName: "Research", createdAt: 4000, deletedAt: undefined },
        { kind: "bookmarks", folderId: "c1", folderName: "Research", createdAt: 5000, deletedAt: undefined },
        { kind: "bookmarks", folderId: "c2", folderName: "Recipes", createdAt: 6000, deletedAt: undefined },
      ]),
    ).toMatchObject({
      notes: { name: "Ideas", count: 2 },
      bookmarks: { name: "Research", count: 2 },
    });
  });

  it("computes current and longest all-time streaks from activity dates", () => {
    expect(
      buildStreakHighlights(["2026-06-01", "2026-06-02", "2026-06-03", "2026-06-05", "2026-06-06"], "2026-06-06"),
    ).toEqual({
      currentStreak: 2,
      longestStreak: 3,
    });
  });

  it("computes both average and exact peak day/time summaries", () => {
    expect(
      buildTimingHighlights([
        { createdAt: new Date("2026-06-02T09:00:00").getTime() },
        { createdAt: new Date("2026-06-02T09:30:00").getTime() },
        { createdAt: new Date("2026-06-03T15:00:00").getTime() },
      ]),
    ).toMatchObject({
      averageDayLabel: "Tue",
      averageHourLabel: "around 11am",
      peakDayLabel: "Tue",
      peakHourLabel: "9am",
    });
  });

  it("returns the most created artifact type", () => {
    expect(
      buildFavoriteArtifactType({
        todos: 2,
        notes: 5,
        bookmarks: 3,
      }),
    ).toEqual({
      type: "notes",
      count: 5,
    });
  });
});
