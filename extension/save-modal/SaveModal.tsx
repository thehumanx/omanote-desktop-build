import { useEffect, useState } from "react";
import { SaveForm } from "../popup/components/SaveForm";
import type { CaptureContext } from "../shared/types";
import "../popup/popup.css";

function getTrustedParentOrigin(): string {
  try {
    if (document.referrer) return new URL(document.referrer).origin;
  } catch {
    // Fall through to the extension origin.
  }
  return window.location.origin;
}

/**
 * This modal is loaded inside an iframe injected by the content script.
 * It receives its initial context from the parent via postMessage,
 * and notifies the parent when it should be closed.
 */
export function SaveModal() {
  const [context, setContext] = useState<CaptureContext | null>(null);
  const trustedParentOrigin = getTrustedParentOrigin();

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.source !== window.parent) return;
      if (event.origin !== trustedParentOrigin) return;
      if (event.data?.type === "OMANOTE_MODAL_INIT") {
        setContext(event.data.context as CaptureContext);
      }
    }
    window.addEventListener("message", handleMessage);
    window.parent.postMessage({ type: "OMANOTE_MODAL_READY" }, trustedParentOrigin);
    return () => window.removeEventListener("message", handleMessage);
  }, [trustedParentOrigin]);

  function handleClose() {
    window.parent.postMessage({ type: "OMANOTE_MODAL_CLOSE" }, trustedParentOrigin);
  }

  if (!context) {
    return (
      <div className="save-modal-loading">
        <span className="spinner save-modal-spinner" />
      </div>
    );
  }

  const defaultType = context.selectedUrl && !context.selectedText
    ? "bookmark"
    : context.selectedText?.match(/^https?:\/\//)
    ? "bookmark"
    : "note";

  return (
    <div className="save-modal-shell">
      <div className="header save-modal-header">
        <div className="header-brand">
          <img src="../assets/logo.svg" className="header-logo-wordmark" alt="omanote" />
          <span className="header-action-title">Save</span>
        </div>
        <button className="icon-btn" onClick={handleClose} title="Close">×</button>
      </div>
      <SaveForm
        initialType={defaultType}
        initialContent={context.selectedText ?? ""}
        initialUrl={context.selectedUrl ?? context.pageUrl}
        pageTitle={context.pageTitle}
        onSaved={handleClose}
      />
    </div>
  );
}
