import { describe, expect, it } from "vitest";
import { extractFirstPreviewableUrl } from "./attachment-link-preview";

describe("extractFirstPreviewableUrl", () => {
  it("returns undefined when there are no links", () => {
    expect(extractFirstPreviewableUrl("plain text only")).toBeUndefined();
  });

  it("extracts the first markdown link", () => {
    expect(extractFirstPreviewableUrl("Read [this](https://example.com/path?q=1) later")).toBe("https://example.com/path?q=1");
  });

  it("extracts a plain URL", () => {
    expect(extractFirstPreviewableUrl("check https://convex.dev/docs now")).toBe("https://convex.dev/docs");
  });

  it("normalizes bare hostnames", () => {
    expect(extractFirstPreviewableUrl("visit omanote.app for context")).toBe("https://omanote.app/");
  });

  it("ignores non-http links", () => {
    expect(extractFirstPreviewableUrl("mail me at mailto:test@example.com")).toBeUndefined();
    expect(extractFirstPreviewableUrl("call me tel:+15555555555")).toBeUndefined();
  });

  it("ignores local and private hosts that cannot be previewed safely", () => {
    expect(extractFirstPreviewableUrl("local http://localhost:5173")).toBeUndefined();
    expect(extractFirstPreviewableUrl("loopback http://127.0.0.1:3000")).toBeUndefined();
    expect(extractFirstPreviewableUrl("lan http://192.168.1.10/page")).toBeUndefined();
    expect(extractFirstPreviewableUrl("internal https://notes.internal/page")).toBeUndefined();
  });

  it("trims trailing punctuation around URLs", () => {
    expect(extractFirstPreviewableUrl("https://example.com/path).")).toBe("https://example.com/path");
    expect(extractFirstPreviewableUrl("(https://example.com/path?x=1),")).toBe("https://example.com/path?x=1");
  });

  it("checks multiple fields in order and returns first valid link", () => {
    expect(extractFirstPreviewableUrl("first has no link", "next has https://example.com", "another https://second.com")).toBe(
      "https://example.com/",
    );
  });
});
