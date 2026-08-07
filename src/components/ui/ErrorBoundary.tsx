import { Component, type ReactNode } from "react";
import { Icon } from "./Icon";

interface Props {
  /** Custom fallback UI. When omitted a default "something went wrong" panel is shown. */
  fallback?: ReactNode;
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Catches render errors from a subtree so a single broken page can never blank
 * the whole app. Wraps <App/> globally and each routed page in AppShell.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: unknown) {
    console.error("ErrorBoundary caught an error:", error, info);
  }

  render() {
    if (this.state.error) {
      if (this.props.fallback !== undefined) return this.props.fallback;
      return (
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 rounded-xl border border-border-variant bg-surface-container-lowest p-8 text-center">
          <div className="grid size-12 place-items-center rounded-full bg-error-container/40 text-error">
            <Icon name="error" size={24} filled />
          </div>
          <div>
            <h2 className="font-headline-md text-headline-md text-on-surface">
              Something went wrong
            </h2>
            <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
              This section hit an unexpected error. Your data is safe.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              onClick={() => (window.location.hash = "#/app")}
              className="rounded-lg bg-primary px-4 py-2 font-label-md text-label-md font-semibold text-on-primary transition-opacity hover:opacity-90"
            >
              Return to dashboard
            </button>
            <button
              onClick={() => this.setState({ error: null })}
              className="rounded-lg border border-border-variant px-4 py-2 font-label-md text-label-md text-on-surface transition-colors hover:bg-surface-container"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
