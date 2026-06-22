# Download Dropdown Landing Update Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update the landing page copy so the hero promo points to the desktop app section, and replace the top-nav `Extension` link with a `Download` dropdown containing `Extension` and `Desktop app`.

**Architecture:** Keep the landing page structure unchanged. Add a small, self-contained dropdown state inside `src/screens/LandingScreen.tsx` so the nav can reveal the two existing internal destinations without introducing a new shared menu abstraction. Reuse the current landing section anchors (`#extension` and `#desktop`) so the page remains consistent and deep-linkable.

**Tech Stack:** React, TypeScript, Tailwind CSS, React Router, existing `useOutsideClick` helper.

---

### Task 1: Wire the landing-page copy to the desktop app section

**Files:**
- Modify: `src/screens/LandingScreen.tsx`
- Test: `src/screens/LandingScreen.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
it("links the hero desktop promo to the desktop section", () => {
  render(
    <MemoryRouter>
      <LandingScreen />
    </MemoryRouter>,
  );

  expect(screen.getByRole("link", { name: /Desktop apps now available for any OS/i })).toHaveAttribute(
    "href",
    "#desktop",
  );
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- src/screens/LandingScreen.test.tsx`
Expected: FAIL because the hero promo still points at the extension section.

- [ ] **Step 3: Write the minimal implementation**

```tsx
<a
  href="#desktop"
  className="mt-4 inline-flex items-center gap-1.5 text-[13px] text-app-ink-faint hover:text-app-ink-muted transition-colors"
>
  <Monitor size={14} />
  <span>Desktop apps now available for any OS</span>
  <span className="text-app-ink-faint">→</span>
</a>
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- src/screens/LandingScreen.test.tsx`
Expected: PASS.

### Task 2: Replace the top-nav extension link with a download dropdown

**Files:**
- Modify: `src/screens/LandingScreen.tsx`
- Test: `src/screens/LandingScreen.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
it("opens a download dropdown with extension and desktop app links", () => {
  render(
    <MemoryRouter>
      <LandingScreen />
    </MemoryRouter>,
  );

  fireEvent.click(screen.getByRole("button", { name: /Download/i }));

  expect(screen.getByRole("link", { name: /Extension/i })).toHaveAttribute("href", "#extension");
  expect(screen.getByRole("link", { name: /Desktop app/i })).toHaveAttribute("href", "#desktop");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- src/screens/LandingScreen.test.tsx`
Expected: FAIL because the top nav still renders a single `Extension` link.

- [ ] **Step 3: Write the minimal implementation**

```tsx
function DownloadNavDropdown() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useOutsideClick(menuRef, open, () => setOpen(false));

  return (
    <div ref={menuRef} className="relative hidden sm:block">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((current) => !current)}
        className="inline-flex items-center gap-1.5 text-sm text-app-ink-muted hover:text-app-ink transition-colors font-medium"
      >
        <Download className="h-4 w-4" />
        Download
        <ChevronDown className="h-3.5 w-3.5" />
      </button>
      {open ? (
        <div className="absolute left-0 top-full mt-3 w-48 rounded-2xl border border-app-line bg-app-surface p-2 shadow-soft">
          <a className="block rounded-app-panel px-app-field-x py-app-field-y text-sm text-app-ink-muted hover:bg-app-surface-hover hover:text-app-ink" href="#extension">
            Extension
          </a>
          <a className="block rounded-app-panel px-app-field-x py-app-field-y text-sm text-app-ink-muted hover:bg-app-surface-hover hover:text-app-ink" href="#desktop">
            Desktop app
          </a>
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- src/screens/LandingScreen.test.tsx`
Expected: PASS.

