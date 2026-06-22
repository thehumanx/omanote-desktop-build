import { describe, expect, it } from "vitest";
import { normalizeGraphArtifactType } from "./HashtagGraph";

describe("normalizeGraphArtifactType", () => {
  it("maps legacy routine hashtag usages to event graph artifacts", () => {
    expect(normalizeGraphArtifactType("routine")).toBe("event");
  });

  it("keeps supported graph artifact types unchanged", () => {
    expect(normalizeGraphArtifactType("note")).toBe("note");
    expect(normalizeGraphArtifactType("todo")).toBe("todo");
    expect(normalizeGraphArtifactType("event")).toBe("event");
  });
});
