import { fireEvent, render, screen, act } from "@testing-library/react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { UpdateProvider, useUpdate } from "./UpdateContext";

vi.mock("../lib/update-checker", () => ({
  getLastSeenVersion: () => null,
  getUnseenVersions: (_versions: unknown[]) => [
    {
      version: "v1.2.3",
      date: "April 28, 2026",
      summary: "A smoother update experience.",
      items: ["Motion polish for the update banner and modal."],
    },
  ],
  markVersionSeen: vi.fn(),
  parseVersions: () => [
    {
      version: "v1.2.3",
      date: "April 28, 2026",
      summary: "A smoother update experience.",
      items: ["Motion polish for the update banner and modal."],
    },
  ],
}));

function Probe() {
  const update = useUpdate();

  return (
    <div>
      <div data-testid="banner-visible">{update.isBannerVisible ? "visible" : "hidden"}</div>
      <div data-testid="modal-open">{update.isModalOpen ? "open" : "closed"}</div>
      <div data-testid="transition-state">{update.isTransitioningToModal ? "opening" : "idle"}</div>
      <button type="button" onClick={update.openModal}>
        Open updates
      </button>
    </div>
  );
}

describe("UpdateProvider", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps the banner visible until the open transition completes", () => {
    render(
      <UpdateProvider>
        <Probe />
      </UpdateProvider>,
    );

    expect(screen.getByTestId("banner-visible")).toHaveTextContent("visible");
    expect(screen.getByTestId("modal-open")).toHaveTextContent("closed");
    expect(screen.getByTestId("transition-state")).toHaveTextContent("idle");

    fireEvent.click(screen.getByRole("button", { name: "Open updates" }));

    expect(screen.getByTestId("banner-visible")).toHaveTextContent("visible");
    expect(screen.getByTestId("modal-open")).toHaveTextContent("open");
    expect(screen.getByTestId("transition-state")).toHaveTextContent("opening");

    act(() => {
      vi.advanceTimersByTime(320);
    });

    expect(screen.getByTestId("banner-visible")).toHaveTextContent("hidden");
    expect(screen.getByTestId("modal-open")).toHaveTextContent("open");
    expect(screen.getByTestId("transition-state")).toHaveTextContent("idle");
  });
});
