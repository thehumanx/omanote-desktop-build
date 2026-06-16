import { describe, expect, it } from "vitest";
import {
  formatSaveShortcutLabel,
  hasShortcutConflict,
  isNewlineShortcutEvent,
  isSaveShortcutEvent,
  type ShortcutEventLike,
} from "./editor-shortcuts";
import type { SaveShortcut } from "./user-settings";

function eventStub(partial: Partial<ShortcutEventLike>): ShortcutEventLike {
  return {
    key: partial.key ?? "",
    metaKey: Boolean(partial.metaKey),
    ctrlKey: Boolean(partial.ctrlKey),
    shiftKey: Boolean(partial.shiftKey),
    altKey: Boolean(partial.altKey),
  };
}

describe("editor-shortcuts", () => {
  it.each<SaveShortcut>(["mod_enter", "enter", "shift_enter"])("matches save shortcut %s", (shortcut) => {
    const evt =
      shortcut === "mod_enter"
        ? eventStub({ key: "Enter", ctrlKey: true })
        : shortcut === "enter"
          ? eventStub({ key: "Enter" })
          : eventStub({ key: "Enter", shiftKey: true });

    expect(isSaveShortcutEvent(evt, shortcut)).toBe(true);
  });

  it("rejects non-Enter keys", () => {
    expect(isSaveShortcutEvent(eventStub({ key: "Escape" }), "mod_enter")).toBe(false);
    expect(isNewlineShortcutEvent(eventStub({ key: "Tab" }), "enter")).toBe(false);
  });

  it("rejects modifier conflicts for save shortcuts", () => {
    expect(isSaveShortcutEvent(eventStub({ key: "Enter", altKey: true }), "enter")).toBe(false);
    expect(isSaveShortcutEvent(eventStub({ key: "Enter", metaKey: true }), "enter")).toBe(false);
    expect(isSaveShortcutEvent(eventStub({ key: "Enter", ctrlKey: true }), "enter")).toBe(false);
  });

  it("rejects modifier conflicts for newline shortcuts", () => {
    expect(isNewlineShortcutEvent(eventStub({ key: "Enter", altKey: true }), "enter")).toBe(false);
    expect(isNewlineShortcutEvent(eventStub({ key: "Enter", metaKey: true }), "shift_enter")).toBe(false);
    expect(isNewlineShortcutEvent(eventStub({ key: "Enter", ctrlKey: true }), "shift_enter")).toBe(false);
  });

  it.each([
    ["mod_enter", "Cmd/Ctrl + Enter"],
    ["enter", "Enter"],
    ["shift_enter", "Shift + Enter"],
  ] as const)("formats save shortcut label %s", (shortcut, label) => {
    expect(formatSaveShortcutLabel(shortcut)).toBe(label);
  });

  it("matches newline shortcut events", () => {
    expect(isNewlineShortcutEvent(eventStub({ key: "Enter" }), "enter")).toBe(true);
    expect(isNewlineShortcutEvent(eventStub({ key: "Enter", shiftKey: true }), "shift_enter")).toBe(true);
    expect(isNewlineShortcutEvent(eventStub({ key: "Enter", ctrlKey: true }), "enter")).toBe(false);
  });

  it.each<SaveShortcut>(["mod_enter", "enter", "shift_enter"])("does not match save shortcut %s on mobile view", (shortcut) => {
    const event =
      shortcut === "mod_enter"
        ? eventStub({ key: "Enter", ctrlKey: true })
        : shortcut === "enter"
          ? eventStub({ key: "Enter" })
          : eventStub({ key: "Enter", shiftKey: true });

    expect(isSaveShortcutEvent(event, shortcut, { isMobileViewport: true })).toBe(false);
  });

  it("treats plain Enter as newline on mobile view regardless of the configured newline shortcut", () => {
    const event = eventStub({ key: "Enter" });

    expect(isNewlineShortcutEvent(event, "enter", { isMobileViewport: true })).toBe(true);
    expect(isNewlineShortcutEvent(event, "shift_enter", { isMobileViewport: true })).toBe(true);
  });

  it.each([
    ["enter", "enter", true],
    ["shift_enter", "shift_enter", true],
    ["mod_enter", "enter", false],
    ["mod_enter", "shift_enter", false],
    ["enter", "shift_enter", false],
    ["shift_enter", "enter", false],
  ] as const)("detects shortcut conflicts for save=%s newline=%s", (saveShortcut, newlineShortcut, expected) => {
    expect(hasShortcutConflict(saveShortcut, newlineShortcut)).toBe(expected);
  });
});
