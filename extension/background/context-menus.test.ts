import { describe, expect, it, vi } from "vitest";
import { registerContextMenus } from "./context-menus";

describe("registerContextMenus", () => {
  it("removes stale menus before registering the omanote menu tree", () => {
    const create = vi.fn();
    const removeAll = vi.fn((callback: () => void) => callback());
    vi.stubGlobal("chrome", { contextMenus: { create, removeAll } });

    registerContextMenus();

    expect(removeAll).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledTimes(7);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      id: "omanote-root",
      title: "Save to omanote",
    }));
  });
});
