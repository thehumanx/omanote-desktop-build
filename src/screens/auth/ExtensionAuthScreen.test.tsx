import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("ExtensionAuthScreen source", () => {
  it("uses shared app styling primitives instead of one-off sizing and spinner styles", () => {
    const source = readFileSync(resolve(process.cwd(), "src/screens/auth/ExtensionAuthScreen.tsx"), "utf8");

    expect(source).toContain("LoadingSpinner");
    expect(source).not.toMatch(/text-\[[^\]]+\]/);
    expect(source).not.toMatch(/max-w-\[[^\]]+\]/);
    expect(source).not.toMatch(/tracking-\[[^\]]+\]/);
    expect(source).not.toContain("animate-spin");
  });
});
