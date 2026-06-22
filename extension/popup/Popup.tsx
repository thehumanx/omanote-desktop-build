import { useCallback, useEffect, useState } from "react";
import type { FormEvent, PointerEvent } from "react";
import { AuthScreen } from "./components/AuthScreen";
import { SaveForm } from "./components/SaveForm";
import { RecentItems } from "./components/RecentItems";
import { SettingsView } from "./components/SettingsView";
import type { AuthState, RecentItem } from "../shared/types";
import type { ExtMessage } from "../shared/messages";
import { ensureAppHostPermission } from "../shared/permissions";
import { getAppUrl } from "../shared/config";
import { addBlockedSite, getBlockedSites, isSiteBlocked, normalizeBlockedSiteOrigin, removeBlockedSite } from "../shared/storage";

type View = "capture" | "settings" | "blocked-sites";
type EncryptionState = "loading" | "locked" | "unlocked";

const APP_URL = getAppUrl();

function sendMessage(msg: ExtMessage): Promise<ExtMessage> {
  return chrome.runtime.sendMessage(msg);
}

function BlockedSitesView({
  blockedSites,
  onRemoveBlockedSite,
  onBack,
}: {
  blockedSites: string[];
  onRemoveBlockedSite: (origin: string) => void;
  onBack: () => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <div className="header">
        <button className="icon-btn icon-btn-spaced" type="button" onClick={onBack} title="Back" aria-label="Back">←</button>
        <div className="header-brand">
          <img src="../assets/logo.svg" className="header-logo-wordmark" alt="omanote" />
          Blocked sites
        </div>
        <div />
      </div>

      <div className="settings-view blocked-sites-view">
        {blockedSites.length ? (
          <div className="blocked-sites-list">
            {blockedSites.map((origin) => (
              <div className="blocked-site-row" key={origin}>
                <span className="settings-value blocked-site-origin" title={origin}>{origin}</span>
                <button className="blocked-site-remove" type="button" aria-label={`Remove ${origin}`} onClick={() => onRemoveBlockedSite(origin)}>
                  Remove
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="blocked-sites-empty">
            No sites blocked yet.
          </p>
        )}
      </div>
    </div>
  );
}

export function Popup() {
  const [auth, setAuth] = useState<AuthState | null | "loading">("loading");
  const [encryptionState, setEncryptionState] = useState<EncryptionState>("loading");
  const [passphrase, setPassphrase] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState("");
  const [view, setView] = useState<View>("capture");
  const [recentItems, setRecentItems] = useState<RecentItem[]>([]);
  const [pageInfo, setPageInfo] = useState<{ url: string; title: string }>({ url: "", title: "" });
  const [blockedSites, setBlockedSites] = useState<string[]>([]);
  const [currentSiteBlocked, setCurrentSiteBlocked] = useState(false);
  const [savedCount, setSavedCount] = useState(0); // increment to reset form

  // Load auth state and page info on mount
  useEffect(() => {
    // Read directly from storage — avoids background messaging race in Firefox
    // where the background page may not respond before the popup renders.
    void chrome.storage.local.get("omanote_auth").then((result) => {
      const stored = result["omanote_auth"] as AuthState | undefined;
      setAuth(stored ?? null);
      if (!stored) setEncryptionState("locked");
    }).catch((err) => { console.error("[omanote] failed to load auth state:", err); setAuth(null); });

    void sendMessage({ type: "GET_RECENT_ITEMS" }).then((resp) => {
      if (resp.type === "RECENT_ITEMS_RESPONSE") setRecentItems(resp.items);
    }).catch(() => {/* non-fatal */});

    // Get current tab URL and title
    void chrome.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
      const tab = tabs[0];
      if (tab) setPageInfo({ url: tab.url ?? "", title: tab.title ?? "" });
    });

    void getBlockedSites().then(setBlockedSites).catch(() => {/* non-fatal */});
  }, []);

  useEffect(() => {
    if (!pageInfo.url) {
      setCurrentSiteBlocked(false);
      return;
    }
    void isSiteBlocked(pageInfo.url).then(setCurrentSiteBlocked).catch(() => setCurrentSiteBlocked(false));
  }, [pageInfo.url, blockedSites]);

  // Listen for auth token written directly to storage by the auth-bridge content script.
  // This is the primary update path for Firefox (where background.scripts pages can be
  // dormant and runtime.sendMessage broadcasts may not arrive). Chrome also benefits.
  useEffect(() => {
    function onStorageChange(
      changes: Record<string, chrome.storage.StorageChange>,
      area: string,
    ) {
      if (area !== "local") return;
      if ("omanote_auth" in changes) {
        const newAuth = changes.omanote_auth.newValue as AuthState | undefined;
        setAuth(newAuth ?? null);
        if (!newAuth) setEncryptionState("locked");
      }
      if ("omanote_blocked_sites" in changes) {
        setBlockedSites((changes.omanote_blocked_sites.newValue as string[] | undefined) ?? []);
      }
    }
    chrome.storage.onChanged.addListener(onStorageChange);
    return () => chrome.storage.onChanged.removeListener(onStorageChange);
  }, []);

  // Secondary: also listen for broadcast from background (Chrome fast-path)
  useEffect(() => {
    function listener(message: ExtMessage) {
      if (message.type === "AUTH_STATE_RESPONSE") {
        setAuth(message.auth);
        if (!message.auth) setEncryptionState("locked");
      }
    }
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);

  useEffect(() => {
    if (!auth || auth === "loading") return;
    setEncryptionState("loading");
    void sendMessage({ type: "GET_ENCRYPTION_STATE" }).then((resp) => {
      if (resp.type === "ENCRYPTION_STATE_RESPONSE") {
        setEncryptionState(resp.isUnlocked ? "unlocked" : "locked");
      } else {
        setEncryptionState("locked");
      }
    }).catch((err) => {
      console.error("[omanote] failed to load encryption state:", err);
      setEncryptionState("locked");
    });
  }, [auth]);

  async function handleConnect(): Promise<boolean> {
    const granted = await ensureAppHostPermission();
    if (!granted) return false;
    try {
      await sendMessage({ type: "OPEN_AUTH_TAB" });
    } catch (err) {
      console.error("[omanote] failed to open auth tab through background:", err);
      await chrome.tabs.create({ url: `${APP_URL}/auth/extension`, active: true });
    }
    return true;
  }

  function handleDisconnect() {
    void sendMessage({ type: "DISCONNECT" }).then(() => {
      setAuth(null);
      setEncryptionState("locked");
      setView("capture");
    });
  }

  const openSettings = useCallback(() => {
    setView("settings");
  }, []);

  useEffect(() => {
    function openFromNativeEvent(event: Event) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (!target.closest("[data-action='open-settings']")) return;
      event.preventDefault();
      event.stopPropagation();
      openSettings();
    }

    document.addEventListener("pointerdown", openFromNativeEvent, true);
    document.addEventListener("mousedown", openFromNativeEvent, true);
    document.addEventListener("click", openFromNativeEvent, true);
    document.addEventListener("omanote:open-settings", openFromNativeEvent, true);
    return () => {
      document.removeEventListener("pointerdown", openFromNativeEvent, true);
      document.removeEventListener("mousedown", openFromNativeEvent, true);
      document.removeEventListener("click", openFromNativeEvent, true);
      document.removeEventListener("omanote:open-settings", openFromNativeEvent, true);
    };
  }, [openSettings]);

  function handleSettingsPointerDown(event: PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    openSettings();
  }

  async function toggleCurrentSiteBlocked() {
    if (!normalizeBlockedSiteOrigin(pageInfo.url)) return;
    if (currentSiteBlocked) {
      await removeBlockedSite(pageInfo.url);
    } else {
      await addBlockedSite(pageInfo.url);
    }
    setBlockedSites(await getBlockedSites());
  }

  async function removeBlockedOrigin(origin: string) {
    await removeBlockedSite(origin);
    setBlockedSites(await getBlockedSites());
  }

  function renderBlockSiteButton() {
    const origin = normalizeBlockedSiteOrigin(pageInfo.url);
    if (!origin) return null;
    const label = currentSiteBlocked ? "Allow popup on this site" : "Block popup on this site";
    const popupIsActive = !currentSiteBlocked;
    const statusLabel = popupIsActive ? "Active" : "Inactive";
    return (
      <button
        className={`site-popup-status ${popupIsActive ? "active" : "inactive"}`}
        type="button"
        title={label}
        aria-label={label}
        onClick={() => { void toggleCurrentSiteBlocked(); }}
      >
        <span className="site-popup-status-dot" aria-hidden="true" />
        <span>{statusLabel}</span>
      </button>
    );
  }

  async function handleUnlock(event: FormEvent) {
    event.preventDefault();
    if (unlocking) return;
    const trimmed = passphrase.trim();
    if (!trimmed) {
      setUnlockError("Enter your omanote encryption passphrase.");
      return;
    }
    setUnlocking(true);
    setUnlockError("");
    try {
      const resp = await sendMessage({ type: "UNLOCK_ENCRYPTION", passphrase: trimmed });
      if (resp.type === "ENCRYPTION_STATE_RESPONSE" && resp.isUnlocked) {
        setPassphrase("");
        setEncryptionState("unlocked");
      } else if (resp.type === "ENCRYPTION_ERROR") {
        setUnlockError(resp.error);
      } else {
        setUnlockError("Could not unlock extension.");
      }
    } catch (err) {
      setUnlockError(err instanceof Error ? err.message : "Could not unlock extension.");
    } finally {
      setUnlocking(false);
    }
  }

  function handleSaved() {
    setSavedCount((c) => c + 1);
    // Refresh recent items
    void sendMessage({ type: "GET_RECENT_ITEMS" }).then((resp) => {
      if (resp.type === "RECENT_ITEMS_RESPONSE") setRecentItems(resp.items);
    });
  }

  if (auth === "loading") {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200 }}>
        <span className="spinner" style={{ borderTopColor: "var(--accent)", width: 20, height: 20, borderWidth: 2 }} />
      </div>
    );
  }

  if (!auth) {
    return (
      <div className="popup-root">
        <div className="header">
          <div className="header-brand">
            <img src="../assets/logo.svg" className="header-logo-wordmark" alt="omanote" />
          </div>
        </div>
        <AuthScreen onConnect={handleConnect} />
      </div>
    );
  }

  if (view === "settings") {
    return (
      <div className="popup-root">
        <SettingsView
          auth={auth}
          blockedSiteCount={blockedSites.length}
          onOpenBlockedSites={() => setView("blocked-sites")}
          onDisconnect={handleDisconnect}
          onBack={() => setView("capture")}
        />
      </div>
    );
  }

  if (view === "blocked-sites") {
    return (
      <div className="popup-root">
        <BlockedSitesView
          blockedSites={blockedSites}
          onRemoveBlockedSite={(origin) => { void removeBlockedOrigin(origin); }}
          onBack={() => setView("settings")}
        />
      </div>
    );
  }

  if (encryptionState === "loading") {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200 }}>
        <span className="spinner" style={{ borderTopColor: "var(--accent)", width: 20, height: 20, borderWidth: 2 }} />
      </div>
    );
  }

  if (encryptionState === "locked") {
    return (
      <div className="popup-root">
        <div className="header">
          <div className="header-brand">
            <img src="../assets/logo.svg" className="header-logo-wordmark" alt="omanote" />
          </div>
          <div className="header-actions">
            {renderBlockSiteButton()}
            <button className="icon-btn" type="button" title="Settings" aria-label="Settings" data-action="open-settings" onPointerDown={handleSettingsPointerDown} onClick={openSettings}>⚙</button>
          </div>
        </div>

        <form className="form" onSubmit={handleUnlock}>
          <div className="field">
            <label className="field-label">Encryption passphrase</label>
            <input
              className="field-input"
              type="password"
              autoComplete="current-password"
              value={passphrase}
              onChange={(event) => setPassphrase(event.target.value)}
              placeholder="Enter your omanote passphrase"
              autoFocus
            />
          </div>
          {unlockError && <div className="error-msg">{unlockError}</div>}
          <div className="btn-row">
            <button className="btn btn-primary" type="submit" disabled={unlocking}>
              {unlocking ? <span className="spinner" /> : null}
              {unlocking ? "Unlocking..." : "Unlock extension"}
            </button>
          </div>
        </form>
      </div>
    );
  }

  // Detect if current page is a "save current page" scenario
  const isOmanoteApp = pageInfo.url.startsWith(APP_URL);
  const defaultType = pageInfo.url ? "bookmark" : "note";

  return (
    <div className="popup-root">
      <div className="header">
        <div className="header-brand">
          <img src="../assets/logo.svg" className="header-logo-wordmark" alt="omanote" />
        </div>
        <div className="header-actions">
          {renderBlockSiteButton()}
          <button className="icon-btn" type="button" title="Settings" aria-label="Settings" data-action="open-settings" onPointerDown={handleSettingsPointerDown} onClick={openSettings}>⚙</button>
        </div>
      </div>

      {isOmanoteApp ? (
        <div style={{ padding: "24px 16px", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
          <p style={{ marginBottom: 12 }}>You're already in omanote.</p>
          <a href={pageInfo.url} target="_blank" rel="noopener noreferrer" className="footer-link" style={{ justifyContent: "center" }}>
            Open app →
          </a>
        </div>
      ) : (
        <SaveForm
          key={savedCount}
          initialType={defaultType}
          initialUrl={pageInfo.url}
          pageTitle={pageInfo.title}
          onSaved={handleSaved}
        />
      )}

      {recentItems.length > 0 && <RecentItems items={recentItems} />}

      <div className="footer">
        <a href={APP_URL} target="_blank" rel="noopener noreferrer" className="footer-link">
          Open omanote →
        </a>
      </div>
    </div>
  );
}
