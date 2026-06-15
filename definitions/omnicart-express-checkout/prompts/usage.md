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

### Coupon / promo codes

Apply and remove promotion (coupon) codes with the helpers in `src/lib/omnicart.ts`:

```ts
import { applyDiscount, removeDiscount } from "@/lib/omnicart";

const res = await applyDiscount(cart.id, "SAVE10");
if (res.ok) setCart(res.cart!);          // backend re-prices the cart
else showError(res.error);               // e.g. invalid/expired code

await removeDiscount(cart.id, "SAVE10");
```

These proxy to the OmniCart backend's **promotions** API (`POST`/`DELETE /api/omnicart/carts/:id/promotions`, body `{ promo_codes: [code] }`). In OmniCart (Medusa v2) both add and remove use the **same path** and the code travels in the request body, not the URL. The backend re-validates the code and re-prices the cart, so the returned `cart.promotions[]`, `discount_total` and `total` are authoritative (anti-tamper). Note: a v2 promotion carries **no per-promotion amount** — the cart-level `discount_total` is the source of truth for total savings. When no backend is configured, the call returns a `503 { demo: true }` signal and `CheckoutPage` falls back to the in-template `DEMO_COUPONS` table (`SAVE10`, `WELCOME15`, `FLAT5`) so the field is interactive out of the box. The `OrderSummary` card renders the promo-code input, applied codes (removable), and a **Discount** row driven by `discount_total`; replace the demo table by wiring a live backend. Ref: [Manage Cart Promotions](https://docs.medusajs.com/resources/storefront-development/cart/manage-promotions).

## Worker API (`worker/userRoutes.ts`)

* `/api/omnicart/*` — proxies the OmniCart storefront API to the configured backend, attaching `x-publishable-api-key` server-side. **Use it without modification** for all storefront calls. This includes promotion (coupon) codes: `POST /api/omnicart/carts/:id/promotions` and `DELETE /api/omnicart/carts/:id/promotions`, both with body `{ promo_codes: [code] }` (Medusa v2 — same path for add/remove, code in the body array). When no backend is configured these short-circuit with `503 { demo: true }` so the client can use its demo coupon table.
* `/api/upsell/session` (POST) — initializes a post-purchase upsell session for a paid order via the OmniCart **Flow Builder** runtime; returns `{ session, entry_node }`.
* `/api/upsell/click` (GET) — accepts/declines the current offer node and walks the flow graph; on accept it charges the saved payment method (one-click). Returns the next node or a terminal result. **Use without modification.**
* `/api/omnicart-config` — returns browser-safe config (the Stripe publishable key + whether the backend/upsell runtime are configured) for initializing Stripe Elements and choosing live-vs-demo upsells. Fetch this on the payment step.

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
4. **Upsell** (`UpsellStep.tsx`) — **Flow Builder driven post-purchase upsell sequence** shown after payment is captured. Renders the *current* flow node (offer); accepting charges the *same* saved payment method (no re-entering card details) and walks the success branch, declining walks the decline branch. The page loops through multiple offers until a terminal node, then proceeds to confirmation.
5. **Confirmation** (`ConfirmationStep.tsx`) — an **itemized receipt** after a successful purchase: every line item (including **every** accepted upsell from the flow journey) plus a totals breakdown — subtotal, discounts (with applied code labels from the promotions list), shipping, tax, and **total paid**. The `OrderSummary` confirmation object carries `subtotal`, `shipping_total`, `tax_total`, `discount_total`, `total`, and `promotions[]` (each with `code`; the discount amount comes from `discount_total`).

A step indicator (`CheckoutSteps.tsx`) shows progress for the core cart → shipping → payment → done steps. The upsell is intentionally not a visible progress step — the offer sequence appears as bonus offers between payment capture and confirmation. `CheckoutPage.tsx` owns the cart/order state, the upsell flow session, and the current step.

### Flow Builder driven upsell sequence (`src/lib/upsell-flow.ts` + `src/lib/flow-types.ts`)

The post-purchase upsells are **not** a single hardcoded offer — they are driven by the OmniCart **Flow Builder**, a merchant-designed directed graph of offer nodes (mirror of the Delegate `UpsellButton` model). Each node carries its accept CTA, price (or multi-accept options like 1/2/3 packs), an optional server-enforced timer, and `success_next_button_id` / `decline_next_button_id` branches plus terminal flags.

After payment, `CheckoutPage.handlePaid` calls `startUpsellFlow({ orderId, originalOrderTotal })` to initialize a session and resolve the entry node. Each Accept/Decline calls `stepUpsellFlow({ session, action, variantId })`, which hits `/api/upsell/click` — the runtime charges the saved payment method on accept (anti-tamper: it re-resolves price server-side), records the journey step, and returns the next node. The page renders that node and repeats until `is_terminal` (or no next node), then advances to confirmation.

* **Multi-accept nodes**: when a node has `accept_options`, `UpsellStep` shows a selector and sends the chosen option `id` as `variantId`.
* **Branching**: design upsell → downsell flows by pointing a node's `decline_next_button_id` at a cheaper downsell node.
* **Demo fallback**: when no backend is configured (`/api/omnicart-config` reports `backendConfigured: false`), the client walks the in-browser `DEMO_FLOW_NODES` (a 2-offer upsell→downsell + multi-accept example) so the generated page renders a full multi-upsell journey out of the box. Replace by wiring the runtime env vars below and fetching the merchant's real flow.

Keep the offer content in the flow (server / `DEMO_FLOW_NODES`), not hardcoded in components — `UpsellStep` is a pure node renderer.

## Styling

* Generate a **fully responsive**, polished checkout UI.
* Use the preinstalled **Shadcn/UI** components from `@/components/ui/...` (Button, Input, Card, Label, Separator, RadioGroup, Badge, Skeleton) rather than writing custom equivalents. The coupon field uses `Input` + `Button`; the discount/totals rows use `Separator`.
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
* **OMNICART_UPSELL_RUNTIME_URL** — base URL of the OmniCart **Flow Builder** upsell runtime (drives the post-purchase offer sequence).
* **OMNICART_UPSELL_RUNTIME_TOKEN** — service token for the upsell runtime (attached as a Bearer token server-side; never reaches the browser).
* **STRIPE_PUBLISHABLE_KEY** — Stripe publishable key, returned to the browser via `/api/omnicart-config`.

# Important Notes

* The cart → shipping → payment → **upsell sequence** → confirmation flow is the core of this template. Build your storefront around it rather than replacing it.
* The upsell offers are driven by the Flow Builder graph (`src/lib/flow-types.ts` / the live runtime), not hardcoded in `UpsellStep`. Add or reorder offers by editing the flow, not the component.
* Keep secrets server-side: only the Stripe **publishable** key and OmniCart public config ever reach the browser.
* **Do not edit/add/remove worker bindings or touch `wrangler.jsonc`/`wrangler.toml`.** Build around what is provided.
