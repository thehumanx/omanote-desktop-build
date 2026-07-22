import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import bundledChangelogMarkdown from "../../CHANGELOG.md?raw";
import { isTauri } from "../lib/desktop";
import { getLastSeenVersion, getUnseenVersions, markVersionSeen, parseVersions, type VersionInfo } from "../lib/update-checker";

const MODAL_OPEN_TRANSITION_MS = 320;

type ChangelogManifest = {
  version: string;
  versions: VersionInfo[];
  changelog: string;
};

type UpdateContextValue = {
  changelogMarkdown: string;
  latestVersion: VersionInfo | null;
  unseenVersions: VersionInfo[];
  modalVersions: VersionInfo[];
  extraUpdatesCount: number;
  hasUpdate: boolean;
  isBannerVisible: boolean;
  isModalOpen: boolean;
  isTransitioningToModal: boolean;
  openModal: () => void;
  closeModal: () => void;
  dismissBanner: () => void;
};

export const UpdateContext = createContext<UpdateContextValue | null>(null);

const POLL_INTERVAL_MS = 5 * 60 * 1000;
const LIVE_VERSION_URL = "https://omanote.com/version.json";

export function UpdateProvider({ children }: { children: ReactNode }) {
  const [versions, setVersions] = useState<VersionInfo[]>(() => parseVersions(bundledChangelogMarkdown));
  const [changelogMarkdown, setChangelogMarkdown] = useState(bundledChangelogMarkdown);
  const bundledVersion = useRef<string | null>(versions[0]?.version ?? null);
  const [lastSeen, setLastSeen] = useState<string | null>(() => getLastSeenVersion());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTransitioningToModal, setIsTransitioningToModal] = useState(false);
  const [isBannerDismissed, setIsBannerDismissed] = useState(false);
  const [modalVersions, setModalVersions] = useState<VersionInfo[]>([]);
  const modalTransitionTimeoutRef = useRef<number | null>(null);

  const latestVersion = versions[0] ?? null;
  const unseenVersions = useMemo(() => getUnseenVersions(versions, lastSeen), [versions, lastSeen]);
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

    const endpointUrl = isDesktop ? LIVE_VERSION_URL : "/version.json";

    const check = async () => {
      try {
        const res = await fetch(endpointUrl, { cache: "no-store" });
        if (!res.ok) return;
        const data: ChangelogManifest = await res.json();
        if (data.version && bundledVersion.current && data.version !== bundledVersion.current) {
          setVersions(data.versions ?? []);
          if (data.changelog) setChangelogMarkdown(data.changelog);
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
        changelogMarkdown,
        latestVersion,
        unseenVersions,
        modalVersions,
        extraUpdatesCount,
        hasUpdate,
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
