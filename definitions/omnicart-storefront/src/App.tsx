import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Index from "./pages/Index";

// Route pages are code-split: each loads its own chunk on demand so navigating
// to a page (checkout included) only downloads that page's code instead of the
// whole app. The homepage (Index) stays eager for the fastest landing LCP.
const ProductDetail = lazy(() => import("./pages/ProductDetail"));
const Collection = lazy(() => import("./pages/Collection"));
const Collections = lazy(() => import("./pages/Collections"));
const CollectionDetail = lazy(() => import("./pages/CollectionDetail"));
const Cart = lazy(() => import("./pages/Cart"));
const CheckoutSuccess = lazy(() => import("./pages/CheckoutSuccess"));
const QuickCheckout = lazy(() => import("./pages/QuickCheckout"));
const ExpressCheckout = lazy(() => import("./pages/ExpressCheckout"));
const Receipt = lazy(() => import("./pages/Receipt"));
const TrackOrder = lazy(() => import("./pages/TrackOrder"));
const Returns = lazy(() => import("./pages/Returns"));
const About = lazy(() => import("./pages/About"));
const Contact = lazy(() => import("./pages/Contact"));
const Search = lazy(() => import("./pages/Search"));
const CancelMembership = lazy(() => import("./pages/CancelMembership"));
const ThankYou = lazy(() => import("./pages/ThankYou"));
const TrnCancelForm = lazy(() => import("./pages/TrnCancelForm"));
const TermsDisclaimer = lazy(() => import("./pages/TermsDisclaimer"));
const ShippingPolicy = lazy(() => import("./pages/ShippingPolicy"));
const ReturnPolicy = lazy(() => import("./pages/ReturnPolicy"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const WhitelistInstruction = lazy(() => import("./pages/WhitelistInstruction"));
const Account = lazy(() => import("./pages/Account"));
const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const GiftCards = lazy(() => import("./pages/GiftCards"));
const Wishlist = lazy(() => import("./pages/Wishlist"));
const Loyalty = lazy(() => import("./pages/Loyalty"));
const Admin = lazy(() => import("./pages/Admin"));
import ProtectedRoute from "./components/ProtectedRoute";
import { CartProvider } from "./hooks/useCart";
import { CustomerProvider } from "./hooks/useCustomer";
import { RegionProvider } from "./hooks/useRegion";
import { WishlistProvider } from "./hooks/useWishlist";
import { CartSummaryProvider } from "./context/CartSummaryContext";
import AnnouncementBars from "./components/AnnouncementBars";
import ScrollToTop from "./components/ScrollToTop";
import ReviewsStickyTab from "./components/ReviewsStickyTab";
import AOSInitializer from "./components/AOSInitializer";
import CartSummaryPopover from "./components/CartSummaryPopover";
import RedirectHandler from "./components/RedirectHandler";
import { useTracking } from "./hooks/useTracking";
import { useAttributionCapture } from "./hooks/useAttributionCapture";

const queryClient = new QueryClient();

/** Accessible fallback shown while a route's code chunk loads. */
const RouteFallback = () => (
  <div className="flex min-h-[50vh] items-center justify-center" role="status" aria-live="polite">
    <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-gray-900" aria-hidden="true"></div>
    <span className="sr-only">Loading…</span>
  </div>
);

const AppContent = () => {
  // Capture Rumble click ID and UTM params on first render
  useAttributionCapture();
  // Initialize tracking for GTM and Facebook Pixel on route changes
  useTracking();

  return (
    <>
      <AOSInitializer />
      <ScrollToTop />
      <AnnouncementBars />
      {/* Yotpo Reviews Tab widget - renders floating tab on left side */}
      <ReviewsStickyTab />
      <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<Index />} />
        {/* Shopify-compatible routes for 1:1 parity */}
        {/* BOGO redirect - handle both URL patterns */}
        <Route path="/products/BOGO" element={<Navigate to="/collections/products/" replace />} />
        <Route path="/collections/products/BOGO" element={<Navigate to="/collections/products/" replace />} />
        <Route path="/products/:handle" element={<ProductDetail />} />
        {/* Redirect /products to the "All Products" collection */}
        <Route path="/products" element={<Navigate to="/collections/products" replace />} />
        <Route path="/collections" element={<Collections />} />
        <Route path="/collections/:handle" element={<CollectionDetail />} />

        {/* Legacy routes for backward compatibility */}
        <Route path="/products/:slug" element={<ProductDetail />} />
        <Route path="/category/:category" element={<Collection />} />
        <Route path="/category/all" element={<Collection />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/checkout" element={<Navigate to="/express-checkout" replace />} />
        <Route path="/quick-checkout" element={<QuickCheckout />} />
        <Route path="/express-checkout" element={<ExpressCheckout />} />
        <Route path="/checkout-success" element={<CheckoutSuccess />} />
        <Route path="/receipt" element={<Receipt />} />
        <Route path="/track-order" element={<TrackOrder />} />
        <Route path="/returns" element={<Returns />} />
        <Route path="/gift-cards" element={<GiftCards />} />
        <Route path="/wishlist" element={
          <ProtectedRoute>
            <Wishlist />
          </ProtectedRoute>
        } />
        <Route path="/loyalty" element={
          <ProtectedRoute>
            <Loyalty />
          </ProtectedRoute>
        } />
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/search" element={<Search />} />
        <Route path="/cancel-membership" element={<CancelMembership />} />
        <Route path="/pages/cancel-membership" element={<CancelMembership />} />
        <Route path="/terms-disclaimer" element={<TermsDisclaimer />} />
        <Route path="/pages/terms-disclaimer" element={<TermsDisclaimer />} />
        <Route path="/shipping-policy" element={<ShippingPolicy />} />
        <Route path="/pages/shipping-policy" element={<ShippingPolicy />} />
        <Route path="/return-policy" element={<ReturnPolicy />} />
        <Route path="/pages/return-policy" element={<ReturnPolicy />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/pages/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/blogs/whitelist/whitelist-instruction" element={<WhitelistInstruction />} />
        <Route path="/thankyou" element={<ThankYou />} />
        <Route path="/pages/thankyou" element={<ThankYou />} />
        <Route path="/trn-cancel-form" element={<TrnCancelForm />} />
        <Route path="/pages/trn-cancel-form" element={<TrnCancelForm />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/account" element={
          <ProtectedRoute>
            <Account />
          </ProtectedRoute>
        } />
        <Route path="/admin" element={<Admin />} />
        <Route path="*" element={<RedirectHandler />} />
      </Routes>
      </Suspense>
    </>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <CartSummaryProvider>
        <RegionProvider>
          <CustomerProvider>
            <CartProvider>
              <WishlistProvider>
                <Toaster />
                <Sonner />
                <BrowserRouter>
                  <CartSummaryPopover />
                  <AppContent />
                </BrowserRouter>
              </WishlistProvider>
            </CartProvider>
          </CustomerProvider>
        </RegionProvider>
      </CartSummaryProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
