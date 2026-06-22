import { EXT_COLORS, EXTENSION_TOKENS } from "./colors";

const EXTENSION_COLOR_VARIABLES: [string, string][] = [
  ["--color-canvas", EXTENSION_TOKENS.color.canvas],
  ["--color-surface", EXTENSION_TOKENS.color.surface],
  ["--color-surface-muted", EXTENSION_TOKENS.color.surfaceMuted],
  ["--color-surface-input", EXTENSION_TOKENS.color.surfaceInput],
  ["--color-ink", EXTENSION_TOKENS.color.ink],
  ["--color-ink-muted", EXTENSION_TOKENS.color.inkMuted],
  ["--color-ink-faint", EXTENSION_TOKENS.color.inkFaint],
  ["--color-ink-inverted", EXTENSION_TOKENS.color.inkInverted],
  ["--color-line", EXTENSION_TOKENS.color.line],
  ["--color-line-strong", EXTENSION_TOKENS.color.lineStrong],
  ["--color-action-primary", EXTENSION_TOKENS.color.actionPrimary],
  ["--color-action-primary-hover", EXTENSION_TOKENS.color.actionPrimaryHover],
  ["--color-brand-cta", EXTENSION_TOKENS.color.brandCta],
  ["--color-brand-cta-hover", EXTENSION_TOKENS.color.brandCtaHover],
  ["--color-success-ink", EXTENSION_TOKENS.color.successInk],
  ["--color-danger-ink", EXTENSION_TOKENS.color.dangerInk],
  ["--radius-app-field", EXTENSION_TOKENS.radius.field],
  ["--radius-app-panel", EXTENSION_TOKENS.radius.panel],
  ["--radius-app-dialog", EXTENSION_TOKENS.radius.dialog],
  ["--radius-app-chip", EXTENSION_TOKENS.radius.chip],
  ["--shadow-app-bubble", EXTENSION_TOKENS.shadow.bubble],
  ["--shadow-app-bubble-hover", EXTENSION_TOKENS.shadow.bubbleHover],
  ["--shadow-app-dialog", EXTENSION_TOKENS.shadow.dialog],
  ["--shadow-app-nav", EXTENSION_TOKENS.shadow.nav],
  ["--shadow-app-nav-active", EXTENSION_TOKENS.shadow.navActive],
  ["--shadow-app-nav-active-inset", EXTENSION_TOKENS.shadow.navActiveInset],
  ["--motion-duration-fast", EXTENSION_TOKENS.motion.fast],
  ["--motion-duration-base", EXTENSION_TOKENS.motion.base],
  ["--motion-duration-slow", EXTENSION_TOKENS.motion.slow],
  ["--motion-easing-out", EXTENSION_TOKENS.motion.out],
  ["--motion-easing-in-out", EXTENSION_TOKENS.motion.inOut],
  ["--bg", EXT_COLORS.BG],
  ["--bg-subtle", EXT_COLORS.BG_SUBTLE],
  ["--bg-input", EXT_COLORS.BG_INPUT],
  ["--white", EXT_COLORS.WHITE],
  ["--black", EXT_COLORS.BLACK],
  ["--border", EXT_COLORS.BORDER],
  ["--border-hover", EXT_COLORS.BORDER_HOVER],
  ["--text", EXT_COLORS.TEXT],
  ["--text-muted", EXT_COLORS.TEXT_MUTED],
  ["--text-subtle", EXT_COLORS.TEXT_SUBTLE],
  ["--accent", EXT_COLORS.ACCENT],
  ["--accent-hover", EXT_COLORS.ACCENT_HOVER],
  ["--accent-light", EXT_COLORS.ACCENT_LIGHT],
  ["--success", EXT_COLORS.SUCCESS],
  ["--error", EXT_COLORS.ERROR],
  ["--error-border", EXT_COLORS.ERROR_BORDER],
  ["--error-surface", EXT_COLORS.ERROR_SURFACE],
  ["--nav-active-border", EXT_COLORS.NAV_ACTIVE_BORDER],
  ["--zinc-700", EXT_COLORS.ZINC_700],
  ["--zinc-750", EXT_COLORS.ZINC_750],
  ["--zinc-900", EXT_COLORS.ZINC_900],
  ["--success-surface", EXT_COLORS.SUCCESS_SURFACE],
  ["--success-strong", EXT_COLORS.SUCCESS_STRONG],
  ["--info-surface", EXT_COLORS.INFO_SURFACE],
  ["--info-strong", EXT_COLORS.INFO_STRONG],
  ["--tab-border", EXT_COLORS.TAB_BORDER],
  ["--tab-bg", EXT_COLORS.TAB_BG],
  ["--tab-muted", EXT_COLORS.TAB_MUTED],
  ["--spinner-border", EXT_COLORS.SPINNER_BORDER],
  ["--bubble-shadow", EXT_COLORS.BUBBLE_SHADOW],
  ["--bubble-shadow-hover", EXT_COLORS.BUBBLE_SHADOW_HOVER],
  ["--modal-shadow", EXT_COLORS.MODAL_SHADOW],
  ["--tab-shadow", EXT_COLORS.TAB_SHADOW],
  ["--tab-highlight-shadow", EXT_COLORS.TAB_HIGHLIGHT_SHADOW],
  ["--tab-shine-shadow", EXT_COLORS.TAB_SHINE_SHADOW],
];

const STYLE_ID = "omanote-extension-color-vars";

export function createExtensionColorCssVariables(selector = ":root"): string {
  const declarations = EXTENSION_COLOR_VARIABLES
    .map(([name, value]) => `  ${name}: ${value};`)
    .join("\n");
  return `${selector} {\n${declarations}\n}`;
}

export function installExtensionColorCssVariables(doc: Document = document): void {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement("style");
  style.id = STYLE_ID;
  style.textContent = createExtensionColorCssVariables();
  doc.head.prepend(style);
}
