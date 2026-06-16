/**
 * omanote Design Tokens
 *
 * Single source of truth for all visual constants. Tailwind utilities are the
 * primary authoring surface; these tokens exist to document intent and to give
 * non-Tailwind contexts (e.g. inline styles, Canvas API) typed access to values.
 *
 * HOW TO USE
 * ----------
 * - In JSX/TSX: prefer Tailwind utilities that map to these tokens.
 * - For inline `style={}` props or canvas drawing: import from this file.
 * - When adding a new value: add it here AND in tailwind.config.ts if it
 *   needs a utility class.
 */

export const themeTokenNames = {
  color: {
    canvas: "--color-canvas",
    surface: "--color-surface",
    surfaceRaised: "--color-surface-raised",
    surfaceMuted: "--color-surface-muted",
    surfaceHover: "--color-surface-hover",
    ink: "--color-ink",
    inkMuted: "--color-ink-muted",
    inkFaint: "--color-ink-faint",
    inkInverted: "--color-ink-inverted",
    line: "--color-line",
    lineStrong: "--color-line-strong",
    focus: "--color-focus",
  },
  intent: {
    actionPrimary: "--color-action-primary",
    dangerSurface: "--color-danger-surface",
    dangerSolidHover: "--color-danger-solid-hover",
    dangerSolidLine: "--color-danger-solid-line",
    dangerSolidInk: "--color-danger-solid-ink",
    successSurface: "--color-success-surface",
    warningSurface: "--color-warning-surface",
    infoSurface: "--color-info-surface",
  },
} as const;

// ─── Color ────────────────────────────────────────────────────────────────────
export const color = {
  // Neutrals — zinc scale
  white: "#ffffff",
  zinc50: "#fafafa",
  zinc100: "#f4f4f5",
  zinc200: "#e4e4e7",
  zinc300: "#d4d4d8",
  zinc400: "#a1a1aa",
  zinc500: "#71717a",
  zinc600: "#52525b",
  zinc700: "#3f3f46",
  zinc800: "#27272a",
  zinc900: "#18181b",
  zinc950: "#09090b",

  // Semantic
  border: "#e4e4e7",        // zinc-200 — default border
  borderSubtle: "#f4f4f5",  // zinc-100 — de-emphasized border
  text: "#18181b",          // zinc-900 — primary text
  textMuted: "#71717a",     // zinc-500 — supporting text
  textPlaceholder: "#a1a1aa", // zinc-400
  bg: "#ffffff",            // page background
  bgSubtle: "#fafafa",      // zinc-50 — tinted surfaces
  bgMuted: "#f4f4f5",       // zinc-100 — chips, pills

  // Intent
  danger: "#dc2626",        // red-600
  dangerHover: "#b91c1c",   // red-700
  dangerBg: "#fef2f2",      // red-50
  dangerBorder: "#fecaca",  // red-200
  dangerText: "#b91c1c",    // red-700

  success: "#059669",       // emerald-600
  successBg: "#ecfdf5",     // emerald-50
  successBorder: "#a7f3d0", // emerald-200
  successText: "#047857",   // emerald-700

  info: "#2563eb",          // blue-600 (used for linked-artifact hover)
  infoBorder: "#93c5fd",    // blue-300
  infoText: "#2563eb",

  warning: "#f59e0b",       // amber-500
  warningBg: "#fffbeb",     // amber-50

  // Brand accents used on public/marketing surfaces.
  brandCta: "#5A8B16",
  brandCtaHover: "#4a7212",
} as const;

// ─── Typography ───────────────────────────────────────────────────────────────

export const typography = {
  fontFamily: '"Lato", ui-sans-serif, system-ui, sans-serif',
  fontFamilySerif: '"Aleo", Georgia, ui-serif, serif',
  fontFamilySerifHeading: '"Aleo", Georgia, ui-serif, serif',

  // Scale (px values match Tailwind's default rem scale)
  size: {
    xs: "0.75rem",   // 12px
    sm: "0.875rem",  // 14px
    base: "1rem",    // 16px
    lg: "1.125rem",  // 18px
    xl: "1.25rem",   // 20px
  },

  weight: {
    regular: "400",
    bold: "700",
    black: "900",
  },

  leading: {
    tight: "1.25",
    snug: "1.375",
    normal: "1.5",
    relaxed: "1.625",
    loose: "1.75",
  },
} as const;

// ─── Spacing ──────────────────────────────────────────────────────────────────

export const spacing = {
  app: {
    pageX: "1rem",
    pageY: "1rem",
    sectionGap: "1.5rem",
    contentGap: "1rem",
    compactGap: "0.5rem",
  },
  field: {
    x: "0.75rem",
    y: "0.5rem",
    gap: "0.375rem",
  },
  card: {
    padding: "1rem",
    compactPadding: "0.75rem",
  },
  menu: {
    itemX: "0.75rem",
    itemY: "0.5rem",
    itemGap: "0.5rem",
  },
  layout: {
    contentMaxWidth: "1200px",
    settingsMaxWidth: "980px",
    searchMaxWidth: "600px",
  },

  // Component padding
  cardPadding: "1rem",       // p-4
  cardPaddingCompact: "0.75rem", // p-3
  sectionGap: "1.5rem",     // gap-6
  inputPaddingX: "0.75rem", // px-3
  inputPaddingY: "0.5rem",  // py-2

  // Layout
  contentMaxWidth: "1200px",
  settingsMaxWidth: "980px",
  searchMaxWidth: "600px",
} as const;

