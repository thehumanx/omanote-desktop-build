import { useState, useEffect } from "react";
import { Link } from "react-router-dom";

const STORAGE_KEY = "omanote_cookie_notice_dismissed";

export function CookieNotice() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
    } catch {
      // localStorage unavailable — don't show the banner
    }
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // ignore
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-app-toast px-4 pb-4 sm:pb-5">
      <div className="max-w-3xl mx-auto rounded-app-card border border-app-line bg-app-surface shadow-app-dialog px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <p className="flex-1 text-sm text-app-ink-muted leading-relaxed">
          omanote uses only strictly necessary cookies for authentication and encrypted local
          storage. No tracking, no ads.{" "}
          <Link
            to="/privacy"
            className="text-app-ink underline underline-offset-2 hover:no-underline whitespace-nowrap"
          >
            Privacy Policy
          </Link>
        </p>
        <button
          onClick={dismiss}
          className="shrink-0 rounded-app-panel border border-app-line bg-app-surface px-4 py-2 text-sm font-bold text-app-ink hover:bg-app-surface-hover transition-colors cursor-pointer"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
