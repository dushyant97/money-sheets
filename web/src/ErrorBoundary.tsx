import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { error: Error | null };

/**
 * Catches render-time errors so a single bad component can't blank the whole
 * app. Local data is untouched (it lives in localStorage), so "Reload" recovers.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error('Unhandled UI error:', error, info);
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="crash">
          <div className="crash-card">
            <span className="crash-emoji">😵‍💫</span>
            <h1>Something went wrong</h1>
            <p>
              The app hit an unexpected error. Your saved data is safe on this device — reloading
              usually fixes it.
            </p>
            <button onClick={() => window.location.reload()}>Reload app</button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
