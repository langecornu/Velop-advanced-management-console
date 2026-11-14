// Catches a crash in one section so the page shows what went wrong instead of going blank.
import { Component } from 'react';

import Icon from './Icon.jsx';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[ui] section crashed', error, info?.componentStack);
  }

  componentDidUpdate(previousProps) {
    // Switching tabs gives the new section a fresh start.
    if (this.state.error && previousProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) {
      return this.props.children;
    }
    return (
      <div className="card empty" role="alert">
        <Icon name="alert" size={26} />
        <strong>This section stopped working</strong>
        <p className="muted mono">{String(this.state.error?.message ?? this.state.error)}</p>
        <button type="button" className="btn" onClick={() => window.location.reload()}>
          Reload the page
        </button>
      </div>
    );
  }
}
