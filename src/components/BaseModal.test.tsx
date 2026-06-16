import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BaseModal } from "./BaseModal";

describe("BaseModal", () => {
  it("renders children through the modal portal", () => {
    render(
      <BaseModal onClose={() => {}}>
        <div>Modal content</div>
      </BaseModal>,
    );

    expect(screen.getByText("Modal content")).toBeInTheDocument();
  });

  it("closes on Escape", () => {
    const onClose = vi.fn();

    render(
      <BaseModal onClose={onClose}>
        <div>Modal content</div>
      </BaseModal>,
    );

    fireEvent.keyDown(window, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("can close from backdrop mouse down without closing from inner content", () => {
    const onBackdropMouseDown = vi.fn();

    render(
      <BaseModal onClose={() => {}} onBackdropMouseDown={onBackdropMouseDown}>
        <div onMouseDown={(event) => event.stopPropagation()}>Modal content</div>
      </BaseModal>,
    );

    fireEvent.mouseDown(screen.getByText("Modal content"));
    expect(onBackdropMouseDown).not.toHaveBeenCalled();

    fireEvent.mouseDown(screen.getByText("Modal content").parentElement!);
    expect(onBackdropMouseDown).toHaveBeenCalledTimes(1);
  });

  it("uses semantic overlay and z-index tokens", () => {
    render(
      <BaseModal onClose={() => {}}>
        <div>Modal content</div>
      </BaseModal>,
    );

    expect(screen.getByText("Modal content").parentElement).toHaveClass("z-app-dialog");
    expect(screen.getByText("Modal content").parentElement).toHaveClass("bg-app-overlay");
  });
});
