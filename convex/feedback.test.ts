// @vitest-environment edge-runtime

import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { MESSAGE_MAX_LENGTH, RATE_LIMIT_MAX_PER_WINDOW } from "./feedback";

const modules = import.meta.glob("./**/*.*s");

const baseArgs = {
  message: "Love the canvas view!",
  type: "feedback" as const,
  anonymous: false,
  email: "user@example.com",
};

describe("feedback.submit", () => {
  it("rejects unauthenticated callers", async () => {
    const t = convexTest(schema, modules);

    await expect(t.mutation(api.feedback.submit, baseArgs)).rejects.toThrow(
      "You must be signed in",
    );
  });

  it("rejects empty and over-length messages", async () => {
    const t = convexTest(schema, modules);
    const asUser = t.withIdentity({ tokenIdentifier: "feedback-test-user" });

    await expect(
      asUser.mutation(api.feedback.submit, { ...baseArgs, message: "   " }),
    ).rejects.toThrow("cannot be empty");

    await expect(
      asUser.mutation(api.feedback.submit, {
        ...baseArgs,
        message: "x".repeat(MESSAGE_MAX_LENGTH + 1),
      }),
    ).rejects.toThrow("too long");
  });

  it("rate-limits after the per-window maximum", async () => {
    const t = convexTest(schema, modules);
    const asUser = t.withIdentity({ tokenIdentifier: "feedback-test-user" });

    for (let i = 0; i < RATE_LIMIT_MAX_PER_WINDOW; i++) {
      await asUser.mutation(api.feedback.submit, baseArgs);
    }

    await expect(asUser.mutation(api.feedback.submit, baseArgs)).rejects.toThrow(
      "try again in a little while",
    );

    // Another user is unaffected.
    const asOther = t.withIdentity({ tokenIdentifier: "feedback-other-user" });
    await expect(asOther.mutation(api.feedback.submit, baseArgs)).resolves.toBeNull();
  });

  it("drops the email and stores no user identifier for anonymous feedback", async () => {
    const t = convexTest(schema, modules);
    const asUser = t.withIdentity({ tokenIdentifier: "feedback-test-user" });

    await asUser.mutation(api.feedback.submit, {
      ...baseArgs,
      anonymous: true,
    });

    const rows = await t.run(async (ctx) => ctx.db.query("feedback").collect());
    expect(rows).toHaveLength(1);
    expect(rows[0].email).toBeUndefined();
    expect(JSON.stringify(rows[0])).not.toContain("feedback-test-user");
  });

  it("truncates oversized diagnostic metadata", async () => {
    const t = convexTest(schema, modules);
    const asUser = t.withIdentity({ tokenIdentifier: "feedback-test-user" });

    await asUser.mutation(api.feedback.submit, {
      ...baseArgs,
      userAgent: "a".repeat(1000),
      appVersion: "b".repeat(200),
    });

    const rows = await t.run(async (ctx) => ctx.db.query("feedback").collect());
    expect(rows[0].userAgent).toHaveLength(400);
    expect(rows[0].appVersion).toHaveLength(60);
  });
});
