import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "./ui";
import { reportError } from "../lib/error-reporting";

interface Props {
  children: ReactNode;
  /**
   * Change this to clear a caught error and re-render `children`.
   *
   * Route-level boundaries pass the current pathname. Without it a single
   * failed screen left the whole app showing the fallback until the user
   * manually reloaded, because navigating away re-rendered the same boundary
   * with `error` still set — so "go somewhere else" could never recover.
   */
  resetKey?: string;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidUpdate(prevProps: Props) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // The component stack is deliberately not reported: it is the most useful
    // field for debugging and the most likely to carry rendered content, and
    // there is no scrubber that can reliably tell a component name from a note
    // title inside it. It stays in the local console, which is where a
    // developer reproducing the crash will look anyway.
    console.debug("[omanote] component stack:", info.componentStack);
    reportError(error, "ErrorBoundary");
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-app-canvas px-6">
          <div className="max-w-sm w-full text-center space-y-4">
            <p className="text-2xl font-bold text-app-ink">
              Something went wrong
            </p>
            <p className="text-sm text-app-ink-muted">
              Try refreshing the page. If the problem persists,{" "}
              <a href="mailto:support@omanote.com" className="underline text-app-accent hover:text-app-accent-hover">
                contact support
              </a>.
            </p>
            <Button
              onClick={() => window.location.reload()}
              className="mt-2"
            >
              Reload page
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
