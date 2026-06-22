import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UpdateModal } from "./UpdateModal";

vi.mock("./ModalPortal", () => ({
  ModalPortal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("../contexts/UpdateContext", () => ({
  useUpdate: () => ({
    isModalOpen: true,
    closeModal: vi.fn(),
    latestVersion: {
      version: "v1.2.3",
      date: "April 28, 2026",
      summary: "A smoother update experience.",
      items: ["Motion polish for the update banner and modal."],
    },
    modalVersions: [
      {
        version: "v1.2.3",
        date: "April 28, 2026",
        summary: "A smoother update experience.",
        items: ["Motion polish for the update banner and modal."],
      },
    ],
    isTransitioningToModal: false,
  }),
}));

vi.mock("../lib/update-checker", async () => {
  const actual = await vi.importActual<typeof import("../lib/update-checker")>("../lib/update-checker");
  return {
    ...actual,
    parseVersions: (_markdown: string, sectionTitle?: string) => {
      if (sectionTitle === "Desktop Versions") {
        return [
          {
            version: "v0.22.1",
            date: "June 14, 2026",
            summary: "Desktop polish.",
            items: ["Window update fixes."],
          },
        ];
      }

      return [
        {
          version: "v1.2.3",
          date: "April 28, 2026",
          summary: "Extension polish.",
          items: ["Store listing updates."],
        },
        {
          version: "v1.2.2",
          date: "April 20, 2026",
          summary: "Older extension update.",
          items: ["Previous extension fixes."],
        },
      ];
    },
  };
});

function renderUpdateModal() {
  return render(
    <MemoryRouter>
      <UpdateModal />
    </MemoryRouter>,
  );
}

describe("UpdateModal", () => {
  beforeEach(() => {
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 1;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        matches: false,
        media: "(prefers-reduced-motion: reduce)",
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );
  });

  it("stops modal touch gestures from reaching background swipe handlers", () => {
    const touchEndSpy = vi.fn();
    window.addEventListener("touchend", touchEndSpy);

    const { container } = renderUpdateModal();
    const backdrop = container.firstElementChild;
    expect(backdrop).toBeInstanceOf(HTMLElement);

    fireEvent.touchEnd(backdrop as HTMLElement, {
      changedTouches: [{ clientX: 40, clientY: 10, identifier: 0 }],
    });

    expect(touchEndSpy).not.toHaveBeenCalled();
    window.removeEventListener("touchend", touchEndSpy);
  });

  it("shows only the latest extension update in the modal", () => {
    renderUpdateModal();

    expect(screen.getByText("Latest updates")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Extension" }));

    expect(screen.getByText("Latest updates")).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { name: "v1.2.3" })).toHaveLength(2);
    expect(screen.getByText("Extension polish.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "v1.2.2" })).not.toBeInTheDocument();
    expect(screen.queryByText("Older extension update.")).not.toBeInTheDocument();
  });

  it("shows desktop app changelogs in their own tab", () => {
    renderUpdateModal();

    fireEvent.click(screen.getByRole("button", { name: "Desktop" }));

    expect(screen.getByText("Desktop polish.")).toBeInTheDocument();
    expect(screen.getByText("Window update fixes.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refresh to update" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Update your extension" })).not.toBeInTheDocument();
  });
});
