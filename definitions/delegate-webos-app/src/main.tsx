import '@/lib/errorReporter';
import { enableMapSet } from "immer";
enableMapSet();
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import {
  createBrowserRouter,
  RouterProvider,
} from "react-router-dom";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { RouteErrorBoundary } from '@/components/RouteErrorBoundary';
import { initDelegateTheme } from '@/lib/delegate-theme';
import '@/index.css'
import { WebOSHome } from '@/pages/WebOSHome'

// Apply WebOS theme tokens from the Delegate host (or OS fallback) BEFORE first
// paint so there's no flash of the wrong theme.
initDelegateTheme();

const queryClient = new QueryClient();

const router = createBrowserRouter([
  {
    path: "/",
    element: <WebOSHome />,
    errorElement: <RouteErrorBoundary />,
  },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <RouterProvider router={router} />
      </ErrorBoundary>
    </QueryClientProvider>
  </StrictMode>,
)
