import { describe, expect, it } from "vitest";
import { ConvexError } from "convex/values";
import { friendlyErrorMessage } from "./errors";

const FALLBACK = "Something went wrong.";

describe("friendlyErrorMessage", () => {
  it("hides raw Convex server error strings", () => {
    const raw = new Error(
      "[CONVEX M(account:deleteMyData)] [Request ID: abc123] Server Error Uncaught Error: boom",
    );
    expect(friendlyErrorMessage(raw, FALLBACK)).toBe(FALLBACK);
  });

  it("hides transport-level failures", () => {
    expect(friendlyErrorMessage(new Error("Failed to fetch"), FALLBACK)).toBe(FALLBACK);
    expect(friendlyErrorMessage(new Error("NetworkError when attempting to fetch resource."), FALLBACK)).toBe(FALLBACK);
  });

  it("passes through locally-thrown user-facing messages", () => {
    expect(
      friendlyErrorMessage(new Error("Incorrect passphrase. Please try again."), FALLBACK),
    ).toBe("Incorrect passphrase. Please try again.");
  });

  it("shows ConvexError application data", () => {
    expect(friendlyErrorMessage(new ConvexError("Feed limit reached."), FALLBACK)).toBe(
      "Feed limit reached.",
    );
    expect(
      friendlyErrorMessage(new ConvexError({ message: "Feed limit reached." }), FALLBACK),
    ).toBe("Feed limit reached.");
    expect(friendlyErrorMessage(new ConvexError({ code: "LIMIT" }), FALLBACK)).toBe(FALLBACK);
  });

  it("hides DOMException messages (e.g. WebCrypto failures)", () => {
    expect(
      friendlyErrorMessage(new DOMException("The operation failed for an operation-specific reason", "OperationError"), FALLBACK),
    ).toBe(FALLBACK);
  });

  it("falls back for non-Error throwables and empty messages", () => {
    expect(friendlyErrorMessage("boom", FALLBACK)).toBe(FALLBACK);
    expect(friendlyErrorMessage(undefined, FALLBACK)).toBe(FALLBACK);
    expect(friendlyErrorMessage(new Error("   "), FALLBACK)).toBe(FALLBACK);
  });
});
