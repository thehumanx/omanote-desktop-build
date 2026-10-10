import { useEffect, useMemo } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { detectWebClientType, getCurrentDeviceMetadata } from "../lib/device-info";
import { getDesktopAppVersion } from "../lib/desktop";
import { useEncryption } from "../contexts/EncryptionContext";
import { useAuth } from "../app/auth/AuthContext";
import { clearFirstTouch, readFirstTouch } from "../lib/acquisition";

const DEVICE_TOUCH_INTERVAL_MS = 5 * 60 * 1000;

export function DeviceActivityReporter() {
  const touchDevice = useMutation(api.devices.touchDevice);
  const recordOpen = useMutation(api.appSessions.recordOpen);
  const recordFirstTouch = useMutation(api.acquisition.recordFirstTouch);
  const device = useMemo(() => getCurrentDeviceMetadata(detectWebClientType()), []);
  const { lock } = useEncryption();
  const { signOut } = useAuth();

  // Fire-and-forget, once per mount — recordOpen is idempotent per user per
  // UTC day server-side, so this doesn't need its own throttling here. This
  // closes the PMF dashboard's biggest blind spot: activityHistory only
  // records writes, so a read-only session was previously invisible.
  useEffect(() => {
    recordOpen({ clientType: device.clientType }).catch(() => {
      // Session pings are diagnostic, not a blocking app feature.
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Where this browser first came from, sent once after signing in. The server
  // keeps it only for a new account and only once, so it's safe to send from
  // every browser that has one; either answer means it can be dropped here.
  useEffect(() => {
    const touch = readFirstTouch();
    if (!touch) return;
    recordFirstTouch(touch)
      .then(() => clearFirstTouch())
      .catch(() => {
        // Kept for the next load.
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    let interval: number | undefined;
    let onVisible: (() => void) | undefined;

    void getDesktopAppVersion().then((appVersion) => {
      if (cancelled) return;
      const payload = appVersion ? { ...device, appVersion } : device;
      const report = () => {
        // A hidden tab has nothing to report; it reports when shown again.
        if (document.visibilityState === "hidden") return;
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
      onVisible = () => {
        if (document.visibilityState === "visible") report();
      };
      document.addEventListener("visibilitychange", onVisible);
    });

    return () => {
      cancelled = true;
      if (interval !== undefined) window.clearInterval(interval);
      if (onVisible) document.removeEventListener("visibilitychange", onVisible);
    };
  }, [device, touchDevice, lock, signOut]);

  return null;
}
