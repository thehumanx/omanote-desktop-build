# Insights Highlights Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a sharper Insights summary that shows most active folders, all-time streaks, exact and average peak activity timing, and the favorite created artifact type.

**Architecture:** Keep the new metrics in the existing local insights pipeline so they update automatically from Dexie without adding new backend tables. Extend the shared insight helpers with small, explicit aggregation functions for folder activity, streaks, and timing summaries, then surface the results in the Insights screen as a compact highlight group that complements the existing heatmap and content cards.

**Tech Stack:** React 18, TypeScript, Dexie, Convex-backed local sync, Vitest

---

## Reference Docs

- Current insights data flow: `src/app/insights-local.ts`
- Current insights UI: `src/screens/InsightsScreen.tsx`
- Current header stat hook: `src/components/layout/PageHeader.tsx`
- Local cache schema: `src/app/db.ts`
- Existing insights schema/data source context: `convex/insights.ts`

## File Structure

- Modify: `src/app/insights-local.ts` - add aggregation helpers and extend the `useLocalInsights` return shape with new highlight metrics.
- Modify: `src/screens/InsightsScreen.tsx` - render the new highlight cards and any supporting labels/copy.
- Modify: `src/components/layout/PageHeader.tsx` - decide whether any of the new metrics should be available as a rotating or selectable header stat.
- Modify: `src/design-system` or existing shared UI primitives only if a small reusable highlight card component is clearly worth extracting.
- Test: `src/app/insights-local.test.ts` - unit tests for the new aggregation logic.
- Test: `src/screens/InsightsScreen.test.tsx` - smoke tests for rendering the new insights section, if there is already screen-level coverage nearby.

## Metric Definitions

- `Most active notes folder`: the note folder with the highest number of non-deleted notes created in it during the selected period.
- `Most active bookmark category`: the bookmark category with the highest number of non-deleted bookmarks created in it during the selected period.
- `Current streak`: the current all-time streak of consecutive active days, ending today or yesterday.
- `Longest streak`: the all-time maximum consecutive active-day streak.
- `Average peak day/time`: a weighted average of created-item activity, rendered as a readable weekday + hour summary.
- `Specific peak day/time`: the exact weekday/hour bucket with the highest created-item count.
- `Favorite artifact type`: the item type with the highest creation count across the selected period, using `notes`, `bookmarks`, and `todos`.

---

### Task 1: Add insight aggregation helpers

**Files:**
- Modify: `src/app/insights-local.ts`
- Test: `src/app/insights-local.test.ts`

- [ ] **Step 1: Write the failing helper tests**

Add tests that cover:

```ts
describe("insights highlight helpers", () => {
  it("returns the most active note folder and bookmark category by created count", () => {
    expect(
      buildFolderActivityHighlights([
        { kind: "note", folderId: "f1", folderName: "Ideas", createdAt: 1000, deletedAt: undefined },
        { kind: "note", folderId: "f1", folderName: "Ideas", createdAt: 2000, deletedAt: undefined },
        { kind: "note", folderId: "f2", folderName: "Work", createdAt: 3000, deletedAt: undefined },
        { kind: "bookmark", folderId: "c1", folderName: "Research", createdAt: 4000, deletedAt: undefined },
        { kind: "bookmark", folderId: "c1", folderName: "Research", createdAt: 5000, deletedAt: undefined },
        { kind: "bookmark", folderId: "c2", folderName: "Recipes", createdAt: 6000, deletedAt: undefined },
      ]),
    ).toMatchObject({
      notes: { name: "Ideas", count: 2 },
      bookmarks: { name: "Research", count: 2 },
    });
  });

  it("computes current and longest all-time streaks from activity dates", () => {
    expect(
      buildStreakHighlights([
        "2026-06-01",
        "2026-06-02",
        "2026-06-03",
        "2026-06-05",
      ], "2026-06-05"),
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
```

- [ ] **Step 2: Run the tests to verify the current implementation fails**

