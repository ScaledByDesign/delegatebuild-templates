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
import { initDelegateAuth } from '@/lib/delegate-auth';
import { initDelegateDeeplink } from '@/lib/delegate-deeplink';
import '@/index.css'
import { WebOSHome } from '@/pages/WebOSHome'

// Start the host bridges BEFORE first paint:
//  - theme tokens (no flash of the wrong theme),
//  - access token for this app's private data API,
//  - deeplink/launch params (openApp(appId, props) equivalent).
initDelegateTheme();
initDelegateAuth();
initDelegateDeeplink();

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
