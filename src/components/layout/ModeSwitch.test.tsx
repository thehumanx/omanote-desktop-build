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
});
