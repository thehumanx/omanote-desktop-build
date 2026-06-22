// @vitest-environment edge-runtime

import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");

describe("devices", () => {
  it("requires authentication", async () => {
    const t = convexTest(schema, modules);

    await expect(t.query(api.devices.listMyDevices, {})).rejects.toThrow("Unauthorized");
    await expect(t.mutation(api.devices.touchDevice, {
      deviceId: "device-1",
      clientType: "web",
      deviceName: "Chrome on macOS",
      browserName: "Chrome",
      platformName: "macOS",
      userAgent: "Mozilla/5.0",
    })).rejects.toThrow("Unauthorized");
  });

  it("creates and updates one row per user device", async () => {
    const t = convexTest(schema, modules);
    const asUser = t.withIdentity({ tokenIdentifier: "devices-test-user" });

    await asUser.mutation(api.devices.touchDevice, {
      deviceId: "web-device",
      clientType: "web",
      deviceName: "Chrome on macOS",
      browserName: "Chrome",
      platformName: "macOS",
      userAgent: "Mozilla/5.0 Chrome/120",
    });

    const firstList = await asUser.query(api.devices.listMyDevices, {});
    expect(firstList).toHaveLength(1);
    expect(firstList[0]).toMatchObject({
      userId: "devices-test-user",
      deviceId: "web-device",
      clientType: "web",
      deviceName: "Chrome on macOS",
      browserName: "Chrome",
      platformName: "macOS",
      userAgent: "Mozilla/5.0 Chrome/120",
    });
    expect(firstList[0].firstSeenAt).toBe(firstList[0].lastActiveAt);

    await asUser.mutation(api.devices.touchDevice, {
      deviceId: "web-device",
      clientType: "web",
      deviceName: "Chrome on macOS",
      browserName: "Chrome",
      platformName: "macOS",
      userAgent: "Mozilla/5.0 Chrome/121",
    });

    const secondList = await asUser.query(api.devices.listMyDevices, {});
    expect(secondList).toHaveLength(1);
    expect(secondList[0].firstSeenAt).toBe(firstList[0].firstSeenAt);
    expect(secondList[0].lastActiveAt).toBeGreaterThanOrEqual(firstList[0].lastActiveAt);
    expect(secondList[0].userAgent).toBe("Mozilla/5.0 Chrome/121");
  });

  it("returns the most recently active devices first and respects the limit", async () => {
    const t = convexTest(schema, modules);
    const asUser = t.withIdentity({ tokenIdentifier: "devices-test-user" });

    await asUser.mutation(api.devices.touchDevice, {
      deviceId: "web-device",
      clientType: "web",
      deviceName: "Chrome on macOS",
      browserName: "Chrome",
      platformName: "macOS",
    });
    await new Promise((resolve) => setTimeout(resolve, 2));
    await asUser.mutation(api.devices.touchDevice, {
      deviceId: "extension-device",
      clientType: "extension",
      deviceName: "Chrome Extension on macOS",
      browserName: "Chrome",
      platformName: "macOS",
    });

    const devices = await asUser.query(api.devices.listMyDevices, { limit: 1 });

    expect(devices).toHaveLength(1);
    expect(devices[0].deviceId).toBe("extension-device");
  });

  it("does not let revoked devices crowd active devices out of limited results", async () => {
    const t = convexTest(schema, modules);
    const asUser = t.withIdentity({ tokenIdentifier: "devices-test-user" });

    await asUser.mutation(api.devices.touchDevice, {
      deviceId: "active-device",
      clientType: "web",
      deviceName: "Chrome on macOS",
    });

    for (let index = 0; index < 25; index += 1) {
      const deviceId = `revoked-device-${index}`;
      await new Promise((resolve) => setTimeout(resolve, 1));
      await asUser.mutation(api.devices.touchDevice, {
        deviceId,
        clientType: "web",
        deviceName: `Revoked ${index}`,
      });
      const devices = await asUser.query(api.devices.listMyDevices, { limit: 50 });
      const device = devices.find((candidate) => candidate.deviceId === deviceId);
      expect(device).toBeDefined();
      await asUser.mutation(api.devices.removeDevice, { id: device!._id });
    }

    const devices = await asUser.query(api.devices.listMyDevices, { limit: 1 });

    expect(devices).toHaveLength(1);
    expect(devices[0].deviceId).toBe("active-device");
  });
});
