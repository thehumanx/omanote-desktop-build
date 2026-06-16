import { describe, expect, it } from "vitest";
import { parseLatestVersion, parseVersions } from "./update-checker";

const markdown = `
# omanote

## Versions

### v0.12.5 [May 5, 2026]

> Webapp summary.

- [Fix] Webapp item.

## Extension Versions

### v2.0.0 [May 7, 2026]

> Extension summary.

- [Update] Extension item.

### v1.0.0 [May 2, 2026]

- [Add] First extension item.
`;

describe("update-checker", () => {
  it("parses webapp versions from the default README section", () => {
    expect(parseVersions(markdown)).toEqual([
      {
        version: "v0.12.5",
        date: "May 5, 2026",
        summary: "Webapp summary.",
        items: ["[Fix] Webapp item."],
      },
    ]);
  });

  it("parses extension versions from the extension README section", () => {
    expect(parseVersions(markdown, "Extension Versions")).toEqual([
      {
        version: "v2.0.0",
        date: "May 7, 2026",
        summary: "Extension summary.",
        items: ["[Update] Extension item."],
      },
      {
        version: "v1.0.0",
        date: "May 2, 2026",
        summary: "",
        items: ["[Add] First extension item."],
      },
    ]);
  });

  it("reads the latest extension version from the extension README section", () => {
    expect(parseLatestVersion(markdown, "Extension Versions")?.version).toBe("v2.0.0");
  });
});
