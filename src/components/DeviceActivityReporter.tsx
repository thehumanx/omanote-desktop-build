import { useEffect, useMemo } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { detectWebClientType, getCurrentDeviceMetadata } from "../lib/device-info";
import { getDesktopAppVersion } from "../lib/desktop";
import { useEncryption } from "../contexts/EncryptionContext";
import { useAuth } from "../app/auth/AuthContext";

const DEVICE_TOUCH_INTERVAL_MS = 5 * 60 * 1000;

export function DeviceActivityReporter() {
  const touchDevice = useMutation(api.devices.touchDevice);
  const device = useMemo(() => getCurrentDeviceMetadata(detectWebClientType()), []);
  const { lock } = useEncryption();
  const { signOut } = useAuth();

  useEffect(() => {
    let cancelled = false;
    let interval: number | undefined;

    void getDesktopAppVersion().then((appVersion) => {
      if (cancelled) return;
      const payload = appVersion ? { ...device, appVersion } : device;
      const report = () => {
        touchDevice(payload)
          .then((result) => {
            if (!cancelled && result?.wasRevoked) {
              lock();
              signOut();
            }
          })
          .catch(() => {
            // Device activity is helpful metadata, not a blocking app feature.
          });
      };

      report();
      interval = window.setInterval(report, DEVICE_TOUCH_INTERVAL_MS);
    });

    return () => {
      cancelled = true;
      if (interval !== undefined) window.clearInterval(interval);
    };
  }, [device, touchDevice, lock, signOut]);

  return null;
}
