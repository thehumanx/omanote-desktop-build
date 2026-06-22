import { createExtensionColorCssVariables } from "../shared/color-vars";

const OMANOTE_FONT_STACK = "\"OmanoteLato\", \"Lato\", -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, sans-serif";
const extensionTokenDeclarations = createExtensionColorCssVariables(":host").split("\n").slice(1, -1).join("\n");

function extensionAssetUrl(path: string): string {
  const runtime = globalThis.chrome?.runtime;
  try {
    return runtime?.getURL ? runtime.getURL(path) : path;
  } catch {
    return path;
  }
}

export function createBubbleCss(assetUrl = extensionAssetUrl): string {
  return `
  @font-face {
    font-family: "OmanoteLato";
    font-style: normal;
    font-weight: 400;
    font-display: swap;
    src: url("${assetUrl("assets/fonts/Lato-Regular.ttf")}") format("truetype");
  }

  @font-face {
    font-family: "OmanoteLato";
    font-style: normal;
    font-weight: 700;
    font-display: swap;
    src: url("${assetUrl("assets/fonts/Lato-Bold.ttf")}") format("truetype");
  }

  @font-face {
    font-family: "OmanoteLato";
    font-style: normal;
    font-weight: 900;
    font-display: swap;
    src: url("${assetUrl("assets/fonts/Lato-Black.ttf")}") format("truetype");
  }

  :host {
    all: initial;
    position: absolute;
    top: 0;
    left: 0;
    width: 0;
    height: 0;
    z-index: 2147483647;
    pointer-events: none;
    font-family: ${OMANOTE_FONT_STACK} !important;
${extensionTokenDeclarations}
  }

  * {
    box-sizing: border-box;
    font-family: ${OMANOTE_FONT_STACK} !important;
  }

  .bubble {
    pointer-events: none;
    position: absolute;
    z-index: 2147483647;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px 6px 8px;
    background: var(--color-surface);
    border: 1px solid var(--color-line);
    border-radius: var(--radius-app-chip);
    cursor: pointer;
    box-shadow: var(--shadow-app-bubble);
    transition: transform var(--motion-duration-fast) var(--motion-easing-out), box-shadow var(--motion-duration-fast) var(--motion-easing-out), opacity var(--motion-duration-fast) var(--motion-easing-out);
    opacity: 0;
    transform: translateY(4px) scale(0.96);
    user-select: none;
    white-space: nowrap;
  }

  .bubble.visible {
    pointer-events: all;
    opacity: 1;
    transform: translateY(0) scale(1);
  }

  .bubble:hover {
    background: var(--color-surface-muted);
    box-shadow: var(--shadow-app-bubble-hover);
  }

  .bubble:active {
    transform: scale(0.97);
  }

  .bubble-logo {
    width: 76px;
    height: 19px;
    display: block;
    object-fit: contain;
    flex-shrink: 0;
  }

  .bubble-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--color-ink);
    line-height: 1;
  }

  /* Save Modal */
  .modal-overlay {
    pointer-events: none;
    position: fixed;
    inset: 0;
    z-index: 2147483646;
    background: transparent;
    opacity: 0;
    transition: opacity var(--motion-duration-fast) var(--motion-easing-out);
  }

  .modal-overlay.visible {
    pointer-events: all;
    opacity: 1;
  }

  .modal {
    position: fixed;
    background: var(--color-surface);
    border: 1px solid var(--color-line);
    border-radius: var(--radius-app-dialog);
    width: 360px;
    max-width: calc(100vw - 16px);
    max-height: calc(100vh - 16px);
    overflow: hidden;
    box-shadow: var(--shadow-app-dialog);
    transform: translateY(8px) scale(0.98);
    transition: transform var(--motion-duration-base) var(--motion-easing-out), height var(--motion-duration-slow) var(--motion-easing-out);
  }

  .modal-overlay.visible .modal {
    transform: translateY(0) scale(1);
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px 0;
  }

  .modal-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    font-weight: 700;
    color: var(--color-ink);
  }

  .modal-title-logo {
    width: 98px;
    height: 25px;
    display: block;
    object-fit: contain;
  }

  .modal-close {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--color-ink-muted);
    font-size: 18px;
    line-height: 1;
    padding: 2px 4px;
    border-radius: var(--radius-app-field);
    transition: color var(--motion-duration-fast) var(--motion-easing-out), background var(--motion-duration-fast) var(--motion-easing-out);
  }

  .modal-close:hover {
    color: var(--color-ink);
    background: var(--color-surface-muted);
  }

  .type-tabs {
    position: relative;
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 12px 16px 0;
    padding: 6px;
    overflow: hidden;
    border: 1px solid var(--tab-border);
    border-radius: var(--radius-app-chip);
    background: var(--tab-bg);
    box-shadow: var(--shadow-app-nav);
    backdrop-filter: blur(12px);
  }

  .type-tab-highlight {
    pointer-events: none;
    position: absolute;
    top: 0;
    left: 0;
    border: 1px solid var(--nav-active-border);
    border-radius: var(--radius-app-chip);
    background: var(--color-action-primary);
    box-shadow: var(--shadow-app-nav-active);
    opacity: 0;
    transition:
      transform var(--motion-duration-slow) var(--motion-easing-in-out),
      width var(--motion-duration-slow) var(--motion-easing-in-out),
      height var(--motion-duration-slow) var(--motion-easing-in-out),
      opacity var(--motion-duration-slow) var(--motion-easing-in-out);
  }

  .type-tab-highlight-shine {
    position: absolute;
    inset: 0;
    border-radius: var(--radius-app-chip);
    box-shadow: var(--shadow-app-nav-active-inset);
  }

  .type-tab {
    position: relative;
    z-index: 1;
    flex: 1;
    min-width: 0;
    padding: 8px 0;
    border-radius: var(--radius-app-chip);
    border: 0;
    background: none;
    color: var(--tab-muted);
    font-size: 14px;
    font-weight: 500;
    font-family: inherit;
    cursor: pointer;
    transition:
      transform var(--motion-duration-fast) var(--motion-easing-out),
      color var(--motion-duration-fast) var(--motion-easing-out),
      opacity var(--motion-duration-fast) var(--motion-easing-out);
    text-align: center;
    line-height: 1;
  }

  .type-tab:hover {
    color: var(--color-ink);
  }

  .type-tab.active {
    background: transparent;
    color: var(--color-ink-inverted);
  }

  .type-tab:active {
    transform: translateY(1px) scale(0.98);
  }

  .modal-body {
    padding: 12px 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .field-label {
    font-size: 10px;
    font-weight: 700;
    color: var(--color-ink-muted);
    margin-bottom: 4px;
    display: block;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .field-textarea {
    width: 100%;
    background: var(--color-surface-input);
    border: 1px solid var(--color-line);
    border-radius: var(--radius-app-field);
    color: var(--color-ink);
    font-size: 13px;
    line-height: 1.55;
    padding: 7px 9px;
    resize: none;
    outline: none;
    font-family: inherit;
    min-height: 80px;
    transition: border-color var(--motion-duration-fast) var(--motion-easing-out);
  }

  .field-textarea::placeholder {
    color: var(--color-ink-faint);
  }

  .field-textarea:focus {
    border-color: var(--color-brand-cta);
    background: var(--color-ink-inverted);
  }

  .field-input {
    width: 100%;
    background: var(--color-surface-input);
    border: 1px solid var(--color-line);
    border-radius: var(--radius-app-field);
    color: var(--color-ink);
    font-size: 13px;
    padding: 7px 9px;
    outline: none;
    font-family: inherit;
    transition: border-color var(--motion-duration-fast) var(--motion-easing-out);
  }

  .field-input::placeholder {
    color: var(--color-ink-faint);
  }

  .field-input:focus {
    border-color: var(--color-brand-cta);
    background: var(--color-ink-inverted);
  }

  .field-select {
    width: 100%;
    background: var(--color-surface-input);
    border: 1px solid var(--color-line);
    border-radius: var(--radius-app-field);
    color: var(--color-ink);
    font-size: 13px;
    padding: 7px 9px;
    outline: none;
    font-family: inherit;
    cursor: pointer;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='%23a1a1aa' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 9px center;
    padding-right: 26px;
    transition: border-color var(--motion-duration-fast) var(--motion-easing-out);
  }

  .field-select:focus {
    border-color: var(--color-brand-cta);
    background-color: var(--color-ink-inverted);
  }

  .empty-target {
    color: var(--color-ink-muted);
    font-size: 12px;
    line-height: 1.45;
    padding: 7px 0;
  }

  .create-target-row {
    display: flex;
    gap: 6px;
    margin-top: 6px;
  }

  .create-target-row .field-input {
    min-width: 0;
  }

  .btn-small {
    background: var(--color-surface-muted);
    border: 1px solid var(--color-line);
    border-radius: var(--radius-app-field);
    color: var(--color-ink);
    font-size: 12px;
    font-weight: 700;
    padding: 0 12px;
    cursor: pointer;
    font-family: inherit;
    white-space: nowrap;
  }

  .btn-small:hover {
    background: var(--color-line);
  }

  .btn-small:disabled {
    color: var(--color-ink-muted);
    cursor: not-allowed;
  }

  .source-url {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: var(--color-ink-muted);
    padding: 3px 0;
    cursor: pointer;
    user-select: none;
  }

  .source-url input[type="checkbox"] {
    accent-color: var(--color-brand-cta);
    width: 13px;
    height: 13px;
    cursor: pointer;
  }

  .source-url-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 280px;
  }

  .modal-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 16px 14px;
    gap: 8px;
  }

  .btn-cancel {
    background: var(--color-surface-muted);
    border: 1px solid var(--color-line);
    border-radius: var(--radius-app-field);
    color: var(--color-ink-muted);
    font-size: 13px;
    font-weight: 600;
    padding: 8px 16px;
    cursor: pointer;
    font-family: inherit;
    transition: color var(--motion-duration-fast) var(--motion-easing-out), border-color var(--motion-duration-fast) var(--motion-easing-out);
  }

  .btn-cancel:hover {
    color: var(--color-ink);
    border-color: var(--color-line-strong);
  }

  .btn-save {
    background: var(--color-ink);
    border: none;
    border-radius: var(--radius-app-field);
    color: var(--color-ink-inverted);
    font-size: 13px;
    font-weight: 700;
    padding: 8px 20px;
    cursor: pointer;
    font-family: inherit;
    display: flex;
    align-items: center;
    gap: 6px;
    flex: 1;
    justify-content: center;
    transition: background var(--motion-duration-fast) var(--motion-easing-out);
    letter-spacing: 0.01em;
  }

  .btn-save:hover {
    background: var(--color-action-primary-hover);
  }

  .btn-save:disabled {
    background: var(--color-line);
    color: var(--color-ink-muted);
    cursor: not-allowed;
  }

  .btn-save .shortcut-hint {
    font-size: 10px;
    opacity: 0.55;
    font-weight: 400;
  }

  .status-success {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    gap: 10px;
    padding: 28px 16px;
    color: var(--color-success-ink);
    font-size: 14px;
    font-weight: 700;
    animation: success-in var(--motion-duration-base) var(--motion-easing-out);
  }

  .status-success-icon {
    width: 56px;
    height: 56px;
    color: var(--color-success-ink);
  }

  .success-circle {
    fill: none;
    stroke: currentColor;
    stroke-width: 2.5;
    stroke-dasharray: 145;
    stroke-dashoffset: 145;
  }

  .success-check {
    fill: none;
    stroke: currentColor;
    stroke-width: 3;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-dasharray: 34;
    stroke-dashoffset: 34;
  }

  @keyframes success-in {
    from { opacity: 0; }
    to   { opacity: 1; }
  }

  .status-error {
    font-size: 12px;
    color: var(--color-danger-ink);
    padding: 4px 0 6px;
  }
`;
}

export const BUBBLE_CSS = createBubbleCss();
