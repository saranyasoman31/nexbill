// Global ErrorBoundary for NexBill ERP - Prevents blank screen crashes and provides diagnostic recovery options
import React from 'react';
import { AlertOctagon, RotateCcw, LogOut, RefreshCw, Terminal } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('NexBill Application Error caught by ErrorBoundary:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleResetSession = () => {
    try {
      localStorage.removeItem('NEXBILL_AUTH_LOGGED_IN');
      localStorage.removeItem('NEXBILL_AUTH_USER_ID');
    } catch (_) {}
    window.location.reload();
  };

  handleResetStorage = () => {
    if (window.confirm('Reset local cache and session data? Your terminal will re-initialize to a clean state.')) {
      try {
        localStorage.removeItem('NEXBILL_ERP_DATABASE_V2');
        localStorage.removeItem('NEXBILL_AUTH_LOGGED_IN');
        localStorage.removeItem('NEXBILL_AUTH_USER_ID');
      } catch (_) {}
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      const errorMsg = this.state.error?.message || String(this.state.error) || 'An unexpected rendering error occurred.';
      const componentStack = this.state.errorInfo?.componentStack || '';

      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 font-sans select-none">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-5 text-center">
            {/* Warning Icon */}
            <div className="w-16 h-16 rounded-2xl bg-rose-950/80 border border-rose-500/40 flex items-center justify-center mx-auto text-rose-400 shadow-xl shadow-rose-950/50">
              <AlertOctagon className="w-8 h-8 animate-pulse" />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-xl font-black text-white tracking-tight">Terminal Display Notice</h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                The terminal encountered an unexpected state while loading this view. You can reload or reset your active session below.
              </p>
            </div>

            {/* Error Message Card */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-left space-y-2">
              <div className="flex items-center justify-between text-[11px] font-mono font-bold text-rose-400">
                <span className="flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5" />
                  <span>Diagnostic Summary</span>
                </span>
                <button
                  type="button"
                  onClick={() => this.setState((prev) => ({ showDetails: !prev.showDetails }))}
                  className="text-slate-500 hover:text-slate-300 underline font-sans text-[10px]"
                >
                  {this.state.showDetails ? 'Hide Stack' : 'View Stack'}
                </button>
              </div>

              <div className="text-xs font-mono text-slate-300 break-words font-semibold bg-rose-950/20 p-2 rounded-lg border border-rose-900/30">
                {errorMsg}
              </div>

              {this.state.showDetails && componentStack && (
                <pre className="text-[10px] font-mono text-slate-500 max-h-40 overflow-y-auto whitespace-pre-wrap p-2 bg-black/40 rounded border border-slate-900">
                  {componentStack}
                </pre>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reload Page</span>
              </button>

              <button
                type="button"
                onClick={this.handleResetSession}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5 text-amber-400" />
                <span>Clear Session & Sign In</span>
              </button>

              <button
                type="button"
                onClick={this.handleResetStorage}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-rose-950/50 hover:bg-rose-900/60 text-rose-300 border border-rose-800/40 font-semibold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Cache</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
