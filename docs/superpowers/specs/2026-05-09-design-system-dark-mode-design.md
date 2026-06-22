# Omanote Design System and Dark Mode Design

> **Status: IMPLEMENTED 2026-05-10** — See the companion plan at `docs/superpowers/plans/2026-05-09-design-system-dark-mode.md` for implementation details and deviation notes.

## Goal

Create a long-term design-system foundation for the authenticated Omanote web app, then implement synced light, dark, and system theme preferences on top of that foundation.

## Scope

This design covers the authenticated web app first: app shell, bottom navigation, profile menu, settings, shared primitives, shared surfaces, and the core workspace screens. Public/auth pages and the browser extension are later follow-up phases. The extension has its own shell and CSS, so it should not block the authenticated web app migration.

## Design Principles

Tailwind remains the layout and utility compiler, but raw Tailwind color utilities should stop being the product design language. Components should express semantic intent with Omanote-owned web aliases such as `bg-app-canvas`, `bg-app-surface`, `text-app-ink`, and `border-app-line`.

The underlying token vocabulary should be platform-neutral so future Android and iOS apps can share the same conceptual model. Source tokens should use names such as `color.canvas`, `color.surface`, `color.surfaceRaised`, `color.ink`, `color.inkMuted`, `color.line`, and `color.focus`. Web output should expose those as CSS variables such as `--color-canvas`, `--color-surface`, `--color-ink`, and `--color-line`, then map them into Tailwind as `app-*` classes.

Token names should be clear and intentional, not poetic. The goal is readable UI code that helps humans and AI contributors understand why a color exists.

## Token Architecture

The design system should define a small semantic color vocabulary first:

- `canvas`: the page or full-screen app background.
- `surface`: the default panel, card, modal, drawer, and input background.
- `surfaceRaised`: elevated overlays such as dropdowns, profile menus, and dialogs.
- `surfaceMuted`: lower-emphasis bands, chips, segmented controls, and subtle fills.
- `surfaceHover`: hover and selected-muted states.
- `ink`: primary text and icons.
- `inkMuted`: secondary text and icons.
- `inkFaint`: placeholders, disabled text, and quiet metadata.
- `inkInverted`: text on dark/action backgrounds.
- `line`: default borders and dividers.
- `lineStrong`: active borders and higher-contrast separators.
- `focus`: focus rings and keyboard focus outlines.

Intent tokens should stay separate from app neutrals:

- `action.primary`, `action.primaryHover`, `action.primaryInk`.
- `danger.surface`, `danger.line`, `danger.ink`, `danger.solid`.
- `success.surface`, `success.line`, `success.ink`, `success.solid`.
- `warning.surface`, `warning.line`, `warning.ink`, `warning.solid`.
- `info.surface`, `info.line`, `info.ink`, `info.solid`.

The first pass should avoid a large token taxonomy. New tokens should be added only when a real component cannot be expressed clearly with the existing vocabulary.

## Web Mapping

Tailwind should expose semantic utilities backed by CSS variables:

- `bg-app-canvas`
- `bg-app-surface`
- `bg-app-surface-raised`
- `bg-app-surface-muted`
- `bg-app-surface-hover`
- `text-app-ink`
- `text-app-ink-muted`
- `text-app-ink-faint`
- `text-app-ink-inverted`
- `border-app-line`
- `border-app-line-strong`
- `ring-app-focus`
- `bg-action-primary`
- `hover:bg-action-primary-hover`
- `text-action-primary-ink`
- `bg-danger-surface`
- `text-danger-ink`
- `border-danger-line`

The CSS variable values should live in `src/index.css` under `:root` for light mode and `.dark` for dark mode. The Tailwind config should map these variables with alpha support using `rgb(var(--token-name) / <alpha-value>)`.

## Theme Preference

The user preference should support three modes:

- `system`
- `light`
- `dark`

The preference should sync through the existing Convex `userSettings` table. A localStorage mirror should also be used so the correct theme can be applied before React and Convex settings finish loading. This prevents a first-load flash of the wrong theme.

The app should apply the effective theme by toggling `.dark` on `document.documentElement`. It should also set `document.documentElement.style.colorScheme` to `light` or `dark` so native controls, scrollbars, and browser-rendered form elements match the selected theme.

When `themeMode` is `system`, the effective theme should follow `prefers-color-scheme` and update if the operating system theme changes while the app is open.

## Data Model

Add `themeMode: "system" | "light" | "dark"` to the shared frontend user settings model and Convex user settings model. Existing users should normalize to `system` when the stored value is missing or invalid.

Convex changes should follow the project’s Convex guidelines:

- Define schema changes in `convex/schema.ts`.
- Add validators for mutation args.
- Derive the authenticated user server-side.
- Continue using the existing `by_userId` lookup and `upsertMySettings` mutation.

## Component Primitives

The design-system pass should upgrade existing primitives and add small missing ones:

- `Button`
- `Input`
- `Select`
- `TextArea`
- `Switch`
- `MenuItem`
- `Panel`
- `DialogSurface`
- `DrawerSurface`

These primitives should encode repeated styling for backgrounds, text, borders, hover states, focus states, disabled states, and selected states. Screens should use these primitives where they represent a common interaction. One-off layout remains acceptable when a primitive would make the code less clear.

## Migration Strategy

The migration should be gradual but measurable.

First migrate foundation surfaces:

- `src/components/ui.tsx`
- `src/components/layout/AppShell.tsx`
- `src/components/layout/BottomNav.tsx`
- `src/screens/SettingsScreen.tsx`
- shared modal, drawer, toast, banner, and empty-state components

Then migrate core workspace screens in batches:

- Canvas
- Todos
- Notes
- Bookmarks
- Event
- Explore

After the authenticated app is migrated, public/auth pages can move to the same token system. The browser extension should be handled later because it has a separate CSS and application shell.

## Audit Strategy

Add a lightweight color-audit script that reports raw light-mode Tailwind color usage in authenticated app code, especially patterns such as `bg-white`, `text-zinc-900`, `border-zinc-200`, `bg-zinc-50`, and `text-zinc-500`.

The audit should start as a reporting tool so migration progress is visible without blocking useful work. Once the main authenticated surfaces are migrated, the audit can become a test or CI gate for changed files or the full authenticated app source.

## Testing Strategy

Tests should cover the design-system behavior rather than screenshot-perfect color values.

Unit tests should verify:

- user settings normalize invalid or missing `themeMode` to `system`;
- Convex user settings insert and patch `themeMode`;
- theme helpers resolve effective theme for `system`, `light`, and `dark`;
- root theme application toggles `.dark` and `color-scheme` correctly;
- the profile menu can change theme preference.

Existing component tests around the profile drawer should be extended rather than duplicated. Visual verification should include running the app and checking the authenticated shell, settings, profile menu, and at least one core workspace screen in both light and dark mode.

## Non-Goals

This phase does not redesign Omanote’s product layout. It does not migrate the browser extension. It does not require every public/auth screen to be dark-mode ready before the authenticated app foundation lands. It does not introduce a large external design-system dependency.

## Open Decisions Resolved

- Use synced theme preference through Convex.
- Support `system`, `light`, and `dark`.
- Use platform-neutral source token names.
- Use CSS variables for web theme values.
- Use `app-*` Tailwind aliases for web component classes.
- Start with a gradual migration plus reporting audit, not a hard enforcement gate.
- Include shared primitives in the first pass.
