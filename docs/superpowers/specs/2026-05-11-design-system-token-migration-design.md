# omanote Design System Token Migration Design

## Goal

Migrate omanote's visual system to a complete semantic token layer that covers the main React app, public/landing surfaces, browser extension popup, save modal, and injected content bubble.

The system should keep the current pattern: custom semantic omanote tokens layered on top of Tailwind. Tailwind remains the utility authoring surface, but repeated product decisions such as colors, spacing, radius, shadows, motion, z-index, fields, panels, dialogs, drawers, tabs, and buttons should come from named app tokens.

## Current State

The repo currently has three token surfaces:

- `src/design-system/tokens.ts` documents colors and some typography, spacing, radius, shadows, motion, and z-index.
- `src/index.css` defines light and dark CSS variables, mostly for color plus shadows.
- `tailwind.config.ts` exposes semantic colors and a few shadows as Tailwind utilities.
- `extension/shared/colors.ts`, `extension/shared/color-vars.ts`, `extension/popup/popup.css`, and `extension/content/bubble-styles.ts` maintain a parallel extension color and shadow vocabulary.

There are already useful primitives in `src/components/ui.tsx`: `Button`, `Badge`, `Chip`, `Input`, `TextArea`, `Select`, `Switch`, `MenuItem`, `Panel`, `DialogSurface`, and `DrawerSurface`. Many screens still use raw Tailwind values, arbitrary radii, arbitrary shadows, custom cubic-bezier values, and direct `z-[...]` utilities.

## Naming Principles

Token names should extend the existing color style. They should be semantic, product-specific, and readable in Tailwind classes.

Examples:

- Colors: `app.canvas`, `app.surface`, `action.primary`, `danger.ink`.
- Spacing: `app.pageX`, `app.sectionGap`, `field.x`, `field.y`, `card.padding`, `menu.itemGap`.
- Radius: `field`, `chip`, `panel`, `card`, `dialog`, `drawer`, `full`.
- Shadows: `soft`, `nav`, `navActive`, `navActiveInset`, `menu`, `dialog`, `drawer`, `bubble`.
- Motion: `fast`, `base`, `slow`, `drawer`, `out`, `inOut`, `drawer`.
- Z-index: `topBar`, `bottomNav`, `overlay`, `drawer`, `dialog`, `toast`, `linkedArtifactSheet`, `extensionOverlay`.

Tailwind utility names should preserve the app prefix pattern:

- `px-app-page`
- `gap-app-section`
- `rounded-app-field`
- `rounded-app-panel`
- `shadow-app-dialog`
- `duration-app-fast`
- `ease-app-out`
- `z-app-dialog`

Generic Tailwind utilities may remain for local layout mechanics, especially grid/flex sizing and one-off spacing. Repeated visual decisions should use custom tokens.

## Token Architecture

`src/design-system/tokens.ts` becomes the typed source of truth for the token contract. It should organize values by intent:

- `color`
- `typography`
- `spacing`
- `radius`
- `shadow`
- `motion`
- `zIndex`
- `component`

`component` should describe reusable component-level decisions that do not fit cleanly into a primitive scale, such as field height, icon button size, segmented control padding, and modal width presets.

`src/index.css` should expose these tokens as CSS variables for runtime theming and CSS-only surfaces. Color variables continue to support light and dark mode. Non-color variables should live in `:root` unless they need different dark-mode values, such as shadows.

`tailwind.config.ts` should expose token variables as first-class custom Tailwind utilities. This keeps the current app authoring style and lets component code stay readable.

Extension CSS should consume the same token contract through CSS variables and typed constants. The extension can keep a small compatibility bridge during migration, but the final vocabulary should not be a separate `EXT_COLORS` design language.

## Component Migration

The first implementation target is the shared primitive layer:

- `Button`
- `Input`
- `TextArea`
- `Select`
- `Badge`
- `Chip`
- `Switch`
- `MenuItem`
- `Panel`
- `DialogSurface`
- `DrawerSurface`
- `LoadingSpinner`

The migration should also introduce or formalize these primitives if they fit the existing code cleanly:

- `IconButton`
- `SegmentedControl` or segmented-control helper classes
- shared loading or empty-state surface helpers

These primitives should use app token utilities instead of raw radius, spacing, shadow, and motion values.

## App Migration

After primitives are tokenized, migrate high-repeat app surfaces before low-repeat one-offs:

- modal/editor shells
- cards and list rows
- app shell, bottom nav, side navigation, date strip, and top chrome
- settings panels and rows
- notes/todos drawers and overlays
- segmented controls in todos and landing previews
- loading states and empty states
- landing/public mockups and marketing UI where they reflect product UI

Public marketing surfaces may still use deliberate composition-specific layout values, but product-like mockups should use app tokens so the public site visually matches the real app.

## Extension Migration

The extension must be included in the migration:

- popup UI
- settings view
- auth screen
- save form
- iframe save modal
- injected selection bubble
- injected modal shell

Extension CSS cannot rely on the app's DOM or Tailwind runtime, so it should receive generated or shared CSS variables. The packaged Lato font behavior must remain intact. Extension tests should continue to ensure raw colors are centralized and bubble styles do not duplicate local token maps.

## Guardrails And Tests

Add or update tests around:

- token names and CSS variable generation
- key Tailwind token exposure
- UI primitive class output
- popup CSS token usage
- bubble CSS token usage

Add or expand an audit script to flag raw visual constants outside approved token files:

- hex colors
- `rgb()` and `rgba()`
- arbitrary shadows
- arbitrary rounded values
- repeated cubic-bezier curves
- direct high z-index values

The audit should allow intentional exceptions for:

- generated assets and favicons
- data URLs
- canvas drawing utilities where typed tokens are imported
- local layout dimensions that are not visual identity decisions

## Migration Order

1. Expand `src/design-system/tokens.ts` and add tests for the token contract.
2. Expose spacing, radius, shadow, motion, and z-index tokens in `src/index.css` and `tailwind.config.ts`.
3. Update `src/components/ui.tsx` and its tests to use the new token utilities.
4. Create extension token exports or a compatibility bridge that maps the shared contract to extension CSS variables.
5. Migrate extension popup/save-modal/content-bubble styles and update extension CSS tests.
6. Migrate high-repeat app surfaces and public product mockups.
7. Add the broader design-token audit script and wire it into package scripts.
8. Run focused tests, typecheck, the audit script, and a production build.

## Acceptance Criteria

- The main app, public surfaces, browser extension, save modal, and injected content bubble all consume the same semantic token contract.
- Repeated spacing, radius, shadows, motion curves, and z-index values are named tokens rather than arbitrary literals.
- Existing semantic color names remain compatible with current app usage.
- Tailwind remains the primary app authoring surface, with custom omanote utilities layered on top.
- Extension styling remains isolated and works without depending on the app DOM.
- Existing dark-mode behavior is preserved.
- Tests cover token generation, primitives, extension CSS, and token audit behavior.
- Typecheck, relevant Vitest suites, token audit, and build pass before completion.

## Out Of Scope

- A full visual redesign.
- Rewriting all app screens into a new component library in one pass.
- Removing Tailwind.
- Changing Convex/backend behavior.
- Changing user-facing workflows except where a component migration requires preserving the same behavior through shared primitives.
