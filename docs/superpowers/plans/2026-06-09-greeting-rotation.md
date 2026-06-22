# Greeting Rotation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the header greeting system into a large, time-aware catalog that rotates deterministically and still renders a short mobile version.

**Architecture:** Move greeting data and selection logic into a focused layout helper, keep `PageHeader` responsible for rendering only, and preserve the current mobile/desktop split by deriving the short form from the selected full greeting.

**Tech Stack:** React, TypeScript, Vitest, date-based pure helper functions

---

### Task 1: Add a greeting helper module

**Files:**
- Create: `src/components/layout/greetings.ts`
- Modify: `src/components/layout/PageHeader.tsx`
- Test: `src/components/layout/PageHeader.test.tsx` or existing header test file

- [ ] **Step 1: Write the failing test**

```ts
it("selects a greeting from the correct time bucket and keeps it deterministic for a date", () => {
  const greeting = getGreetingForDate(new Date("2026-06-09T09:00:00Z"), "Bibek");
  expect(greeting.full).toMatch(/Bibek$/);
  expect(greeting.short).toMatch(/Bibek$/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/components/layout/PageHeader.test.tsx`
Expected: FAIL because `getGreetingForDate` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

```ts
export function getGreetingForDate(date: Date, name: string) {
  return { full: `☀️ Good morning, ${name}`, short: `☀️ ${name}` };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/components/layout/PageHeader.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/greetings.ts src/components/layout/PageHeader.tsx src/components/layout/PageHeader.test.tsx docs/superpowers/plans/2026-06-09-greeting-rotation.md
git commit -m "feat: expand header greetings"
```

