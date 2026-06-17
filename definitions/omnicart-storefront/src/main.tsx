import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import ErrorBoundary from './components/ErrorBoundary.tsx'
import { hydratePublicEnv } from './lib/public-env'
import './index.css'

// Backfill browser-safe connector values from the Worker as early as possible so
// runtime readers resolve credentials for workspaces linked after the build.
hydratePublicEnv()

// Detect chunk loading failures (stale deployments, migration from Next.js, etc.)
function isChunkLoadError(message: string): boolean {
  const msg = String(message).toLowerCase();
  return msg.includes('loading chunk') ||
    msg.includes('loading css chunk') ||
    msg.includes('chunkloaderror') ||
    msg.includes('failed to fetch dynamically imported module') ||
    msg.includes('_next/static/chunks');
}

// Auto-recover from chunk load errors by doing a hard reload (with loop protection)
function recoverFromChunkError(): boolean {
  const key = 'chunk_error_reload';
  const last = sessionStorage.getItem(key);
  const now = Date.now();

  // Only auto-reload once per 30 seconds to prevent infinite loops
  if (!last || (now - parseInt(last, 10)) > 30000) {
    sessionStorage.setItem(key, now.toString());
    // Hard reload bypasses cache
    window.location.reload();
    return true;
  }
  return false;
}

// Global error handlers for uncaught errors
window.onerror = function(message, source, lineno, colno, error) {
  console.error('Global error:', { message, source, lineno, colno, error });

  // Auto-recover from chunk loading failures
  if (isChunkLoadError(String(message)) || isChunkLoadError(String(source))) {
    recoverFromChunkError();
    return true;
  }

  // Report to GTM/dataLayer
  if (window.dataLayer) {
    window.dataLayer.push({
      event: 'javascript_error',
      error_message: String(message),
      error_source: source,
      error_line: lineno,
      error_column: colno,
      error_stack: error?.stack?.substring(0, 500),
      page_url: window.location.href,
      timestamp: new Date().toISOString(),
    });
  }

  // Don't prevent default handling
  return false;
};

window.onunhandledrejection = function(event) {
  console.error('Unhandled promise rejection:', event.reason);

  // Auto-recover from chunk loading failures (dynamic imports fail as rejected promises)
  const reason = String(event.reason);
  if (isChunkLoadError(reason) || isChunkLoadError(event.reason?.message || '')) {
    event.preventDefault();
    recoverFromChunkError();
    return;
  }

  // Report to GTM/dataLayer
  if (window.dataLayer) {
    window.dataLayer.push({
      event: 'unhandled_promise_rejection',
      error_message: String(event.reason),
      error_stack: event.reason?.stack?.substring(0, 500),
      page_url: window.location.href,
      timestamp: new Date().toISOString(),
    });
  }
};

// Safe root element retrieval with fallback
const rootElement = document.getElementById("root");

if (!rootElement) {
  // Critical error: root element not found
  console.error('🚨 Critical: #root element not found in DOM');

  // Create a fallback error display
  const fallbackDiv = document.createElement('div');
  fallbackDiv.innerHTML = `
    <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; font-family: sans-serif; text-align: center; padding: 20px;">
      <div>
        <h1 style="color: #1f2937; margin-bottom: 16px;">Unable to Load Page</h1>
        <p style="color: #6b7280; margin-bottom: 24px;">Please try refreshing the page or clearing your browser cache.</p>
        <button onclick="window.location.reload()" style="padding: 12px 24px; background: #D10000; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 16px;">
          Refresh Page
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(fallbackDiv);
} else {
  createRoot(rootElement).render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
