import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { DeviceActivityReporter } from "./DeviceActivityReporter";

const { mockTouchDevice } = vi.hoisted(() => ({
  mockTouchDevice: vi.fn(async () => {}),
}));

vi.mock("convex/react", () => ({
  useMutation: () => mockTouchDevice,
}));

vi.mock("../lib/device-info", () => ({
  detectWebClientType: () => "web",
  getCurrentDeviceMetadata: () => ({
    deviceId: "web-current",
    clientType: "web",
    deviceName: "Chrome on macOS",
    browserName: "Chrome",
    platformName: "macOS",
    userAgent: "test-agent",
  }),
}));

vi.mock("../contexts/EncryptionContext", () => ({
  useEncryption: () => ({
    lock: vi.fn(),
  }),
}));

vi.mock("../app/auth/AuthContext", () => ({
  useAuth: () => ({
    signOut: vi.fn(),
  }),
}));

describe("DeviceActivityReporter", () => {
  beforeEach(() => {
    mockTouchDevice.mockClear();
  });

  it("reports the current web device on mount", async () => {
    render(<DeviceActivityReporter />);

    await waitFor(() => {
      expect(mockTouchDevice).toHaveBeenCalledWith({
        deviceId: "web-current",
        clientType: "web",
        deviceName: "Chrome on macOS",
        browserName: "Chrome",
        platformName: "macOS",
        userAgent: "test-agent",
      });
    });
  });
});
