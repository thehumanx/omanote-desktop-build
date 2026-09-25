import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { appVersions } from "virtual:changelog";
import { isTauri } from "../lib/desktop";
import type { VersionInfo } from "../lib/changelog-parse";
import { getLastSeenVersion, getUnseenVersions, markVersionSeen } from "../lib/update-checker";

const MODAL_OPEN_TRANSITION_MS = 320;

type ChangelogManifest = {
  version: string;
  versions: VersionInfo[];
};

type UpdateContextValue = {
  latestVersion: VersionInfo | null;
  unseenVersions: VersionInfo[];
  modalVersions: VersionInfo[];
  extraUpdatesCount: number;
  hasUpdate: boolean;
  isRunningLatest: boolean;
  isBannerVisible: boolean;
  isModalOpen: boolean;
  isTransitioningToModal: boolean;
  openModal: () => void;
  closeModal: () => void;
  dismissBanner: () => void;
};

const UpdateContext = createContext<UpdateContextValue | null>(null);

const POLL_INTERVAL_MS = 5 * 60 * 1000;
const LIVE_ORIGIN = "https://omanote.com";

export function UpdateProvider({ children }: { children: ReactNode }) {
  const [versions, setVersions] = useState<VersionInfo[]>(appVersions);
  const bundledVersion = useRef<string | null>(versions[0]?.version ?? null);
  const [lastSeen, setLastSeen] = useState<string | null>(() => getLastSeenVersion());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTransitioningToModal, setIsTransitioningToModal] = useState(false);
  const [isBannerDismissed, setIsBannerDismissed] = useState(false);
  const [modalVersions, setModalVersions] = useState<VersionInfo[]>([]);
  const modalTransitionTimeoutRef = useRef<number | null>(null);

  const latestVersion = versions[0] ?? null;
  const unseenVersions = useMemo(() => getUnseenVersions(versions, lastSeen), [versions, lastSeen]);
  // Reloading only ever applies whatever the currently-running bundle already
  // is — if that's already the latest version (e.g. the user just reloaded,
  // or opened the app fresh right after an update), there's nothing a
  // further reload would change, so there's nothing to notify about even if
  // this version was never explicitly marked "seen".
  const isRunningLatest = Boolean(latestVersion) && latestVersion!.version === bundledVersion.current;
  // Even when the running bundle already is the latest version, there's
  // still a changelog the user hasn't seen — keep surfacing the notice, just
  // without a "refresh" action that wouldn't do anything.
  const hasUpdate = unseenVersions.length > 0;
  const extraUpdatesCount = Math.max(unseenVersions.length - 1, 0);
  const shouldShowBanner = hasUpdate || isTransitioningToModal;
  const isBannerVisible = Boolean(latestVersion) && !isBannerDismissed && shouldShowBanner && (!isModalOpen || isTransitioningToModal);

  const clearModalTransitionTimeout = () => {
    if (modalTransitionTimeoutRef.current !== null) {
      window.clearTimeout(modalTransitionTimeoutRef.current);
      modalTransitionTimeoutRef.current = null;
    }
  };

  const prefersReducedMotion = () => {
    if (typeof window === "undefined") return true;

    try {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      return false;
    }
  };

  useEffect(() => {
    const isDesktop = isTauri();
    // In Tauri dev mode the local dev server is the source of truth — skip remote fetch.
    if (isDesktop && import.meta.env.DEV) return;

    const origin = isDesktop ? LIVE_ORIGIN : "";

    const check = async () => {
      try {
        // Tauri's webview enforces CORS on the default `fetch` just like a
        // browser, and omanote.com doesn't send an Access-Control-Allow-Origin
        // header for the tauri://localhost origin. The http plugin issues the
        // request natively from Rust instead, bypassing that restriction.
        const doFetch = isDesktop ? (await import("@tauri-apps/plugin-http")).fetch : fetch;
        // Poll the ~30-byte file; only pull release notes once there's
        // actually something new (see src/build/vite-changelog-plugin.ts).
        const latestRes = await doFetch(`${origin}/version-latest.json`, { cache: "no-store" });
        if (!latestRes.ok) return;
        const latest: { version?: string } = await latestRes.json();
        if (!latest.version || !bundledVersion.current || latest.version === bundledVersion.current) return;
        const res = await doFetch(`${origin}/version.json`, { cache: "no-store" });
        if (!res.ok) return;
        const data: ChangelogManifest = await res.json();
        if (data.version && data.version !== bundledVersion.current) {
          setVersions(data.versions ?? []);
          setIsBannerDismissed(false);
        }
      } catch {
        // network unavailable — silent fail
      }
    };

    const intervalId = window.setInterval(check, POLL_INTERVAL_MS);
    const onVisible = () => { if (document.visibilityState === "visible") check(); };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  useEffect(() => {
    if (!hasUpdate || !latestVersion) return;
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;

    new Notification(`New update: ${latestVersion.version}`, {
      body: latestVersion.summary || "Check out what's new in omanote!",
      icon: "/android-chrome-192x192.png",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      clearModalTransitionTimeout();
    };
  }, []);

  const openModal = () => {
    if (!latestVersion) return;
    clearModalTransitionTimeout();
    setModalVersions(unseenVersions.length > 0 ? unseenVersions : [latestVersion]);
    setIsModalOpen(true);
    setIsTransitioningToModal(true);
    markVersionSeen(latestVersion.version);
    setLastSeen(latestVersion.version);

    if (prefersReducedMotion()) {
      setIsTransitioningToModal(false);
      return;
    }

    modalTransitionTimeoutRef.current = window.setTimeout(() => {
      setIsTransitioningToModal(false);
      modalTransitionTimeoutRef.current = null;
    }, MODAL_OPEN_TRANSITION_MS);
  };

  const closeModal = () => {
    clearModalTransitionTimeout();
    setIsModalOpen(false);
    setIsTransitioningToModal(false);
    setModalVersions([]);
  };

  const dismissBanner = () => {
    clearModalTransitionTimeout();
    setIsBannerDismissed(true);
    if (latestVersion) {
      markVersionSeen(latestVersion.version);
      setLastSeen(latestVersion.version);
    }
  };

  return (
    <UpdateContext.Provider
      value={{
        latestVersion,
        unseenVersions,
        modalVersions,
        extraUpdatesCount,
        hasUpdate,
        isRunningLatest,
        isBannerVisible,
        isModalOpen,
        isTransitioningToModal,
        openModal,
        closeModal,
        dismissBanner,
      }}
    >
      {children}
    </UpdateContext.Provider>
  );
}

export function useUpdate() {
  const ctx = useContext(UpdateContext);
  if (!ctx) throw new Error("useUpdate must be used inside UpdateProvider");
  return ctx;
}
