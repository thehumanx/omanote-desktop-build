import { describe, expect, it } from "vitest";
import { appendMarkdownSourceLink } from "./markdown";

describe("appendMarkdownSourceLink", () => {
  it("appends the source as a markdown link instead of a raw URL", () => {
    expect(
      appendMarkdownSourceLink("A useful clipping", "https://example.com/very/long/path"),
    ).toBe("A useful clipping\n\n[Source](https://example.com/very/long/path)");
  });

  it("escapes closing parentheses in source URLs", () => {
    expect(
      appendMarkdownSourceLink("A useful clipping", "https://example.com/wiki/Foo_(bar)"),
    ).toBe("A useful clipping\n\n[Source](https://example.com/wiki/Foo_(bar\\))");
  });
});
