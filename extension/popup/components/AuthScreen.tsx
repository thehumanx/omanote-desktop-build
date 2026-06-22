import { useState } from "react";

interface AuthScreenProps {
  onConnect: () => Promise<boolean>;
}

export function AuthScreen({ onConnect }: AuthScreenProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function handleConnect() {
    setLoading(true);
    setError("");
    void onConnect()
      .then((opened) => {
        if (!opened) {
          setError("Firefox needs permission to access omanote before sign-in can continue.");
          setLoading(false);
          return;
        }
        // Reset after 10s in case the tab was closed without completing auth
        setTimeout(() => setLoading(false), 10_000);
      })
      .catch(() => {
        setError("Could not open omanote sign-in. Please try again.");
        setLoading(false);
      });
  }

  return (
    <div className="auth-screen">
      <img src="../assets/logo.svg" className="auth-logo-wordmark" alt="omanote" />
      <div>
        <p className="auth-desc">
          Capture the day before it disappears. Connect your account to save notes, bookmarks, and todos from anywhere on the web.
        </p>
      </div>
      <button className="btn-connect" onClick={handleConnect} disabled={loading}>
        {loading ? (
          <>
            <span className="spinner" style={{ marginRight: 8 }} />
            Opening sign-in…
          </>
        ) : (
          "Connect to omanote"
        )}
      </button>
      {loading && (
        <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: -8 }}>
          Complete sign-in in the opened tab, then come back here.
        </p>
      )}
      {error && (
        <p style={{ fontSize: 11, color: "var(--error)", marginTop: -8 }}>
          {error}
        </p>
      )}
    </div>
  );
}
