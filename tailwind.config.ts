import type { Config } from "tailwindcss";

const cssVar = (name: string) => `rgb(var(${name}) / <alpha-value>)`;
/** A background colour scaled by an opacity variable — 1 normally, lower
 *  while a background scene is on (see :root[data-scene] in index.css). */
const sceneBg = (name: string, opacityVar: string) =>
  `rgb(var(${name}) / calc(<alpha-value> * var(${opacityVar}, 1)))`;
/** A card fill that, under a light scene, becomes a smoked-glass ink wash
 *  (--app-wash-rgb at washVar) instead of translucent white. Without the
 *  wash variables it is exactly sceneBg. */
const washBg = (name: string, washVar: string) =>
  `rgb(var(--app-wash-rgb, var(${name})) / calc(<alpha-value> * var(${washVar}, var(--app-surface-opacity, 1))))`;

export default {
  darkMode: "selector",
  content: ["./index.html", "./src/**/*.{ts,tsx}", "./packages/shared/src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Lato", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["var(--app-font-family)"],
        "serif-heading": ["var(--app-font-family-serif)"],
      },
      // Background utilities only: text and borders keep the plain tokens, so
      // nothing but surface fills goes translucent under a scene.
      backgroundColor: {
        app: {
          surface: washBg("--color-surface", "--app-wash-surface"),
          "surface-raised": washBg("--color-surface-raised", "--app-wash-surface"),
          "surface-muted": washBg("--color-surface-muted", "--app-wash-muted"),
          // Under a scene the hover is a faint ink wash (--app-hover-*), so a
          // hovered row tints whatever is behind it instead of going solid.
          "surface-hover": "rgb(var(--app-hover-rgb, var(--color-surface-hover)) / calc(<alpha-value> * var(--app-hover-opacity, var(--app-surface-opacity, 1))))",
          // A page fill that clears under a scene so the scene shows through.
          backdrop: sceneBg("--color-canvas", "--app-canvas-opacity"),
        },
      },
      colors: {
        app: {
          canvas: cssVar("--color-canvas"),
          surface: cssVar("--color-surface"),
          "surface-raised": cssVar("--color-surface-raised"),
          "surface-muted": cssVar("--color-surface-muted"),
          "surface-hover": cssVar("--color-surface-hover"),
          overlay: "var(--color-bg-overlay)",
          ink: cssVar("--color-ink"),
          "ink-muted": cssVar("--color-ink-muted"),
          "ink-faint": cssVar("--color-ink-faint"),
          "ink-inverted": cssVar("--color-ink-inverted"),
          // Under a scene, lines become a translucent ink (--app-line-*) so
          // borders and dividers tint the sky instead of outlining it in grey.
          line: "rgb(var(--app-line-rgb, var(--color-line)) / calc(<alpha-value> * var(--app-line-opacity, 1)))",
          "line-strong": "rgb(var(--app-line-rgb, var(--color-line-strong)) / calc(<alpha-value> * var(--app-line-strong-opacity, 1)))",
          focus: cssVar("--color-focus"),
        },
        nav: {
          active: cssVar("--color-nav-active"),
          "active-line": cssVar("--color-nav-active-border"),
          "active-ink": cssVar("--color-nav-active-ink"),
        },
        action: {
          primary: cssVar("--color-action-primary"),
          "primary-hover": cssVar("--color-action-primary-hover"),
          "primary-ink": cssVar("--color-action-primary-ink"),
        },
        danger: {
          surface: cssVar("--color-danger-surface"),
          line: cssVar("--color-danger-line"),
          ink: cssVar("--color-danger-ink"),
          solid: cssVar("--color-danger-solid"),
          "solid-hover": cssVar("--color-danger-solid-hover"),
          "solid-line": cssVar("--color-danger-solid-line"),
          "solid-ink": cssVar("--color-danger-solid-ink"),
        },
        success: {
          surface: cssVar("--color-success-surface"),
          line: cssVar("--color-success-line"),
          ink: cssVar("--color-success-ink"),
          solid: cssVar("--color-success-solid"),
        },
        warning: {
          surface: cssVar("--color-warning-surface"),
          line: cssVar("--color-warning-line"),
          ink: cssVar("--color-warning-ink"),
          solid: cssVar("--color-warning-solid"),
        },
        info: {
          surface: cssVar("--color-info-surface"),
          line: cssVar("--color-info-line"),
          ink: cssVar("--color-info-ink"),
          solid: cssVar("--color-info-solid"),
        },
      },
      spacing: {
        "app-page": "var(--space-app-page-x)",
        "app-section": "var(--space-app-section-gap)",
        "app-content": "var(--space-app-content-gap)",
        "app-compact": "var(--space-app-compact-gap)",
        "app-field-x": "var(--space-field-x)",
        "app-field-y": "var(--space-field-y)",
        "app-card": "var(--space-card-padding)",
        "app-card-compact": "var(--space-card-compact-padding)",
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        DEFAULT: "var(--radius-DEFAULT)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
        "2xl": "var(--radius-2xl)",
        "3xl": "var(--radius-3xl)",
        full: "var(--radius-full)",
        "app-field": "var(--radius-app-field)",
        "app-button": "var(--radius-app-button)",
        "app-chip": "var(--radius-app-chip)",
        "app-badge": "var(--radius-app-badge)",
        "app-panel": "var(--radius-app-panel)",
        "app-card": "var(--radius-app-card)",
        "app-dialog": "var(--radius-app-dialog)",
        "app-drawer": "var(--radius-app-drawer)",
        "app-icon": "var(--radius-app-icon)",
        "segmented-vertical": "var(--component-segmented-vertical-radius)",
      },
      boxShadow: {
        soft: "var(--shadow-soft)",
        nav: "var(--shadow-nav)",
        menu: "var(--shadow-menu)",
        dialog: "var(--shadow-dialog)",
        drawer: "var(--shadow-drawer)",
        "app-soft": "var(--shadow-app-soft)",
        "app-nav": "var(--shadow-app-nav)",
        "app-nav-active": "var(--shadow-app-nav-active)",
        "app-nav-active-inset": "var(--shadow-app-nav-active-inset)",
        "danger-active": "var(--shadow-danger-active)",
        "danger-active-inset": "var(--shadow-danger-active-inset)",
        "app-menu": "var(--shadow-app-menu)",
        "app-dialog": "var(--shadow-app-dialog)",
        "app-drawer": "var(--shadow-app-drawer)",
        "artifact-group": "var(--shadow-artifact-group)",
        "app-bubble": "var(--shadow-app-bubble)",
        "app-bubble-hover": "var(--shadow-app-bubble-hover)",
      },
      transitionDuration: {
        "app-fast": "var(--motion-duration-fast)",
        "app-base": "var(--motion-duration-base)",
        "app-slow": "var(--motion-duration-slow)",
        "app-drawer": "var(--motion-duration-drawer)",
      },
      transitionTimingFunction: {
        "app-in": "var(--motion-easing-in)",
        "app-out": "var(--motion-easing-out)",
        "app-in-out": "var(--motion-easing-in-out)",
        "app-drawer": "var(--motion-easing-drawer)",
      },
      zIndex: {
        "app-top-bar": "var(--z-app-top-bar)",
        "app-bottom-nav": "var(--z-app-bottom-nav)",
        "app-modal": "var(--z-app-modal)",
        "app-floating": "var(--z-app-floating)",
        "app-overlay": "var(--z-app-overlay)",
        "app-drawer": "var(--z-app-drawer)",
        "app-menu": "var(--z-app-menu)",
        "app-tooltip": "var(--z-app-tooltip)",
        "app-dialog": "var(--z-app-dialog)",
        "app-popover": "var(--z-app-popover)",
        "app-toast": "var(--z-app-toast)",
        "app-linked-artifact-sheet": "var(--z-app-linked-artifact-sheet)",
        "app-extension-root": "var(--z-app-extension-root)",
      },
    },
  },
  plugins: [],
} satisfies Config;
