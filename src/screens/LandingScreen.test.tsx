import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { LandingScreen } from "./LandingScreen";

vi.mock("@clerk/react", () => ({
  SignInButton: ({ children }: { children: React.ReactNode }) => children,
}));

describe("LandingScreen extension downloads", () => {
  it("opens a download dropdown with extension and desktop app links", () => {
    render(
      <MemoryRouter>
        <LandingScreen />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /^Download$/i }));

    const links = screen.getAllByRole("link", { name: /^Desktop app$/i });
    const navLink = links.find((l) => l.getAttribute("href") === "#desktop");
    expect(navLink).toBeTruthy();
    expect(screen.getByRole("link", { name: /^Extension$/i })).toHaveAttribute("href", "#extension");
  });

  it("links to official browser stores", () => {
    render(
      <MemoryRouter>
        <LandingScreen />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: /Add to Chrome \/ Chromium/i })).toHaveAttribute(
      "href",
      "https://chromewebstore.google.com/detail/omanote/foafmfgfdbdiiggmmfdoalgpfhkejbjn",
    );
    expect(screen.getByRole("link", { name: /Add to Firefox/i })).toHaveAttribute(
      "href",
      "https://addons.mozilla.org/en-US/firefox/addon/omanote/",
    );
  });
});
