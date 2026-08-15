import { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

// Top-level safety net: without this, any uncaught render-time error (a bad
// localStorage value, an unexpected null, a third-party throw) unmounts the
// whole React tree and leaves a permanent blank page with no way to recover
// short of manually clearing storage. Deliberately has no dependency on
// i18n/auth/router context, since the error that triggered this could have
// come from any of them.
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled render error:", error, info.componentStack);
  }

  handleReload = () => {
    this.setState({ error: null });
    window.location.href = "/";
  };

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-mine-950 px-4">
          <div className="max-w-md w-full bg-mine-900 border border-mine-800 rounded-xl p-6 text-center space-y-4">
            <h1 className="text-lg font-semibold text-mine-50">Something went wrong</h1>
            <p className="text-sm text-mine-300">
              This page hit an unexpected error and couldn't load. Reloading usually fixes it.
            </p>
            <button
              onClick={this.handleReload}
              className="px-4 py-2 rounded-lg bg-hazard-500 hover:bg-hazard-600 text-white text-sm font-semibold transition-all"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
