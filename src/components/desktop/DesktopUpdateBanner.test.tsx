import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../lib/desktop", () => ({
  isTauri: () => true,
}));

vi.mock("@tauri-apps/plugin-updater", () => ({
  check: vi.fn(async () => ({
    version: "0.22.1",
    downloadAndInstall: vi.fn(),
  })),
}));

describe("DesktopUpdateBanner", () => {
  beforeEach(() => {
    vi.stubEnv("DEV", false);
  });

  it("appears above the bottom nav like the web update banner", async () => {
    const { DesktopUpdateBanner } = await import("./DesktopUpdateBanner");

    render(<DesktopUpdateBanner />);

    const banner = await screen.findByText("Update available");

    expect(banner.closest(".fixed")).toHaveClass("bottom-[88px]");
  });
});
