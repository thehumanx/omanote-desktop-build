import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Popup } from "./Popup";

describe("Popup settings navigation", () => {
  let values: Record<string, unknown>;
  let storedAuth: {
    token: string;
    expiresAt: number;
    user: {
      name: string;
      email: string;
      imageUrl: string | null;
    };
  };

  beforeEach(() => {
    storedAuth = {
      token: "token",
      expiresAt: Date.now() + 60_000,
      user: {
        name: "Oma Note",
        email: "oma@example.com",
        imageUrl: null,
      },
    };
    values = {
      omanote_auth: storedAuth,
      omanote_blocked_sites: [],
    };

    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get: vi.fn(async (key: string) => {
            return { [key]: values[key] };
          }),
          set: vi.fn(async (next: Record<string, unknown>) => {
            Object.assign(values, next);
          }),
        },
        onChanged: {
          addListener: vi.fn(),
          removeListener: vi.fn(),
        },
      },
      runtime: {
        sendMessage: vi.fn(async (message) => {
          if (message.type === "GET_RECENT_ITEMS") return { type: "RECENT_ITEMS_RESPONSE", items: [] };
          if (message.type === "GET_ENCRYPTION_STATE") return { type: "ENCRYPTION_STATE_RESPONSE", isUnlocked: true };
          return { type: "SAVE_ERROR", error: "Unhandled message" };
        }),
        onMessage: {
          addListener: vi.fn(),
          removeListener: vi.fn(),
        },
      },
      tabs: {
        query: vi.fn(async () => [{ url: "https://example.com", title: "Example" }]),
      },
    });
  });

  it("opens settings when the gear button is clicked", async () => {
    render(<Popup />);

    const settingsButton = await screen.findByRole("button", { name: "Settings" });
    fireEvent.click(settingsButton);

    await waitFor(() => {
      expect(screen.getByText("Account")).toBeTruthy();
    });
    expect(screen.getByText("om***@example.com")).toBeTruthy();
  });

  it("opens settings from pointer down for Chromium extension popups", async () => {
    render(<Popup />);

    const settingsButton = await screen.findByRole("button", { name: "Settings" });
    fireEvent.pointerDown(settingsButton);

    await waitFor(() => {
      expect(screen.getByText("Account")).toBeTruthy();
    });
    expect(screen.getByText("om***@example.com")).toBeTruthy();
  });

  it("opens settings through the native fallback listener", async () => {
    render(<Popup />);

    const settingsButton = await screen.findByRole("button", { name: "Settings" });
    settingsButton.dispatchEvent(new Event("omanote:open-settings", { bubbles: true }));

    await waitFor(() => {
      expect(screen.getByText("Account")).toBeTruthy();
    });
    expect(screen.getByText("om***@example.com")).toBeTruthy();
  });

  it("uses full-size hit targets for settings and back icon buttons", async () => {
    render(<Popup />);

    const settingsButton = await screen.findByRole("button", { name: "Settings" });
    expect(settingsButton.className).toContain("icon-btn");
    expect(settingsButton.textContent).toBe("⚙");
    fireEvent.click(settingsButton);

    const backButton = await screen.findByRole("button", { name: "Back" });
    expect(backButton.className).toContain("icon-btn");
    expect(backButton.textContent).toBe("←");
  });

  it("does not show the account name in the popup header", async () => {
    render(<Popup />);

    await screen.findByRole("button", { name: "Settings" });

    expect(screen.queryByText("Oma Note")).toBeNull();
  });

  it("keeps an expired stored auth session connected until disconnect", async () => {
    storedAuth.expiresAt = Date.now() - 60_000;

    render(<Popup />);

    const settingsButton = await screen.findByRole("button", { name: "Settings" });
    fireEvent.click(settingsButton);

    await waitFor(() => {
      expect(screen.getByText("Account")).toBeTruthy();
    });
    expect(screen.getByText("Oma Note")).toBeTruthy();
    expect(screen.getByText("✓ Connected")).toBeTruthy();
  });

  it("toggles the current site from the popup header", async () => {
    render(<Popup />);

    const blockButton = await screen.findByRole("button", { name: "Block popup on this site" });
    expect(screen.getByText("Active")).toBeTruthy();
    expect(blockButton.className).toContain("active");
    fireEvent.click(blockButton);

    await waitFor(() => {
      expect(values.omanote_blocked_sites).toEqual(["https://example.com"]);
    });
    const allowButton = await screen.findByRole("button", { name: "Allow popup on this site" });
    expect(allowButton).toBeTruthy();
    expect(screen.getByText("Inactive")).toBeTruthy();
    expect(allowButton.className).toContain("inactive");

    fireEvent.click(screen.getByRole("button", { name: "Allow popup on this site" }));

    await waitFor(() => {
      expect(values.omanote_blocked_sites).toEqual([]);
    });
  });

  it("opens a dedicated blocked sites view from settings", async () => {
    values.omanote_blocked_sites = ["https://example.com", "https://notes.example.com"];

    render(<Popup />);

    fireEvent.click(await screen.findByRole("button", { name: "Settings" }));

    await waitFor(() => {
      expect(screen.getByText("Blocked sites")).toBeTruthy();
    });
    expect(screen.getByText("2 sites blocked →")).toBeTruthy();
    expect(screen.queryByText("https://example.com")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "View blocked sites" }));

    expect(screen.getByText("https://example.com")).toBeTruthy();
    expect(screen.getByText("https://notes.example.com")).toBeTruthy();
  });

  it("removes sites from the dedicated blocked sites view", async () => {
    values.omanote_blocked_sites = ["https://example.com", "https://notes.example.com"];

    render(<Popup />);

    fireEvent.click(await screen.findByRole("button", { name: "Settings" }));
    fireEvent.click(await screen.findByRole("button", { name: "View blocked sites" }));

    fireEvent.click(screen.getByRole("button", { name: "Remove https://example.com" }));

    await waitFor(() => {
      expect(values.omanote_blocked_sites).toEqual(["https://notes.example.com"]);
    });
  });
});
