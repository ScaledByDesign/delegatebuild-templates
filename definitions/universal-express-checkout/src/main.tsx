import '@/lib/errorReporter';
import { enableMapSet } from "immer";
enableMapSet();
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
} from "react-router-dom";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { RouteErrorBoundary } from '@/components/RouteErrorBoundary';
import '@/index.css'
import { CheckoutPage } from '@/pages/CheckoutPage'
import { UpsellOfferPage } from '@/pages/UpsellOfferPage'
import { SuccessPage } from '@/pages/SuccessPage'

const queryClient = new QueryClient();

// Universal Express Checkout — route map mirrors the upw-sendpaylinks headless
// checkout exactly. There is NO homepage / storefront / cart-summary landing:
//   /                   → redirect to a checkout (no standalone landing page)
//   /c/:code            → the public checkout one-pager (cart → shipping → pay)
//   /upsell/:sessionId  → one post-purchase upsell OFFER per route (Flow Builder)
//   /success            → order confirmation / receipt (incl. upsell journey)
// Each upsell offer is its own route so the builder can author bespoke,
// fully-designed per-offer pages (mirror of upw-sendpaylinks' externalPageUrl).
const router = createBrowserRouter([
  {
    // No homepage: send root straight into the checkout (demo code by default).
    path: "/",
    element: <Navigate to="/c/demo" replace />,
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: "/c/:code",
    element: <CheckoutPage />,
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: "/upsell/:sessionId",
    element: <UpsellOfferPage />,
    errorElement: <RouteErrorBoundary />,
  },
  {
    path: "/success",
    element: <SuccessPage />,
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
