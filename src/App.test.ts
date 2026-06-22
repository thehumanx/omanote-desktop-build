import { describe, expect, it } from "vitest";
import { getAuthenticatedLayoutKind } from "./App";

describe("getAuthenticatedLayoutKind", () => {
  it("keeps settings in the app layout so providers stay mounted", () => {
    expect(getAuthenticatedLayoutKind("/settings")).toBe("app");
  });

  it("uses the full app layout for workspace routes", () => {
    expect(getAuthenticatedLayoutKind("/canvas")).toBe("app");
  });
});