Run: `npm test -- src/app/insights-local.test.ts`

Expected: FAIL because the helper exports do not exist yet.

- [ ] **Step 3: Implement the helper functions**

Add focused helpers in `src/app/insights-local.ts` for:

```ts
export function buildFolderActivityHighlights(...)
export function buildStreakHighlights(...)
export function buildTimingHighlights(...)
export function buildFavoriteArtifactType(...)
```

Keep the helpers deterministic and based only on the already-cached Dexie rows. Reuse the existing date bucketing logic where possible so the new metrics stay consistent with the current charts.

- [ ] **Step 4: Run the helper tests again**

Run: `npm test -- src/app/insights-local.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the helper work**

Run:

```bash
git add src/app/insights-local.ts src/app/insights-local.test.ts
git commit -m "feat: add insights highlight aggregations"
```

Expected: commit succeeds.

### Task 2: Surface the new metrics in the Insights screen

**Files:**
- Modify: `src/screens/InsightsScreen.tsx`
- Modify: `src/components/layout/PageHeader.tsx`

- [ ] **Step 1: Write the failing screen test**

Add or extend a screen test that renders the Insights page with mocked local insight data and asserts the new highlight labels are present.

```ts
expect(screen.getByText("Most active notes folder")).toBeInTheDocument();
expect(screen.getByText("Current streak")).toBeInTheDocument();
expect(screen.getByText("Average peak time")).toBeInTheDocument();
expect(screen.getByText("Favorite artifact type")).toBeInTheDocument();
```

- [ ] **Step 2: Run the screen test to verify it fails**

Run: `npm test -- src/screens/InsightsScreen.test.tsx`

Expected: FAIL because the screen does not render the new cards yet.

- [ ] **Step 3: Render the new highlight cards**

Update the insights layout so the new metrics appear as a compact highlight cluster near the top of the screen, above or alongside the existing heatmap section. Keep the copy specific and human-readable:

```tsx
<InsightCard label="Most active notes folder" value={folderHighlights.notes?.name ?? "None"} subvalue={folderHighlights.notes ? `${folderHighlights.notes.count} saves` : "No data"} />
<InsightCard label="Current streak" value={`${streaks.currentStreak}d`} subvalue="all-time active days" />
<InsightCard label="Longest streak" value={`${streaks.longestStreak}d`} subvalue="personal best" />
<InsightCard label="Average peak time" value={timing.averageDayLabel} subvalue={timing.averageHourLabel} />
<InsightCard label="Specific peak time" value={timing.peakDayLabel} subvalue={timing.peakHourLabel} />
<InsightCard label="Favorite artifact type" value={favoriteArtifact.type} subvalue={`${favoriteArtifact.count} created`} />
```

If `PageHeader` should expose one of the new stats, wire the new local stat through the existing `PageStat` union and make sure the selected label is concise.

- [ ] **Step 4: Run the screen test again**

Run: `npm test -- src/screens/InsightsScreen.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit the UI work**

Run:

```bash
git add src/screens/InsightsScreen.tsx src/components/layout/PageHeader.tsx
git commit -m "feat: expand insights highlights"
```

Expected: commit succeeds.

### Task 3: Verify the updated insights behavior end to end

**Files:**
- Existing test suite only

- [ ] **Step 1: Run the focused insights tests**

Run:

```bash
npm test -- src/app/insights-local.test.ts src/screens/InsightsScreen.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run the type checker**

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 3: Review the Insights page manually**

Open the app and check that:

```text
- the new cards read naturally with the existing stats
- empty-state values do not feel noisy
- the average peak label is understandable at a glance
- the exact peak label is more specific than the average label
```

- [ ] **Step 4: Commit any final polish**

If the manual review reveals copy or layout tweaks, apply them and commit the final polish in a single small commit.

Expected: the Insights screen feels like a coherent extension of the current analytics surface rather than a separate dashboard.

