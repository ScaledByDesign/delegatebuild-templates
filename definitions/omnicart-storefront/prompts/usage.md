# Usage Instructions

This template generates a complete **OmniCart Headless Storefront**. It connects directly to the OmniCart commerce backend using the client SDK, managing product discovery, variants, cart operations, customer profiles, and checkout entirely client-side.

> Developer note: OmniCart is the whitelabel commerce brand. It is implemented on top of the **Medusa** commerce framework (`@medusajs/js-sdk`). Keep all generated UI, copy, and component names branded as **OmniCart** - never expose "Medusa" to end users.

## Core Features and Page Routes

- **Homepage (`src/pages/Index.tsx`)** - Hero banner, featured products, categories carousel, newsletter.
- **Product Details (`src/pages/ProductDetail.tsx`)** - Image gallery, variant selection, size chart, add-to-cart, related products.
- **Shopping Cart (`src/pages/Cart.tsx`)** - Line item grid, quantity adjusters, subtotal summary, promo code box.
- **Multi-step Checkout (`src/pages/ExpressCheckout.tsx`)** - Contact details, shipping address, shipping methods, Stripe payment collection.
- **Customer Dashboard (`src/pages/Account.tsx`)** - Order history, track status, user profile, loyalty tier metrics.
- **Search (`src/pages/Search.tsx`)** - Query inputs, filtering, sort selectors, and search results.

## Client Configuration & API (`src/lib/medusa-client.ts` & `src/lib/sdk.ts`)

Store operations are performed directly against the commerce backend using the fetch-based `medusaClient` instance:
```typescript
import { medusaClient } from "@/lib/medusa-client";

// Browse catalog
const data = await medusaClient.get<{ products: any[] }>("/store/products", {
  query: { limit: 10 }
});
// Manage cart
const cart = await medusaClient.post<{ cart: any }>("/store/carts");
```
All client API requests use browser fetch and run client-side using these environment configurations:
- `VITE_OMNICART_BACKEND_URL` — Base URL of the OmniCart commerce server.
- `VITE_OMNICART_PUBLISHABLE_KEY` — Public publishable API key for the storefront channel.

## Stripe Payment Integration

Checkout page integrates PCI-compliant card fields using `@stripe/stripe-js` and `@stripe/react-stripe-js` elements:
- Use the publishable key returned from configuration or fetched from the backend.
- The browser mounts standard Stripe card components and processes the PaymentIntent confirmation.

## Customization and Styling

- **Tailwind Palette**: Merchant-specific styling is customized directly in the local `tailwind.config.js` to enable brand highlights, custom buttons, custom fonts, and animations.
- **Light Theme**: The storefront layout is styled using light theme tokens as the default. Avoid forcing a dark mode or displaying toggles unless requested.

## Core Architecture and Protected Files

To maintain storefront stability and ensure production-grade checkout, the core ecommerce plumbing is strictly protected and read-only.
- **Do not attempt to rewrite or modify** `src/components/product/ProductMediaGallery.tsx`, `src/pages/ProductDetail.tsx`, `src/pages/ExpressCheckout.tsx`, or any files under `src/lib/`, `src/hooks/`, or `src/context/`.
- Focus your modifications on user-facing storefront customisations, such as rewriting the homepage (`src/pages/Index.tsx`), adding marketing sections, adjusting styles, or adding custom landing pages.
