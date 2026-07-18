import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { ModeSwitch } from "./ModeSwitch";

function LocationProbe() {
  const location = useLocation();
  return <p data-testid="location">{location.pathname}</p>;
}

function renderModeSwitch(initialPath = "/reader") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <ModeSwitch />
      <Routes>
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ModeSwitch", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("does not restore transient updates route as the last write page", () => {
    window.localStorage.setItem("omanote.lastWritePath", "/updates");

    renderModeSwitch("/reader");

    fireEvent.click(screen.getByRole("button", { name: /write/i }));

    expect(screen.getByTestId("location")).toHaveTextContent("/canvas");
  });

  const ACTIVE_CLASS = "omanote-segmented-item-active";

  it("keeps the pill on Read when a reader user opens a neutral overlay", () => {
    // Coming from the reader, lastMode is "read".
    window.localStorage.setItem("omanote.lastMode", "read");

    for (const neutral of ["/settings", "/updates", "/guide", "/insights"]) {
      const { unmount } = renderModeSwitch(neutral);
      expect(screen.getByRole("button", { name: /read/i })).toHaveClass(ACTIVE_CLASS);
      expect(screen.getByRole("button", { name: /write/i })).not.toHaveClass(ACTIVE_CLASS);
      unmount();
    }
  });

  it("keeps the pill on Write when a write user opens a neutral overlay", () => {
    window.localStorage.setItem("omanote.lastMode", "write");

    renderModeSwitch("/settings");

    expect(screen.getByRole("button", { name: /write/i })).toHaveClass(ACTIVE_CLASS);
    expect(screen.getByRole("button", { name: /read/i })).not.toHaveClass(ACTIVE_CLASS);
  });

  it("shows Read on reader routes and Write on write routes regardless of stored mode", () => {
    window.localStorage.setItem("omanote.lastMode", "write");
    const readerRender = renderModeSwitch("/reader");
    expect(screen.getByRole("button", { name: /read/i })).toHaveClass(ACTIVE_CLASS);
    readerRender.unmount();

    window.localStorage.setItem("omanote.lastMode", "read");
    renderModeSwitch("/notes");
    expect(screen.getByRole("button", { name: /write/i })).toHaveClass(ACTIVE_CLASS);
  });

  it("switches to the write side from a neutral overlay showing Read", () => {
    window.localStorage.setItem("omanote.lastMode", "read");
    window.localStorage.setItem("omanote.lastWritePath", "/todos");

    renderModeSwitch("/settings");
    fireEvent.click(screen.getByRole("button", { name: /write/i }));

    expect(screen.getByTestId("location")).toHaveTextContent("/todos");
  });
});
