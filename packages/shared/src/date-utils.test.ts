import { describe, expect, it } from "vitest";
import { formatDueChip } from "./date-utils";

describe("formatDueChip", () => {
  it("shows today when a todo is due on the visible date", () => {
    expect(formatDueChip("2026-06-20", undefined, "2026-06-20", "2026-06-20")).toBe("Today");
  });

  it("includes the time when a todo is due today with a time", () => {
    expect(formatDueChip("2026-06-20", "14:30", "2026-06-20", "2026-06-20")).toBe("2:30PM, Today");
  });

  it("keeps formatted dates for todos due on another date", () => {
    expect(formatDueChip("2026-07-15", undefined, "2026-06-20", "2026-06-20")).toBe("Wed, Jul 15");
  });
});
