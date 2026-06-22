import { describe, expect, it } from "vitest";
import { displayAuthEmail, displayAuthName, maskEmail } from "./auth-display";
import type { AuthState } from "./types";

const auth: AuthState = {
  token: "token",
  expiresAt: Date.now() + 1000,
  user: {
    name: "Oma Note",
    email: "oma@example.com",
    imageUrl: null,
  },
};

describe("auth display helpers", () => {
  it("masks email like the web app", () => {
    expect(maskEmail("oma@example.com")).toBe("om***@example.com");
    expect(maskEmail("o@example.com")).toBe("o***@example.com");
  });

  it("formats settings account values", () => {
    expect(displayAuthName(auth)).toBe("Oma Note");
    expect(displayAuthEmail(auth)).toBe("om***@example.com");
  });

  it("falls back when old auth records have blank user fields", () => {
    const blankAuth = {
      ...auth,
      user: { name: "", email: "", imageUrl: null },
    };

    expect(displayAuthName(blankAuth)).toBe("Connected account");
    expect(displayAuthEmail(blankAuth)).toBe("Not available");
  });
});
