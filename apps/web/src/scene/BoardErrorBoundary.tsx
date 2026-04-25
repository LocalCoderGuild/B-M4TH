import { Component, type ReactNode } from "react";

interface State {
  err: Error | null;
}

export class BoardErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { err: null };

  static getDerivedStateFromError(err: Error): State {
    return { err };
  }

  componentDidCatch(err: Error): void {
    console.error("[BoardCanvas]", err);
  }

  render(): ReactNode {
    if (this.state.err) {
      return (
        <div className="pixel-alert pixel-alert-error" role="alert">
          <strong>Board failed to render</strong>
          <div>{this.state.err.message}</div>
        </div>
      );
    }
    return this.props.children;
  }
}
