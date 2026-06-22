import { describe, expect, it } from "vitest";
import { findTargetByName, selectPreferredTargetId, sortTargetsByName } from "./folder-selection";

const targets = [
  { _id: "z", name: "Zebra" },
  { _id: "a", name: "Archive" },
  { _id: "m", name: "Maybe" },
];

describe("folder selection helpers", () => {
  it("keeps the last selected target when it still exists", () => {
    expect(selectPreferredTargetId(targets, "m")).toBe("m");
  });

  it("falls back to the alphabetically first target", () => {
    expect(selectPreferredTargetId(targets, "missing")).toBe("a");
  });

  it("sorts targets by display name", () => {
    expect(sortTargetsByName(targets).map((target) => target.name)).toEqual(["Archive", "Maybe", "Zebra"]);
  });

  it("detects duplicate names case-insensitively after trimming", () => {
    expect(findTargetByName(targets, " archive ")?._id).toBe("a");
  });
});
