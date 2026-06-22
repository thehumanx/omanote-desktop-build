import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { UpdatesScreen } from "./UpdatesScreen";

vi.mock("../components/layout/useTopChrome", () => ({
  useTopChrome: vi.fn(),
}));

describe("UpdatesScreen", () => {
  it("uses the changelog tabs as the versions section header", () => {
    render(<UpdatesScreen />);

    expect(screen.queryByRole("heading", { name: "Versions" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Latest webapp release:/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Webapp" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Desktop" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Extension" })).toBeInTheDocument();
  });
});
