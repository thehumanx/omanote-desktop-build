import type { AuthState } from "../../shared/types";
import { getAppUrl } from "../../shared/config";
import { displayAuthEmail, displayAuthName } from "../../shared/auth-display";

interface SettingsViewProps {
  auth: AuthState;
  blockedSiteCount: number;
  onOpenBlockedSites: () => void;
  onDisconnect: () => void;
  onBack: () => void;
}

const APP_URL = getAppUrl();

export function SettingsView({ auth, blockedSiteCount, onOpenBlockedSites, onDisconnect, onBack }: SettingsViewProps) {
  const blockedSitesLabel = blockedSiteCount === 1 ? "1 site" : `${blockedSiteCount} sites`;

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <div className="header">
        <button className="icon-btn icon-btn-spaced" type="button" onClick={onBack} title="Back" aria-label="Back">←</button>
        <div className="header-brand">
          <img src="../assets/logo.svg" className="header-logo-wordmark" alt="omanote" />
          Settings
        </div>
        <div />
      </div>

      <div className="settings-view">
        <div>
          <div className="settings-section-title">Account</div>
          <div className="settings-row">
            <span className="settings-label">Name</span>
            <span className="settings-value">{displayAuthName(auth)}</span>
          </div>
          <div className="settings-row">
            <span className="settings-label">Email</span>
            <span className="settings-value">{displayAuthEmail(auth)}</span>
          </div>
          <div className="settings-row">
            <span className="settings-label">Status</span>
            <span style={{ fontSize: 12, color: "var(--success)" }}>✓ Connected</span>
          </div>
        </div>

        <div>
          <div className="settings-section-title">Keyboard Shortcut</div>
          <div className="settings-row">
            <span className="settings-label">Open popup</span>
            <span className="settings-value" style={{ fontFamily: "monospace" }}>Alt + Shift + O</span>
          </div>
          <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
            Change in your browser's extension shortcuts settings.
          </p>
        </div>

        <div>
          <div className="settings-section-title">Blocked sites</div>
          <button className="settings-row settings-nav-row" type="button" aria-label="View blocked sites" onClick={onOpenBlockedSites}>
            <span className="settings-label">Selection popup</span>
            <span className="settings-value">{blockedSitesLabel} blocked →</span>
          </button>
        </div>

        <div style={{ marginTop: "auto" }}>
          <a
            href={APP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="footer-link"
            style={{ display: "block", marginBottom: 10, fontSize: 13 }}
          >
            Open omanote app →
          </a>
          <button className="btn-danger" onClick={onDisconnect}>
            Disconnect Extension
          </button>
        </div>
      </div>
    </div>
  );
}
