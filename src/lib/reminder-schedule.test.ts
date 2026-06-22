import { describe, expect, it } from "vitest";
import { computeReminderTriggerAt } from "./reminder-schedule";

describe("reminder-schedule", () => {
  it("triggers exactly on due time when lead is 0", () => {
    const due = new Date("2026-04-23T10:00:00.000Z");
    expect(computeReminderTriggerAt(due, 0).toISOString()).toBe("2026-04-23T10:00:00.000Z");
  });

  it("triggers 15 minutes early when lead is 15", () => {
    const due = new Date("2026-04-23T10:00:00.000Z");
    expect(computeReminderTriggerAt(due, 15).toISOString()).toBe("2026-04-23T09:45:00.000Z");
  });
});
