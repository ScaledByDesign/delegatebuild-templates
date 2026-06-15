# Usage Instructions

This template generates an **OmniCart Express Checkout** storefront. The flow is split across THREE routes that mirror the upw-sendpaylinks headless checkout exactly — `/c/:code` (the public checkout one-pager), `/upsell/:sessionId` (one post-purchase upsell offer per route), and `/success` (the receipt). There is NO homepage / storefront / cart-summary landing: `/` redirects straight into the checkout. The checkout page lives at `src/pages/CheckoutPage.tsx`, each upsell offer at `src/pages/UpsellOfferPage.tsx`, and the receipt at `src/pages/SuccessPage.tsx`, composed of step components in `src/components/checkout/`. The page auto-updates as you edit.

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

### Cart lifecycle (initial checkout)

The initial checkout (cart → shipping → payment) is wired to the full **OmniCart (Medusa v2) cart lifecycle** via typed helpers in `src/lib/omnicart.ts`. Every helper returns a `BackendResult<T>` (`{ ok, data?, demo?, error? }`) — when no backend is configured the Worker proxy returns `503 { demo: true }`, the helper reports `demo: true`, and `CheckoutPage` keeps its self-contained demo state. **Never** call the backend directly; always go through these helpers so the publishable key + backend URL stay server-side.

```ts
import {
  createCart, addLineItem, updateLineItem, removeLineItem,
  updateCartContact, listShippingOptions, addShippingMethod,
  listPaymentProviders, createPaymentCollection, initPaymentSession, completeCart,
} from "@/lib/omnicart";

const created = await createCart(region_id);            // POST /carts { region_id }
if (!created.demo && created.ok) {
  let cart = created.data!;
  const added = await addLineItem(cart.id, variant_id, 1); // POST /carts/:id/line-items
  if (added.ok) cart = added.data!;
  await updateLineItem(cart.id, line_id, 2);               // POST /carts/:id/line-items/:line_id
  await removeLineItem(cart.id, line_id);                  // DELETE /carts/:id/line-items/:line_id (cart under `parent`)
  await updateCartContact(cart.id, { email, shipping_address }); // POST /carts/:id
  const opts = await listShippingOptions(cart.id);        // GET /shipping-options?cart_id=:id
  await addShippingMethod(cart.id, opts.data![0].id);     // POST /carts/:id/shipping-methods
  const pc = await createPaymentCollection(cart.id);      // POST /payment-collections { cart_id }
  await initPaymentSession(pc.data!.id, provider_id);     // POST /payment-collections/:id/payment-sessions
  const order = await completeCart(cart.id);              // POST /carts/:id/complete -> { type:"order", order }
}
```

`CheckoutPage.tsx` orchestrates this end-to-end:
* **On mount** it calls `createCart(region_id)` and seeds the cart with the demo line items via `addLineItem`. If the backend isn't wired (`demo: true`) it stays on the in-template `DEMO_CART`. A `liveCart` flag tracks which mode is active.
* **Cart edits** (`updateQuantity`/`removeItem`) call `updateLineItem`/`removeLineItem` when live (the repriced cart is authoritative) and edit local state in demo mode.
* **Shipping continue** calls `updateCartContact` (email + address), `listShippingOptions` (real options replace the demo set in `shippingOptions` state), then `addShippingMethod` for the selection.
* **Payment capture** (`handlePaid`) lists providers (`listPaymentProviders`), creates the payment collection (`createPaymentCollection`), initializes the session (`initPaymentSession`), then `completeCart`. On `{ type: "order" }` it adopts the real order; otherwise it surfaces the cart-level error. In demo mode it synthesizes a demo order. On a successful charge it starts the upsell session (`startUpsellFlow`), persists the handoff (`saveHandoff` in `src/lib/checkout-session-store.ts`), and **navigates** to `/upsell/:sessionId?nodeId=<entry>` (first offer page) — or to `/success?session=&orderId=` when the flow has no offers. This mirrors upw-sendpaylinks' `CheckoutForm.handlePaymentSuccess`: `create-session` → `upsellUrl` `/upsell/{sessionId}`, else the `successUrl`.

