# Usage Instructions

This template generates an **OmniCart Express Checkout** storefront. The checkout experience lives at `src/pages/CheckoutPage.tsx` and is composed of step components in `src/components/checkout/`. The page auto-updates as you edit.

> Developer note: OmniCart is the whitelabel commerce brand. It is implemented on top of the **Medusa** commerce framework (`@medusajs/medusa-js`). Keep all generated UI, copy, and component names branded as **OmniCart** — never expose "Medusa" to end users.

## Commerce client (`src/lib/omnicart.ts`)

The `omnicart` client is preconfigured to talk to the same-origin Worker proxy at `/api/omnicart`. **Use it** for all store operations (carts, regions, shipping options, payment sessions, completing orders). Do not call the backend directly from the browser — always go through `omnicart` so the publishable key and backend URL stay server-side.

```ts
import { omnicart, formatAmount, type OmniCart } from "@/lib/omnicart";

// Create / retrieve a cart
const { cart } = await omnicart.carts.create({ region_id });
// Add a line item
await omnicart.carts.lineItems.create(cart.id, { variant_id, quantity: 1 });
```

`formatAmount(amount, currencyCode)` formats minor-unit amounts (cents) into a localized currency string for display.

## Worker API (`worker/userRoutes.ts`)

* `/api/omnicart/*` — proxies the OmniCart storefront API to the configured backend, attaching `x-publishable-api-key` server-side. **Use it without modification** for all storefront calls.
* `/api/omnicart-config` — returns browser-safe config (the Stripe publishable key) for initializing Stripe Elements. Fetch this on the payment step.

## Stripe payment

The payment step uses Stripe Elements. Initialize Stripe with the publishable key fetched from `/api/omnicart-config`:

```tsx
import { loadStripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";
```

Never hardcode or expose secret keys client-side. The publishable key is the only Stripe key that reaches the browser.

## Checkout flow (recommended structure)

The single-page checkout advances through these steps. Keep them as components under `src/components/checkout/`:

1. **Cart** (`CartStep.tsx`) — line items, quantities, subtotal/total via `formatAmount`.
2. **Shipping** (`ShippingStep.tsx`) — address form + shipping option selection.
3. **Payment** (`PaymentStep.tsx`) — Stripe Elements card form; creates the payment session and completes the cart.
4. **Upsell** (`UpsellStep.tsx`) — **post-purchase one-click upsell** shown after payment is captured. Accepting charges the *same* saved payment method for an extra item (no re-entering card details) and appends it to the order; declining proceeds to confirmation.
5. **Confirmation** (`ConfirmationStep.tsx`) — order summary after a successful purchase, reflecting any accepted upsell.

A step indicator (`CheckoutSteps.tsx`) shows progress for the core cart → shipping → payment → done steps. The upsell is intentionally not a visible progress step — it appears as a bonus offer between payment capture and confirmation. `CheckoutPage.tsx` owns the cart/order state and current step, passing them down.

### Post-purchase one-click upsell

The upsell is the classic funnel-style offer: after the customer's payment method is captured, present a one-time offer that can be added to the existing order with a single click. To wire it to a live OmniCart backend, in `CheckoutPage.handleAcceptUpsell` call the `omnicart` client to add the upsell variant to the order using the already-captured payment session, instead of the demo timeout. Fetch the real offer (e.g. per completed cart/order) rather than using `DEMO_UPSELL`.

## Styling

* Generate a **fully responsive**, polished checkout UI.
* Use the preinstalled **Shadcn/UI** components from `@/components/ui/...` (Button, Input, Card, Label, Separator, RadioGroup, Badge, Skeleton) rather than writing custom equivalents.
* Use Tailwind spacing, layout and typography utilities.
* Icons come from `lucide-react`.

## Routing (CRITICAL)

Uses `createBrowserRouter` — do NOT switch to `BrowserRouter`/`HashRouter`/`MemoryRouter`. If you switch routers, `RouteErrorBoundary`/`useRouteError()` will break.

**Add routes in `src/main.tsx`:**
```tsx
const router = createBrowserRouter([
  { path: "/", element: <CheckoutPage />, errorElement: <RouteErrorBoundary /> },
]);
```

**Navigation:** `import { Link } from 'react-router-dom'` then `<Link to="/">...</Link>`.

**Don't:**
* Use `BrowserRouter`, `HashRouter`, `MemoryRouter`
* Remove `errorElement` from routes
* Use `useRouteError()` in your own components

## UI Components

All ShadCN components are in `./src/components/ui/*`. Import and use them directly:
```tsx
import { Button } from "@/components/ui/button";
```
**Do not rewrite these components.**

---

# Environment Variables (deployment)

Configured in `wrangler.jsonc` / dashboard (do NOT edit `wrangler.jsonc` from the app):

* **OMNICART_BACKEND_URL** — the OmniCart commerce backend base URL.
* **OMNICART_PUBLISHABLE_KEY** — the OmniCart storefront publishable key (injected server-side by the proxy).
* **STRIPE_PUBLISHABLE_KEY** — Stripe publishable key, returned to the browser via `/api/omnicart-config`.

# Important Notes

* The cart → shipping → payment → confirmation flow is the core of this template. Build your storefront around it rather than replacing it.
* Keep secrets server-side: only the Stripe **publishable** key and OmniCart public config ever reach the browser.
* **Do not edit/add/remove worker bindings or touch `wrangler.jsonc`/`wrangler.toml`.** Build around what is provided.
