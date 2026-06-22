import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DateKey, EventEntry } from "@omanote/shared";
import { CanvasEventBlock } from "./CanvasEventBlock";

vi.mock("./AttachmentLinkPreview", () => ({
  AttachmentLinkPreview: () => null,
}));

vi.mock("./HashtagPicker", () => ({
  useHashtagPicker: () => ({
    isOpen: false,
    suggestions: [],
    activeIndex: 0,
    handleKeyDown: () => false,
    selectSuggestion: vi.fn(),
    setActiveIndex: vi.fn(),
  }),
  HashtagPickerDropdown: () => null,
}));

function makeEvent(overrides: Partial<EventEntry> = {}): EventEntry {
  return {
    id: "event_1",
    label: "Morning pages",
    notes: "",
    loggedAt: Date.UTC(2026, 4, 7, 9, 0, 0),
    createdAt: Date.UTC(2026, 4, 7, 9, 0, 0),
    createdDateKey: "2026-05-07" as DateKey,
    sourceType: "manual",
    ...overrides,
  };
}

describe("CanvasEventBlock", () => {
  it("uses the full canvas lane width while editing", () => {
    render(<CanvasEventBlock event={makeEvent()} dispatch={vi.fn()} />);

    fireEvent.click(screen.getByText("Morning pages"));

    const labelInput = screen.getByDisplayValue("Morning pages");
    const editRoot = labelInput.closest("[data-testid='canvas-event-block']");
    const editRow = labelInput.closest("[data-testid='canvas-event-edit-row']");

    expect(editRoot).toHaveClass("w-full");
    expect(editRow).toHaveClass("w-full");
    expect(labelInput.parentElement).toHaveClass("w-full");
  });
});