// ─── Border radius ────────────────────────────────────────────────────────────

export const radius = {
  app: {
    field: "0.375rem",
    button: "0.5rem",
    chip: "9999px",
    panel: "0.75rem",
    card: "1rem",
    dialog: "1rem",
    drawer: "1rem",
    full: "9999px",
  },

  sm: "0.375rem",  // rounded-md — inputs, selects, small chips
  md: "0.75rem",   // rounded-xl — menu items, settings rows
  lg: "1rem",      // rounded-2xl — cards, modals, drawers
  full: "9999px",  // rounded-full — pills, avatars, tags
} as const;

// ─── Shadows ──────────────────────────────────────────────────────────────────
// These map to the custom shadow tokens in tailwind.config.ts

export const shadow = {
  app: {
    soft: "0 10px 30px rgba(0, 0, 0, 0.06)",
    nav: "0px 10px 30px 0px rgba(0, 0, 0, 0.08)",
    navActive: "0px 1px 4px 0px rgba(0, 0, 0, 0.4)",
    navActiveInset: "inset 0px 3px 4px 0px rgba(255, 255, 255, 0.25)",
    dangerActive: "0px 10px 30px rgba(185, 28, 28, 0.18), 0px 2px 8px rgba(185, 28, 28, 0.16)",
    dangerActiveInset: "inset 0px 3px 4px 0px rgba(255, 255, 255, 0.24)",
    menu: "0 18px 40px rgba(0, 0, 0, 0.12)",
    dialog: "0 24px 60px rgba(0, 0, 0, 0.18)",
    drawer: "0 -8px 40px rgba(0, 0, 0, 0.14)",
    bubble: "0 4px 16px rgba(0, 0, 0, 0.1), 0 1px 4px rgba(0, 0, 0, 0.06)",
    bubbleHover: "0 6px 20px rgba(0, 0, 0, 0.12)",
  },

  soft: "0 10px 30px rgba(0, 0, 0, 0.06)",   // shadow-soft   — cards
  nav: "0px 10px 30px 0px rgba(0,0,0,0.08)", // shadow-nav    — tab pill
  dangerActive: "0px 10px 30px rgba(185, 28, 28, 0.18), 0px 2px 8px rgba(185, 28, 28, 0.16)",
  dangerActiveInset: "inset 0px 3px 4px 0px rgba(255, 255, 255, 0.24)",
  menu: "0 18px 40px rgba(0,0,0,0.12)",       // shadow-menu   — dropdown menus
  dialog: "0 24px 60px rgba(0,0,0,0.18)",       // shadow-dialog — confirm dialogs
  drawer: "0 -8px 40px rgba(0,0,0,0.14)",       // shadow-drawer — bottom sheets
} as const;

// ─── Motion ───────────────────────────────────────────────────────────────────

export const motion = {
  duration: {
    fast: "150ms",
    base: "200ms",
    slow: "300ms",
    drawer: "360ms",
  },
  easing: {
    out: "cubic-bezier(0.23, 1, 0.32, 1)",   // easeOutExpo — exits, collapses
    inOut: "cubic-bezier(0.77, 0, 0.175, 1)", // easeInOutCubic — nav transitions
    drawer: "cubic-bezier(0.32, 0.72, 0, 1)", // iOS-style drawer
  },
} as const;

// ─── Z-index ──────────────────────────────────────────────────────────────────

export const zIndex = {
  app: {
    topBar: "40",
    bottomNav: "50",
    modal: "60",
    floating: "70",
    toast: "50",
    overlay: "80",
    drawer: "81",
    menu: "82",
    tooltip: "83",
    dialog: "90",
    popover: "100",
    linkedArtifactSheet: "120",
    extensionOverlay: "2147483646",
    extensionRoot: "2147483647",
  },

  topBar: 40,
  bottomNav: 50,
  toast: 50,
  overlay: 80,
  drawer: 81,
  dialog: 90,
  linkedArtifactSheet: 120,
} as const;

// ─── Component metrics ────────────────────────────────────────────────────────

export const component = {
  iconButton: {
    size: "2rem",
    compactSize: "1.75rem",
  },
  field: {
    minHeight: "2.5rem",
  },
  // Shared moving-pill chrome used by segmented controls across the app.
  // The gloss values stay tokenized so components can reuse the same surface
  // treatment without hardcoding gradients in JSX or CSS.
  segmented: {
    radius: "90px",
    padding: "0.375rem",
    itemRadius: "70px",
    labelGap: "0.375rem",
    highlightGlossStart: "rgba(255, 255, 255, 0.18)",
    highlightGlossEnd: "rgba(255, 255, 255, 0)",
    highlightGlossStop: "44%",
  },
  todoCheckmark: {
    size: "1.25rem",
    compactSize: "1rem",
    bleed: "0.375rem",
    textAlignOffset: "-0.125rem",
    compactTextAlignOffset: "0rem",
  },
} as const;
