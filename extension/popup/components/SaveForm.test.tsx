import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SaveForm } from "./SaveForm";

describe("SaveForm tabs", () => {
  beforeEach(() => {
    vi.stubGlobal("chrome", {
      runtime: {
        sendMessage: vi.fn(async () => ({
          type: "FOLDERS_RESPONSE",
          data: { folders: [], categories: [], cachedAt: Date.now() },
        })),
      },
    });
  });

  it("moves active state between save type tabs", () => {
    const { container } = render(<SaveForm initialType="note" onSaved={vi.fn()} />);

    expect(container.querySelector(".type-tab-highlight")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Note" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Bookmark" }).getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(screen.getByRole("button", { name: "Bookmark" }));

    expect(screen.getByRole("button", { name: "Note" }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByRole("button", { name: "Bookmark" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("defaults note folder to the last selected folder when it exists", async () => {
    vi.stubGlobal("chrome", {
      runtime: {
        sendMessage: vi.fn(async () => ({
          type: "FOLDERS_RESPONSE",
          data: {
            folders: [
              { _id: "archive", name: "Archive" },
              { _id: "ideas", name: "Ideas" },
            ],
            categories: [],
            cachedAt: Date.now(),
            lastSelectedNoteFolderId: "ideas",
          },
        })),
      },
    });

    render(<SaveForm initialType="note" initialContent="Save this" onSaved={vi.fn()} />);

    // Folder picker is a custom dropdown; the selected name renders as text.
    expect(await screen.findByText("Ideas")).toBeTruthy();
    expect(screen.queryByText("Select…")).toBeNull();
    expect(screen.queryByText("No folder")).toBeNull();
  });
});
