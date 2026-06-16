import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { HashtagChip } from "./HashtagChip";

vi.mock("../app/AppProvider", () => ({
  useApp: () => ({
    dispatch: vi.fn(),
  }),
}));

describe("HashtagChip", () => {
  it("renders the hover tooltip in a portal below the top chrome boundary", async () => {
    document.documentElement.style.setProperty("--omanote-top-chrome-height", "64px");
    window.innerHeight = 320;
    window.innerWidth = 800;

    const { container } = render(
      <MemoryRouter>
        <HashtagChip name="uxwriting" withTooltip />
      </MemoryRouter>,
    );

    const anchor = container.firstElementChild as HTMLElement;
    anchor.getBoundingClientRect = vi.fn(() => ({
      x: 120,
      y: 70,
      top: 70,
      left: 120,
      bottom: 90,
      right: 210,
      width: 90,
      height: 20,
      toJSON: () => ({}),
    })) as typeof anchor.getBoundingClientRect;

    fireEvent.mouseEnter(anchor);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "View mindmap" })).toBeInTheDocument();
    });

    const tooltip = screen.getByRole("button", { name: "View mindmap" }).parentElement;
    expect(tooltip).toHaveStyle({ top: "94px" });

    document.documentElement.style.removeProperty("--omanote-top-chrome-height");
  });
});
