import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NoteItem } from "@omanote/shared";
import { DEFAULT_USER_SETTINGS } from "../lib/user-settings";
import { CanvasNoteBlock } from "./CanvasNoteBlock";

const { mockUseUserSettings } = vi.hoisted(() => ({
  mockUseUserSettings: vi.fn(),
}));

vi.mock("../contexts/UserSettingsContext", () => ({
  useUserSettings: mockUseUserSettings,
}));

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

// The real editor is Tiptap-based and needs a ConvexProvider plus browser
// APIs jsdom lacks; capture its props instead so the test can assert what
// the preview click resolved.
const { mockEditorProps } = vi.hoisted(() => ({
  mockEditorProps: vi.fn(),
}));

vi.mock("./NoteCanvasEditor", () => ({
  NoteCanvasEditor: (props: Record<string, unknown>) => {
    mockEditorProps(props);
    return <div data-testid="note-canvas-editor" />;
  },
}));

function makeNote(overrides: Partial<NoteItem> = {}): NoteItem {
  return {
    id: "note-1",
    body: "",
    tags: [],
    createdAt: 100,
    updatedAt: 100,
    createdDateKey: "2026-04-24",
    ...overrides,
  };
}

describe("CanvasNoteBlock", () => {
  beforeEach(() => {
    mockUseUserSettings.mockReturnValue({
      settings: DEFAULT_USER_SETTINGS,
      loading: false,
      updateSettings: vi.fn(),
    });
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    vi.stubGlobal("cancelAnimationFrame", () => {});
    vi.stubGlobal("scrollTo", vi.fn());
  });

  it("places the edit caret at the clicked preview text offset", () => {
    render(
      <CanvasNoteBlock
        note={makeNote({ body: "hello world" })}
        dispatch={vi.fn()}
        noteFolders={[]}
      />,
    );

    const sourceSpan = screen.getByText("hello world");
    const textNode = sourceSpan.firstChild;
    expect(textNode).toBeInstanceOf(Text);
    document.caretRangeFromPoint = vi.fn(() => ({
      startContainer: textNode,
      startOffset: 6,
    }) as unknown as Range);

    fireEvent.click(sourceSpan, { clientX: 20, clientY: 20 });

    expect(screen.getByTestId("note-canvas-editor")).toBeInTheDocument();
    expect(mockEditorProps).toHaveBeenCalledWith(
      expect.objectContaining({ initialSelectionStart: 6 }),
    );
  });
});
