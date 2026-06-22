import { describe, expect, it } from "vitest";
import { detectComposerArtifact } from "./detection";

describe("detectComposerArtifact", () => {
  it("detects slash event commands as event entries", () => {
    expect(detectComposerArtifact("/event morning run 6:45 AM")).toEqual({
      kind: "event",
      value: "morning run 6:45 AM",
      command: "event",
    });
  });
});
