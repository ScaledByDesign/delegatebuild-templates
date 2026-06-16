
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Index from "./pages/Index";
import ProductDetail from "./pages/ProductDetail";
import Collection from "./pages/Collection";
import Collections from "./pages/Collections";
import CollectionDetail from "./pages/CollectionDetail";
import Cart from "./pages/Cart";

import CheckoutSuccess from "./pages/CheckoutSuccess";
import QuickCheckout from "./pages/QuickCheckout";
import ExpressCheckout from "./pages/ExpressCheckout";
import Receipt from "./pages/Receipt";
import TrackOrder from "./pages/TrackOrder";
import Returns from "./pages/Returns";
import About from "./pages/About";
import Contact from "./pages/Contact";
import Search from "./pages/Search";
import CancelMembership from "./pages/CancelMembership";
import ThankYou from "./pages/ThankYou";
import TrnCancelForm from "./pages/TrnCancelForm";
import TermsDisclaimer from "./pages/TermsDisclaimer";
import ShippingPolicy from "./pages/ShippingPolicy";
import ReturnPolicy from "./pages/ReturnPolicy";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import WhitelistInstruction from "./pages/WhitelistInstruction";
import Account from "./pages/Account";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import GiftCards from "./pages/GiftCards";
import Wishlist from "./pages/Wishlist";
import Loyalty from "./pages/Loyalty";
import Admin from "./pages/Admin";
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
