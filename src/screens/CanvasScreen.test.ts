import { describe, expect, it } from "vitest";
import { getCanvasOrderRepairSignature } from "./CanvasScreen";

describe("getCanvasOrderRepairSignature", () => {
  it("returns the same signature for repeated repairs of the same order", () => {
    const signature = getCanvasOrderRepairSignature("2026-05-07", [
      { artifactType: "todo", artifactId: "todo_1" },
      { artifactType: "note", artifactId: "note_1" },
    ]);

    expect(getCanvasOrderRepairSignature("2026-05-07", [
      { artifactType: "todo", artifactId: "todo_1" },
      { artifactType: "note", artifactId: "note_1" },
    ])).toBe(signature);
  });

  it("changes when the repaired order changes", () => {
    const first = getCanvasOrderRepairSignature("2026-05-07", [
      { artifactType: "todo", artifactId: "todo_1" },
    ]);

    const second = getCanvasOrderRepairSignature("2026-05-07", [
      { artifactType: "todo", artifactId: "todo_2" },
    ]);

    expect(second).not.toBe(first);
  });
});