Each v2 endpoint shape comes from the official [Express Checkout guide](https://docs.medusajs.com/resources/storefront-development/guides/express-checkout). Address fields use `country_code` lowercased (e.g. `us`). The demo fallback is intentional — keep it so the generated checkout works out of the box.

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

* `/api/omnicart/*` — proxies the OmniCart storefront API to the configured backend, attaching `x-publishable-api-key` server-side. **Use it without modification** for all storefront calls. This covers the full Medusa v2 cart lifecycle (`carts`, `line-items`, `shipping-options`, `shipping-methods`, `payment-providers`, `payment-collections`, `complete`) plus promotion (coupon) codes (`POST`/`DELETE /api/omnicart/carts/:id/promotions`, body `{ promo_codes: [code] }`). A single demo-mode guard short-circuits **every** `/api/omnicart/*` path with `503 { demo: true }` when no backend is configured, so the client falls back to its in-template demo behavior across the entire checkout.
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

## Route map (CRITICAL — mirrors upw-sendpaylinks)

The flow is split across separate routes (NOT step state in one component). Route names mirror the upw-sendpaylinks headless checkout exactly:

* **`/`** redirects to `/c/demo`. There is **no** homepage / storefront / cart-summary landing.
* **`/c/:code`** (`CheckoutPage.tsx`) — the public checkout one-pager. `:code` is the short checkout code that resolves the order payload (mirror of upw-sendpaylinks' `resolveCheckoutLink(code)`). Cart review, shipping, and payment are **on-page sections** (`section` state = `"cart" | "shipping" | "payment"`), not routes.
* **`/upsell/:sessionId`** (`UpsellOfferPage.tsx`) — **one** post-purchase upsell OFFER per route. The `?nodeId=<buttonId>` query param (carried in router state) selects which Flow Builder node to render — this is the template's equivalent of upw-sendpaylinks' per-offer `externalPageUrl` convention (`?sessionId=&nodeId=&flowId=`). Each offer being its own route lets the builder author a bespoke, fully-designed page per offer.
* **`/success`** (`SuccessPage.tsx`) — the receipt (the `successUrl` / `completionRedirectUrl` target). Reads `?session=` and renders the paid base order + the accepted-upsell journey + grand total.

The on-page checkout sections (components under `src/components/checkout/`):

1. **Cart** (`CartStep.tsx`) — line items, quantities, subtotal/total via `formatAmount`.
2. **Shipping** (`ShippingStep.tsx`) — address form + shipping option selection.
3. **Payment** (`PaymentStep.tsx`) — Stripe Elements card form; creates the payment session and completes the cart. On a successful charge the page hands off to the `/upsell/:sessionId` route.

The upsell offer page and receipt are SEPARATE routes:

* **Upsell offer** (`pages/UpsellOfferPage.tsx`) — the **Flow Builder driven post-purchase upsell**, one offer per route. Accepting charges the *same* saved payment method (no re-entering card details) and **navigates** to the next offer route (`/upsell/:sessionId?nodeId=<next>`); declining walks the decline branch the same way. A terminal node navigates to `/success`. Mirrors upw-sendpaylinks' `/api/upsell/accept|decline` handleNextStep branching (`hasMoreOffers` | `showDownsell` | `completionRedirectUrl`).
* **Receipt** (`pages/SuccessPage.tsx`) — an **itemized receipt**: the paid base order plus **every** accepted upsell from `session.journey` (steps with `action === "success"` and `revenue > 0`), and the cumulative grand total (`session.total_revenue`). The `OrderSummary` object carries `subtotal`, `shipping_total`, `tax_total`, `discount_total`, `total`, and `promotions[]` (each with `code`; the discount amount comes from `discount_total`).

A step indicator (`CheckoutSteps.tsx`) shows progress for the on-page cart → shipping → payment sections. The upsell is intentionally not a visible progress step (it's a separate route after payment). `CheckoutPage.tsx` owns the cart/order state; the **checkout->upsell->receipt handoff** is persisted via `src/lib/checkout-session-store.ts` (`saveHandoff`/`loadHandoff`/`updateHandoffSession`/`clearHandoff`) — the template's in-browser stand-in for the platform's server-side session retrieval. When a real upsell runtime is wired, replace those reads with fetches to `/api/upsell/*`; the route components don't care where the data comes from.

### Flow Builder driven upsell sequence (`src/lib/upsell-flow.ts` + `src/lib/flow-types.ts`)

The post-purchase upsells are **not** a single hardcoded offer — they are driven by the OmniCart **Flow Builder**, a merchant-designed directed graph of offer nodes (mirror of the Delegate `UpsellButton` model). Each node carries its accept CTA, price (or multi-accept options like 1/2/3 packs), an optional server-enforced timer, and `success_next_button_id` / `decline_next_button_id` branches plus terminal flags.

After payment, `CheckoutPage.handlePaid` calls `startUpsellFlow({ orderId, originalOrderTotal })` to initialize a session and resolve the entry node, persists the handoff via `saveHandoff`, and **navigates** to `/upsell/:sessionId?nodeId=<entry>`. On the upsell route, each Accept/Decline calls `stepUpsellFlow({ session, action, variantId })`, which hits `/api/upsell/click` — the runtime charges the saved payment method on accept (anti-tamper: it re-resolves price server-side), records the journey step, and returns the next node. `UpsellOfferPage` then **navigates to the next route** — `/upsell/:sessionId?nodeId=<next>` for another offer, or `/success?session=&orderId=` when the node is terminal (or there is no next node).

* **Multi-accept nodes**: when a node has `accept_options`, `UpsellOfferPage` shows a selector and sends the chosen option `id` as `variantId`.
* **Branching**: design upsell → downsell flows by pointing a node's `decline_next_button_id` at a cheaper downsell node.
* **Demo fallback**: when no backend is configured (`/api/omnicart-config` reports `backendConfigured: false`), the client walks the in-browser `DEMO_FLOW_NODES` (a 2-offer upsell→downsell + multi-accept example) so the generated page renders a full multi-upsell journey out of the box. Replace by wiring the runtime env vars below and fetching the merchant's real flow.

Keep the offer content in the flow (server / `DEMO_FLOW_NODES`), not hardcoded in components — `UpsellOfferPage` is a pure node renderer per route.

## Styling

* Generate a **fully responsive**, polished checkout UI.
* Use the preinstalled **Shadcn/UI** components from `@/components/ui/...` (Button, Input, Card, Label, Separator, RadioGroup, Badge, Skeleton) rather than writing custom equivalents. The coupon field uses `Input` + `Button`; the discount/totals rows use `Separator`.
* Use Tailwind spacing, layout and typography utilities.
* Icons come from `lucide-react`.

## Routing (CRITICAL)

Uses `createBrowserRouter` — do NOT switch to `BrowserRouter`/`HashRouter`/`MemoryRouter`. If you switch routers, `RouteErrorBoundary`/`useRouteError()` will break.

**The route map is fixed (mirrors upw-sendpaylinks). Do NOT add a homepage route** — `/` redirects into the checkout:
```tsx
import { Navigate } from "react-router-dom";

const router = createBrowserRouter([
  { path: "/", element: <Navigate to="/c/demo" replace />, errorElement: <RouteErrorBoundary /> },
  { path: "/c/:code", element: <CheckoutPage />, errorElement: <RouteErrorBoundary /> },
  { path: "/upsell/:sessionId", element: <UpsellOfferPage />, errorElement: <RouteErrorBoundary /> },
  { path: "/success", element: <SuccessPage />, errorElement: <RouteErrorBoundary /> },
]);
```

**Navigation between routes:** use `import { useNavigate } from 'react-router-dom'` then `const navigate = useNavigate(); navigate('/upsell/' + sessionId + '?nodeId=' + nextId, { state: { node, offerIndex } })`. The checkout->upsell->success handoff travels via `saveHandoff`/`loadHandoff` (`src/lib/checkout-session-store.ts`) plus the `?session=`/`?nodeId=` query params. Do NOT add a storefront/homepage route — the public entry point is `/c/:code`.

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

* The route flow `/c/:code` (cart → shipping → payment on-page sections) → `/upsell/:sessionId` (one offer per route) → `/success` (receipt) is the core of this template. Build your storefront around these routes rather than replacing them or collapsing them back into a single page.
* The upsell offers are driven by the Flow Builder graph (`src/lib/flow-types.ts` / the live runtime), not hardcoded in `UpsellOfferPage`. Add or reorder offers by editing the flow, not the component.
* Keep secrets server-side: only the Stripe **publishable** key and OmniCart public config ever reach the browser.
* **Do not edit/add/remove worker bindings or touch `wrangler.jsonc`/`wrangler.toml`.** Build around what is provided.
