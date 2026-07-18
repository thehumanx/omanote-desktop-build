import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { describe, expect, it, vi } from "vitest";
import { LandingScreen } from "./LandingScreen";

vi.mock("@clerk/react", () => ({
  SignInButton: ({ children }: { children: React.ReactNode }) => children,
}));

// LandingScreen renders <SeoHead> (react-helmet-async), which needs a provider.
function renderLanding() {
  return render(
    <HelmetProvider>
      <MemoryRouter>
        <LandingScreen />
      </MemoryRouter>
    </HelmetProvider>,
  );
}

describe("LandingScreen extension downloads", () => {
  it("opens a download dropdown with extension and desktop app links", () => {
    renderLanding();

    fireEvent.click(screen.getByRole("button", { name: /^Download$/i }));

    const desktopReleaseUrl = "https://github.com/thehumanx/omanote-releases/releases/latest";
    const links = screen.getAllByRole("link", { name: /^Desktop app$/i });
    expect(links.some((l) => l.getAttribute("href") === desktopReleaseUrl)).toBe(true);
    expect(screen.getByRole("link", { name: /^Extension$/i })).toHaveAttribute("href", "#extension");
  });

  it("links to official browser stores", () => {
    renderLanding();

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
