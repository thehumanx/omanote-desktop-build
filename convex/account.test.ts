// @vitest-environment edge-runtime

import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");

describe("account.deleteMyData", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("throws when there is no authenticated user", async () => {
    const t = convexTest(schema, modules);

    await expect(t.mutation(api.account.deleteMyData, {})).rejects.toThrow("Unauthorized");
  });

  it("deletes only the authenticated user's settings and encryption keys", async () => {
    const t = convexTest(schema, modules);
    const asFirstUser = t.withIdentity({ tokenIdentifier: "account-test-user-1" });
    const asSecondUser = t.withIdentity({ tokenIdentifier: "account-test-user-2" });

    await asFirstUser.mutation(api.userSettings.upsertMySettings, {
      saveShortcut: "enter",
      newlineShortcut: "shift_enter",
    });
    await asFirstUser.mutation(api.encryptionKeys.saveKey, {
      wrappedKey: "wrapped-key-1",
      salt: "salt-1",
    });
    await asFirstUser.mutation(api.devices.touchDevice, {
      deviceId: "first-device",
      clientType: "web",
      deviceName: "Chrome on macOS",
    });

    await asSecondUser.mutation(api.userSettings.upsertMySettings, {
      saveShortcut: "mod_enter",
      newlineShortcut: "enter",
    });
    await asSecondUser.mutation(api.encryptionKeys.saveKey, {
      wrappedKey: "wrapped-key-2",
      salt: "salt-2",
    });
    await asSecondUser.mutation(api.devices.touchDevice, {
      deviceId: "second-device",
      clientType: "extension",
      deviceName: "Firefox Extension on Windows",
    });

    vi.useFakeTimers();
    await expect(asFirstUser.mutation(api.account.deleteMyData, {})).resolves.toEqual({ ok: true });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    await expect(asFirstUser.query(api.userSettings.getMySettings, {})).resolves.toBeNull();
    await expect(asFirstUser.query(api.encryptionKeys.getKey, {})).resolves.toBeNull();
    await expect(asFirstUser.query(api.devices.listMyDevices, {})).resolves.toEqual([]);
    await expect(asSecondUser.query(api.userSettings.getMySettings, {})).resolves.toMatchObject({
      userId: "account-test-user-2",
    });
    await expect(asSecondUser.query(api.encryptionKeys.getKey, {})).resolves.toMatchObject({
      userId: "account-test-user-2",
    });
    await expect(asSecondUser.query(api.devices.listMyDevices, {})).resolves.toMatchObject([
      { userId: "account-test-user-2", deviceId: "second-device" },
    ]);
  });

  it("continues deleting large accounts through scheduled batches", async () => {
    vi.useFakeTimers();
    const t = convexTest(schema, modules);
    const asFirstUser = t.withIdentity({ tokenIdentifier: "account-batch-user-1" });
    const asSecondUser = t.withIdentity({ tokenIdentifier: "account-batch-user-2" });

    for (let index = 0; index < 60; index += 1) {
      await asFirstUser.mutation(api.devices.touchDevice, {
        deviceId: `first-device-${index}`,
        clientType: "web",
        deviceName: `First device ${index}`,
      });
      await asSecondUser.mutation(api.devices.touchDevice, {
        deviceId: `second-device-${index}`,
        clientType: "web",
        deviceName: `Second device ${index}`,
      });
    }

    await asFirstUser.mutation(api.account.deleteMyData, {});

    await expect(asFirstUser.query(api.devices.listMyDevices, { limit: 100 })).resolves.not.toEqual([]);

    await t.finishAllScheduledFunctions(vi.runAllTimers);

    await expect(asFirstUser.query(api.devices.listMyDevices, { limit: 100 })).resolves.toEqual([]);
    await expect(asSecondUser.query(api.devices.listMyDevices, { limit: 100 })).resolves.toHaveLength(50);
  });
});
