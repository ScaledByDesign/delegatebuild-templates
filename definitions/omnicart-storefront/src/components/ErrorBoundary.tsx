import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Global Error Boundary Component
 * Catches JavaScript errors anywhere in the child component tree,
 * logs those errors, and displays a fallback UI instead of a blank page.
 */
class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });

    // Log error to console
    console.error('ErrorBoundary caught an error:', error);
    console.error('Component stack:', errorInfo.componentStack);

    // Detect chunk loading errors (stale deployment / Next.js migration)
    const msg = error.message?.toLowerCase() || '';
    const isChunkError = msg.includes('loading chunk') ||
      msg.includes('chunkloaderror') ||
      msg.includes('failed to fetch dynamically imported module') ||
      msg.includes('_next/static/chunks');

    if (isChunkError) {
      const key = 'chunk_error_reload';
      const last = sessionStorage.getItem(key);
      const now = Date.now();
      if (!last || (now - parseInt(last, 10)) > 30000) {
        sessionStorage.setItem(key, now.toString());
        window.location.reload();
        return;
      }
    }

    // Report to analytics/error tracking
    this.reportError(error, errorInfo);

    // Auto-refresh the page to recover from other errors
    // Use sessionStorage to prevent infinite refresh loops
    const refreshKey = 'error_boundary_refresh';
    const lastRefresh = sessionStorage.getItem(refreshKey);
    const now = Date.now();

    // Only auto-refresh if we haven't refreshed in the last 10 seconds
    if (!lastRefresh || (now - parseInt(lastRefresh, 10)) > 10000) {
      sessionStorage.setItem(refreshKey, now.toString());
      // Small delay to allow error reporting to complete
      setTimeout(() => {
        window.location.reload();
      }, 500);
    }
  }

  private reportError(error: Error, errorInfo: ErrorInfo) {
    try {
      // Report to GTM/dataLayer
      if ((window as any).dataLayer) {
        (window as any).dataLayer.push({
          event: 'javascript_error',
          error_message: error.message,
          error_name: error.name,
          error_stack: error.stack?.substring(0, 500),
          component_stack: errorInfo.componentStack?.substring(0, 500),
          page_url: window.location.href,
          timestamp: new Date().toISOString(),
        });
      }

      // Report to CustomerLabs if available
      if ((window as any).customerlabs?.track) {
        (window as any).customerlabs.track('javascript_error', {
          error_message: error.message,
          error_name: error.name,
          page_url: window.location.href,
        });
      }

      // Beacon to custom error endpoint (fire-and-forget)
      if (navigator.sendBeacon) {
        const errorData = JSON.stringify({
          type: 'react_error_boundary',
          message: error.message,
          name: error.name,
          stack: error.stack?.substring(0, 1000),
          componentStack: errorInfo.componentStack?.substring(0, 1000),
          url: window.location.href,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString(),
        });
        
        // Send to your error logging endpoint
        navigator.sendBeacon('/api/log-error', errorData);
      }
    } catch (reportingError) {
      // Silently fail - don't let error reporting cause more errors
      console.warn('Failed to report error:', reportingError);
    }
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      // Custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#f9fafb',
            padding: '20px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          }}
        >
          <div
            style={{
              maxWidth: '500px',
              textAlign: 'center',
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              padding: '40px',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            }}
          >
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
            <h1
              style={{
                fontSize: '24px',
                fontWeight: '600',
                color: '#1f2937',
                marginBottom: '12px',
              }}
            >
              Something went wrong
            </h1>
            <p
              style={{
                fontSize: '16px',
                color: '#6b7280',
                marginBottom: '24px',
                lineHeight: '1.5',
              }}
            >
              We're sorry, but something unexpected happened. Please try refreshing the page or return to the homepage.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={this.handleReload}
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#D10000',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Refresh Page
              </button>
              <button
                onClick={this.handleGoHome}
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#ffffff',
                  color: '#374151',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Go to Homepage
              </button>
            </div>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details
                style={{
                  marginTop: '24px',
                  textAlign: 'left',
                  padding: '16px',
                  backgroundColor: '#fef2f2',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              >
                <summary style={{ cursor: 'pointer', fontWeight: '600', color: '#991b1b' }}>
                  Error Details (Development Only)
                </summary>
                <pre
                  style={{
                    marginTop: '8px',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    color: '#7f1d1d',
                  }}
                >
                  {this.state.error.toString()}
                  {'\n\n'}
                  {this.state.error.stack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

