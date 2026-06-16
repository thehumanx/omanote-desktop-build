import { describe, expect, it } from "vitest";
import { validatePassphraseChange } from "./passphrase-form";

describe("validatePassphraseChange", () => {
  it("rejects when new and confirm do not match", () => {
    const result = validatePassphraseChange({ current: "oldpass123", next: "newpass123", confirm: "newpass999" });
    expect(result.ok).toBe(false);
  });

  it("accepts valid input", () => {
    const result = validatePassphraseChange({ current: "oldpass123", next: "newpass123", confirm: "newpass123" });
    expect(result.ok).toBe(true);
  });
});
