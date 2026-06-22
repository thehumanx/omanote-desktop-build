import { useEffect, useRef, useState } from "react";
import { Wifi, WifiOff } from "lucide-react";
import { useNetworkStatus } from "../hooks/useNetworkStatus";

type BannerPhase = "hidden" | "offline" | "online" | "exiting";

const ONLINE_VISIBLE_MS = 2200;
const EXIT_MS = 220;

export function OfflineStatusBanner() {
  const { isOffline } = useNetworkStatus();
  const [phase, setPhase] = useState<BannerPhase>(() => (isOffline ? "offline" : "hidden"));
  const wasOfflineRef = useRef(isOffline);
  const onlineTimerRef = useRef<number | null>(null);
  const exitTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (onlineTimerRef.current) window.clearTimeout(onlineTimerRef.current);
      if (exitTimerRef.current) window.clearTimeout(exitTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (onlineTimerRef.current) window.clearTimeout(onlineTimerRef.current);
    if (exitTimerRef.current) window.clearTimeout(exitTimerRef.current);
    onlineTimerRef.current = null;
    exitTimerRef.current = null;

    if (isOffline) {
      wasOfflineRef.current = true;
      setPhase("offline");
      return;
    }

    if (!wasOfflineRef.current) {
      setPhase("hidden");
      return;
    }

    wasOfflineRef.current = false;
    setPhase("online");
    onlineTimerRef.current = window.setTimeout(() => {
      setPhase("exiting");
      exitTimerRef.current = window.setTimeout(() => {
        setPhase("hidden");
      }, EXIT_MS);
    }, ONLINE_VISIBLE_MS);
  }, [isOffline]);

  if (phase === "hidden") return null;
  const reconnecting = phase === "online" || phase === "exiting";
  const visible = phase !== "exiting";
  const containerWidth = reconnecting ? "min(92vw, 360px)" : "min(92vw, 440px)";

  return (
    <div
      style={{ width: containerWidth }}
      className={[
        "pointer-events-none fixed bottom-[72px] left-1/2 z-40 -translate-x-1/2",
        "transition-[opacity,transform,width] duration-500 ease-out",
        visible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
      ].join(" ")}
    >
      <div
        className={[
          "flex items-center gap-2.5 rounded-xl border bg-app-surface shadow-app-bubble",
          "transition-[padding,border-color] duration-500 ease-out",
          reconnecting ? "px-3.5 py-2" : "border-app-line px-4 py-2.5",
        ].join(" ")}
      >
        {reconnecting ? (
          <Wifi className="h-3.5 w-3.5 flex-shrink-0 text-success-solid" />
        ) : (
          <WifiOff className="h-3.5 w-3.5 flex-shrink-0 text-app-ink-faint" />
        )}
        <p className="text-xs text-app-ink-faint leading-snug">
          {reconnecting
            ? "Back online — syncing your changes now…"
            : "You're offline — keep using omanote as usual. Changes will sync when you reconnect."}
        </p>
      </div>
    </div>
  );
}
