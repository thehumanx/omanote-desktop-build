import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FounderNoteModal } from "./FounderNoteModal";

vi.mock("./ModalPortal", () => ({
  ModalPortal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe("FounderNoteModal", () => {
  it("keeps the founder note styled like ruled paper", () => {
    const { container } = render(<FounderNoteModal open onClose={() => {}} />);

    expect(screen.getByText("A note from Bibek")).toBeInTheDocument();
    expect(container.querySelector(".founder-note-card")).toBeInTheDocument();
    expect(container.querySelector(".founder-note-body")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Got it" })).not.toBeInTheDocument();
  });
});
