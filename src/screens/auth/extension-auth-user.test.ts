import { describe, expect, it } from "vitest";
import { extensionAuthUser } from "./extension-auth-user";

describe("extensionAuthUser", () => {
  it("uses Clerk profile fields for extension auth storage", () => {
    expect(extensionAuthUser({
      fullName: "Oma Note",
      username: "oma",
      primaryEmailAddress: { emailAddress: "oma@example.com" },
      imageUrl: "https://example.com/avatar.png",
    })).toEqual({
      name: "Oma Note",
      email: "oma@example.com",
      imageUrl: "https://example.com/avatar.png",
    });
  });

  it("falls back to username and then email for the display name", () => {
    expect(extensionAuthUser({
      fullName: null,
      username: "oma",
      primaryEmailAddress: { emailAddress: "oma@example.com" },
      imageUrl: null,
    }).name).toBe("oma");

    expect(extensionAuthUser({
      fullName: null,
      username: null,
      primaryEmailAddress: { emailAddress: "oma@example.com" },
      imageUrl: null,
    }).name).toBe("oma@example.com");
  });
});
