import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "./ui";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[omanote] Uncaught error:", error, info.componentStack);
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
