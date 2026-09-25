/**
 * omanote Design Tokens
 *
 * Typed access to colour and motion values for contexts Tailwind can't reach
 * (inline `style={}` props, canvas drawing, JS-driven animation).
 *
 * The source of truth for spacing, radius, shadow, z-index and component
 * metrics is the CSS variables in src/index.css, exposed as utilities by
 * tailwind.config.ts. They used to be mirrored here as TS objects too, but
 * nothing read the mirror, so it could only drift.
 */


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

  // Brand accents used on public/marketing and onboarding surfaces.
  //
  // Deliberately flat hex rather than themed CSS vars: like a logo, these stay
  // the same green in light and dark. That is why they are consumed as imported
  // constants (see CTA_BG in LandingScreen) instead of Tailwind `app-*` classes.
  // There used to be a second, separately-picked green (#5A8B16) on the
  // landing CTA. It and this one were 1.21 ΔE apart — below the threshold
  // where the two are distinguishable side by side — so they were collapsed
  // into this single brand green.
  brandCta: "#578910",
  /**
   * Darker shade for the CTA's border and hover state. Kept from when the base
   * was #5A8B16; re-deriving it against the new base lands on #48700D, a
   * smaller shift than the one it would be correcting.
   */
  brandCtaHover: "#4a7212",
  /** Text on the filled CTA, and the surface of the inverted one. */
  brandCtaInk: "#ffffff",
  /** Hairline border on the inverted CTA. */
  brandCtaHairline: "rgba(0,0,0,0.08)",
  /** Onboarding "connected" pill background. */
  brandCtaTint: "#EEF4E4",
  /** Landing closing-CTA section background. */
  brandCtaWash: "#F7FCF1",
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
    in: "cubic-bezier(0.55, 0.055, 0.675, 0.19)", // easeInCubic — entrances that accelerate away
    out: "cubic-bezier(0.23, 1, 0.32, 1)",   // easeOutExpo — exits, collapses
    inOut: "cubic-bezier(0.77, 0, 0.175, 1)", // easeInOutCubic — nav transitions
    drawer: "cubic-bezier(0.32, 0.72, 0, 1)", // iOS-style drawer
  },
} as const;
