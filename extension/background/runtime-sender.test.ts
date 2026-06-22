import { describe, expect, it, vi } from "vitest";
import { isTrustedRuntimeSender } from "./runtime-sender";

describe("isTrustedRuntimeSender", () => {
  it("accepts Firefox extension-page messages without sender.id", () => {
    vi.stubGlobal("chrome", { runtime: { id: "omanote-extension" } });

    expect(isTrustedRuntimeSender({})).toBe(true);
  });

  it("accepts same-extension messages and rejects external senders", () => {
    vi.stubGlobal("chrome", { runtime: { id: "omanote-extension" } });

    expect(isTrustedRuntimeSender({ id: "omanote-extension" })).toBe(true);
    expect(isTrustedRuntimeSender({ id: "other-extension" })).toBe(false);
  });
});
