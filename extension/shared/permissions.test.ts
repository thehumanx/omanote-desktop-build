import { describe, expect, it, vi } from "vitest";
import { APP_HOST_ORIGINS, ensureAppHostPermission } from "./permissions";

describe("ensureAppHostPermission", () => {
  it("does not prompt when the app host is already granted", async () => {
    const contains = vi.fn().mockResolvedValue(true);
    const request = vi.fn().mockResolvedValue(true);

    const granted = await ensureAppHostPermission({ contains, request });

    expect(granted).toBe(true);
    expect(contains).toHaveBeenCalledWith({ origins: APP_HOST_ORIGINS });
    expect(request).not.toHaveBeenCalled();
  });

  it("requests the app host when it is not granted", async () => {
    const contains = vi.fn().mockResolvedValue(false);
    const request = vi.fn().mockResolvedValue(true);

    const granted = await ensureAppHostPermission({ contains, request });

    expect(granted).toBe(true);
    expect(request).toHaveBeenCalledWith({ origins: APP_HOST_ORIGINS });
  });

  it("does not block sign-in when the permissions API cannot answer", async () => {
    const contains = vi.fn().mockRejectedValue(new Error("permissions unavailable"));
    const request = vi.fn().mockResolvedValue(false);

    const granted = await ensureAppHostPermission({ contains, request });

    expect(granted).toBe(true);
    expect(request).not.toHaveBeenCalled();
  });

  it("does not block sign-in when Firefox rejects the permission prompt", async () => {
    const contains = vi.fn().mockResolvedValue(false);
    const request = vi.fn().mockRejectedValue(new Error("cannot request required host permission"));

    const granted = await ensureAppHostPermission({ contains, request });

    expect(granted).toBe(true);
  });
});
