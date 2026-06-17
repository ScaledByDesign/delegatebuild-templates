# Usage Instructions

This template generates a **Universal Express Checkout** storefront. The flow is split across THREE routes that mirror the upw-sendpaylinks headless checkout exactly — `/c/:code` (the public checkout one-pager), `/upsell/:sessionId` (one post-purchase upsell offer per route), and `/success` (the receipt). There is NO homepage / storefront / cart-summary landing: `/` redirects straight into the checkout. The checkout page lives at `src/pages/CheckoutPage.tsx`, each upsell offer at `src/pages/UpsellOfferPage.tsx`, and the receipt at `src/pages/SuccessPage.tsx`, composed of step components in `src/components/checkout/`. What makes it universal: the initial charge is driven by a **processor-agnostic adapter contract** (`src/lib/checkout/`), so the same UI can complete a purchase through Stripe, OmniCart, Konnektive, or Sticky.io. The page auto-updates as you edit.

> Developer note: OmniCart is the whitelabel commerce brand. It is implemented on top of **Medusa v2** using the official storefront SDK (`@medusajs/js-sdk`), which is already declared in `package.json` — do NOT run `bun add`/`npm install` for it. NEVER install `@medusajs/medusa-js`: that is the deprecated Medusa **v1** client, it is incompatible with this v2 storefront, and the version the build may guess does not exist (the install will fail). Keep all generated UI, copy, and component names branded as **OmniCart** - never expose "Medusa" to end users.

## Checkout adapter contract (`src/lib/checkout/`)

Every payment processor is plugged in through one contract so the checkout UI never hardcodes a gateway. The pieces:

* **`types.ts`** - the contract. `CheckoutProcessorAdapter` exposes:
  * `kind` - the `ProcessorKind` (`"stripe" | "omnicart" | "konnektive" | "stickyio"`).
  * `capabilities` - a `CheckoutProcessorCapabilities` map (see below).
  * `chargeInitial(input: ChargeInitialInput): Promise<ChargeInitialResult>` - charges the initial order. Result is a discriminated union: `succeeded` (`{ status, processorOrderId, order }`), `requires_action` (`{ status, clientSecret, returnUrl? }` for SCA/3DS), `failed` (`{ status, errorCode, userMessage }`), or `demo` (`{ status: "demo" }`).
  * `initPayment?(input: PaymentInitInput): Promise<PaymentInitResult>` - **payment-class only**. Prepares the in-browser collection step. Result union: `collect_payment_method` (`{ publishableKey, amountCents, currencyCode, initToken? }`), `confirm_client_secret` (`{ publishableKey, clientSecret, paymentCollectionId, cartId? }`), `failed`, or `demo`.
* **`capabilities.ts`** - the `Capability` vocabulary (`card_charge`, `subscription`, `saved_payment_method`, `apple_pay`, `google_pay`, `paypal_wallet`, `sca_3ds_fallback`, `refund`, `order_bump`, `address_validation`) and the three-tier `CheckoutProcessorCapabilities` shape: `publish` (always supported), `render` (UI-surfaced, e.g. wallets), `runtimeFallback` (conditional, e.g. 3DS). Use `hasPublishCapability` / `hasRenderCapability` / `hasRuntimeFallbackCapability` to branch UI, and `buildCapabilities(publish, render?, runtimeFallback?)` to declare a new adapter.
* **`manifest.ts`** - `PROCESSOR_MANIFEST`, the source of truth for which processors exist and their `label` + `class` (`"payment" | "crm"`). Exports `ProcessorKind`, `PROCESSOR_IDS`, `PROCESSOR_LABELS`, `PROCESSOR_CLASSES`, `isProcessorKind`, `processorLabel`.
* **`registry.ts`** - `getCheckoutAdapter(kind)` lazily imports + caches the adapter for a kind; `listRegisteredKinds()` lists them. The registry is keyed off the manifest so adding a processor is: implement the adapter, add a manifest entry, add a registry thunk.
* **`proxy.ts`** - `checkoutProxy<T>(kind, path, body, pick, fallbackError, init?)`. All adapters call their backend through this single helper, which POSTs to `/api/checkout/:kind/:path` and decodes a `503 { demo: true }` response into `{ demo: true }`. **Never** call a processor backend directly from the browser - always go through `checkoutProxy` so keys stay server-side and demo fallback works uniformly.

### Adapter classes

* **Payment-class** (`adapters/stripe.ts`, `adapters/omnicart.ts`) - implement **both** `initPayment` and `chargeInitial`. The page calls `initPayment` first to collect/confirm a payment method in the browser, then `chargeInitial` to capture.
* **CRM-class** (`adapters/konnektive.ts`, `adapters/stickyio.ts`) - implement `chargeInitial` **only**. The CRM owns the gateway and vaulting, so a single server-side call charges the order. Sticky.io can still return `requires_action` (declares `sca_3ds_fallback`).

```ts
import { getCheckoutAdapter } from "@/lib/checkout/registry";
import { hasPublishCapability } from "@/lib/checkout/capabilities";

const adapter = await getCheckoutAdapter("stripe");

// Payment-class: collect first, then charge
if (adapter.initPayment) {
  const init = await adapter.initPayment({ cart, customer, chargeTarget });
  // ...mount the collection UI from init (publishableKey / clientSecret)...
}
const result = await adapter.chargeInitial({ cart, customer, chargeTarget, idempotencyKey });
switch (result.status) {
  case "succeeded":       /* result.order is an OrderSummary */ break;
  case "requires_action": /* surface SCA/3DS using result.clientSecret */ break;
  case "failed":          /* show result.userMessage */ break;
  case "demo":            /* synthesize a demo order so upsell + confirmation run */ break;
}

const canSubscribe = hasPublishCapability(adapter.capabilities, "subscription");
```

`CheckoutPage.tsx` orchestrates this: it owns `processor` state (defaults to `"omnicart"`), resolves the active `adapter` via `getCheckoutAdapter`, builds a `ChargeTarget` from the cart in `buildChargeTarget()`, and in `handlePaid` runs `initPayment` (payment-class) then `chargeInitial`, pattern-matching the result union (adopt order / surface 3DS notice / show error / fall to demo). On a successful charge it starts the upsell session (`startUpsellFlow`), persists the handoff (`saveHandoff` in `src/lib/checkout-session-store.ts`), and **navigates** to `/upsell/:sessionId?nodeId=<entry>` (first offer page) — or to `/success?session=&orderId=` when the flow has no offers. This mirrors upw-sendpaylinks' `CheckoutForm.handlePaymentSuccess`: `create-session` → `upsellUrl` `/upsell/{sessionId}`, else the `successUrl`. The `ProcessorPicker` at the cart step lets the user switch processors.

## Commerce client (`src/lib/omnicart.ts`)

`src/lib/omnicart.ts` wraps the official **Medusa v2 SDK** (`@medusajs/js-sdk`) and exposes typed lifecycle helpers (carts, shipping options, payment sessions, promotions, order completion). **Use these helpers** for all store operations; the OmniCart adapter reuses them for its charge. Each returns a `BackendResult<T>` (`{ ok, data?, demo?, error? }`).

```ts
import {
  createCart, addLineItem, updateCartContact,
  listShippingOptions, addShippingMethod, formatAmount, type OmniCart,
} from "@/lib/omnicart";

const created = await createCart(region_id);          // sdk.store.cart.create
if (created.ok) await addLineItem(created.data!.id, variant_id, 1);
```

**Connecting to Medusa (Cloud or self-hosted) — DUAL MODE:** the SDK client is built in `omnicart.ts` and connects in one of two ways:

* **Default (same-origin Worker proxy):** the SDK targets `${origin}/api/omnicart`, and the app's OWN Worker forwards to the backend in `OMNICART_BACKEND_URL` server-side (attaching the publishable key). The browser holds no backend URL/key, CORS is centralized, and an unconfigured backend yields demo mode. **Never routes through the Delegate platform (CORE).**
* **Override (direct to a merchant's own Medusa — self-hosted or Medusa Cloud):** set `VITE_OMNICART_BACKEND_URL` to the ABSOLUTE Medusa backend URL and `VITE_OMNICART_PUBLISHABLE_KEY` to its publishable key (Medusa publishable keys are browser-safe by design). The SDK then connects straight to that backend. The Medusa backend must allow the storefront origin in its `store_cors` setting. Get the publishable key from Medusa Admin → Settings → Publishable API Keys (it is scoped to a sales channel).

Either way the backend is the Medusa store itself — NOT CORE — so a platform outage can never break the cart lifecycle. `formatAmount(amount, currencyCode)` formats minor-unit amounts (cents) into a localized currency string.

### Cart lifecycle (initial checkout)

The cart -> shipping flow is wired to the full **OmniCart (Medusa v2) cart lifecycle** via typed helpers in `src/lib/omnicart.ts`. Every helper returns a `BackendResult<T>` (`{ ok, data?, demo?, error? }`) - when no backend is configured the Worker proxy returns `503 { demo: true }`, the helper reports `demo: true`, and `CheckoutPage` keeps its self-contained demo state.

```ts
import {
  createCart, addLineItem, updateLineItem, removeLineItem,
  updateCartContact, listShippingOptions, addShippingMethod,
} from "@/lib/omnicart";

const created = await createCart(region_id);
if (!created.demo && created.ok) {
  let cart = created.data!;
  const added = await addLineItem(cart.id, variant_id, 1);
  if (added.ok) cart = added.data!;
  await updateCartContact(cart.id, { email, shipping_address });
  const opts = await listShippingOptions(cart.id);
  await addShippingMethod(cart.id, opts.data![0].id);
}
```

`CheckoutPage.tsx` calls `createCart` on mount, seeds the demo line items, and a `liveCart` flag tracks live-vs-demo. Cart edits and shipping selection use the helpers when live and edit local state in demo mode. **The initial charge itself is no longer OmniCart-specific** - it runs through the active processor adapter (above). Address fields use `country_code` lowercased (e.g. `us`). The demo fallback is intentional - keep it so the generated checkout works out of the box. Ref: [Express Checkout guide](https://docs.medusajs.com/resources/storefront-development/guides/express-checkout).

### Coupon / promo codes

Apply and remove promotion codes with the helpers in `src/lib/omnicart.ts`:

```ts
import { applyDiscount, removeDiscount } from "@/lib/omnicart";

const res = await applyDiscount(cart.id, "SAVE10");
if (res.ok) setCart(res.cart!);
else showError(res.error);
await removeDiscount(cart.id, "SAVE10");
```

These proxy to the OmniCart backend's **promotions** API (`POST`/`DELETE /api/omnicart/carts/:id/promotions`, body `{ promo_codes: [code] }`). Both add and remove use the **same path** and the code travels in the body. The backend re-validates and re-prices, so `cart.promotions[]`, `discount_total` and `total` are authoritative (anti-tamper). A v2 promotion carries **no per-promotion amount** - cart-level `discount_total` is the source of truth. When no backend is configured the call returns `503 { demo: true }` and `CheckoutPage` falls back to the in-template `DEMO_COUPONS` (`SAVE10`, `WELCOME15`, `FLAT5`). Ref: [Manage Cart Promotions](https://docs.medusajs.com/resources/storefront-development/cart/manage-promotions).

## Worker API (`worker/userRoutes.ts`)

* `/api/checkout/:kind/*` - **per-processor charge proxy.** Forwards DIRECTLY to the backend configured for that `kind` (e.g. `/api/checkout/stripe/charge-initial` -> `{STRIPE_CHECKOUT_BACKEND_URL}/checkout/charge-initial`), attaching processor credentials server-side. Payments are **never routed through the Delegate platform (CORE)** - each app talks straight to its processor backend, so a CORE outage can't break checkout (blast-radius isolation). Returns `404` for an unknown kind and `503 { demo: true }` when that processor's backend env var is unset, so each adapter degrades to demo independently. **Use without modification.**
* `/api/omnicart/*` - proxies the OmniCart storefront API (full Medusa v2 cart lifecycle + promotions) to `OMNICART_BACKEND_URL`, attaching `x-publishable-api-key` server-side. A demo-mode guard short-circuits every path with `503 { demo: true }` when no backend is configured. (Used in default same-origin mode; the direct `VITE_OMNICART_BACKEND_URL` override bypasses this.)
* `/api/upsell/session` (POST) - initializes a post-purchase upsell session for a paid order via the OmniCart **Flow Builder** runtime, keeping the runtime token server-side; returns `{ session, entry_node }`. **Degradable:** if CORE is unreachable the client falls back to the baked `FLOW_SNAPSHOT` (or the demo flow), so a CORE outage never blocks the already-completed checkout.
* `/api/upsell/click` (GET) - accepts/declines the current offer node and walks the flow graph; on accept it charges the saved payment method (one-click). **Use without modification.**
* `/api/omnicart-config` - returns browser-safe config (Stripe publishable key + whether the backend/upsell runtime are configured) for initializing Stripe Elements and choosing live-vs-demo upsells.

## Payment collection (payment-class processors)

Payment-class adapters return what the UI needs to collect a method. For **Stripe**, the payment step uses Stripe Elements initialized with the publishable key from the adapter's `initPayment` result (or `/api/omnicart-config`):

```tsx
import { loadStripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";
```

Never hardcode or expose secret keys client-side. Only the **publishable** key reaches the browser. CRM-class processors (Konnektive, Sticky.io) collect card details through their own server-side charge and do not mount Stripe Elements.

## Route map (CRITICAL — mirrors upw-sendpaylinks)

The flow is split across separate routes (NOT step state in one component). Route names mirror the upw-sendpaylinks headless checkout exactly:

* **`/`** redirects to `/c/demo`. There is **no** homepage / storefront / cart-summary landing.
* **`/c/:code`** (`CheckoutPage.tsx`) - the public checkout one-pager. `:code` is the short checkout code that resolves the order payload (mirror of upw-sendpaylinks' `resolveCheckoutLink(code)`). Cart review, shipping, and payment are **on-page sections** (`section` state = `"cart" | "shipping" | "payment"`), not routes.
* **`/upsell/:sessionId`** (`UpsellOfferPage.tsx`) - **one** post-purchase upsell OFFER per route. The `?nodeId=<buttonId>` query param (carried in router state) selects which Flow Builder node to render - this is the template's equivalent of upw-sendpaylinks' per-offer `externalPageUrl` convention (`?sessionId=&nodeId=&flowId=`). Each offer being its own route lets the builder author a bespoke, fully-designed page per offer.
* **`/success`** (`SuccessPage.tsx`) - the receipt (the `successUrl` / `completionRedirectUrl` target). Reads `?session=` and renders the paid base order + the accepted-upsell journey + grand total.

The on-page checkout sections (components under `src/components/checkout/`):

1. **Cart** (`CartStep.tsx`) - line items, quantities, subtotal/total via `formatAmount`. Renders the **`ProcessorPicker`** so the shopper/merchant chooses the active processor.
2. **Shipping** (`ShippingStep.tsx`) - address form + shipping option selection.
3. **Payment** (`PaymentStep.tsx`) - collection UI for the active payment-class adapter (Stripe Elements card form); CRM-class adapters charge server-side. On a successful charge the page hands off to the `/upsell/:sessionId` route.

The upsell offer page and receipt are SEPARATE routes:

* **Upsell offer** (`pages/UpsellOfferPage.tsx`) - the **Flow Builder driven post-purchase upsell**, one offer per route. Accepting charges the same saved payment method (no re-entry) and **navigates** to the next offer route (`/upsell/:sessionId?nodeId=<next>`); declining walks the decline branch the same way. A terminal node navigates to `/success`. Mirrors upw-sendpaylinks' `/api/upsell/accept|decline` handleNextStep branching (`hasMoreOffers` | `showDownsell` | `completionRedirectUrl`).
* **Receipt** (`pages/SuccessPage.tsx`) - an **itemized receipt**: the paid base order plus **every** accepted upsell from `session.journey` (steps with `action === "success"` and `revenue > 0`), and the cumulative grand total (`session.total_revenue`). The `OrderSummary` object carries `subtotal`, `shipping_total`, `tax_total`, `discount_total`, `total`, and `promotions[]`.

A step indicator (`CheckoutSteps.tsx`) shows progress for the on-page cart -> shipping -> payment sections. The upsell is intentionally not a visible progress step (it's a separate route after payment). `CheckoutPage.tsx` owns the cart/order state and the active processor + adapter; the **checkout->upsell->receipt handoff** is persisted via `src/lib/checkout-session-store.ts` (`saveHandoff`/`loadHandoff`/`updateHandoffSession`/`clearHandoff`) - the template's in-browser stand-in for the platform's server-side session retrieval. When a real upsell runtime is wired, replace those reads with fetches to `/api/upsell/*`; the route components don't care where the data comes from.

### Flow Builder driven upsell sequence (`src/lib/upsell-flow.ts` + `src/lib/flow-types.ts`)

The post-purchase upsells are driven by the OmniCart **Flow Builder**, a merchant-designed directed graph of offer nodes (mirror of the Delegate `UpsellButton` model). Each node carries its accept CTA, price (or multi-accept 1/2/3 packs), an optional server-enforced timer, and `success_next_button_id` / `decline_next_button_id` branches plus terminal flags. The upsell runs **regardless of which initial processor charged the order** - the charge adapter and the upsell engine are decoupled.

After the initial charge, `CheckoutPage.handlePaid` calls `startUpsellFlow({ orderId, originalOrderTotal })` to resolve the entry node, persists the handoff via `saveHandoff`, and **navigates** to `/upsell/:sessionId?nodeId=<entry>`. On the upsell route, each Accept/Decline calls `stepUpsellFlow({ session, action, variantId })` -> `/api/upsell/click`; the runtime charges the saved payment method on accept (anti-tamper: re-resolves price server-side) and returns the next node. `UpsellOfferPage` then **navigates to the next route** - `/upsell/:sessionId?nodeId=<next>` for another offer, or `/success?session=&orderId=` when the node is terminal.

* **Multi-accept nodes**: when a node has `accept_options`, `UpsellOfferPage` shows a selector and sends the chosen option `id` as `variantId`.
* **Branching**: design upsell -> downsell flows by pointing a node's `decline_next_button_id` at a cheaper node.
* **Demo / offline fallback**: when CORE is unreachable or unconfigured, the client walks a LOCAL flow. Inject the merchant's real published flow into `FLOW_SNAPSHOT` (in `src/lib/upsell-flow.ts`) to fall back to their actual offers; leave it `null` to fall back to the built-in `DEMO_FLOW_NODES` (a 2-offer upsell->downsell + multi-accept example).

Keep offer content in the flow (server / `DEMO_FLOW_NODES`), not hardcoded in components - `UpsellOfferPage` is a pure node renderer per route.

## Styling

* Generate a **fully responsive**, polished checkout UI.
* Use the preinstalled **Shadcn/UI** components from `@/components/ui/...` (Button, Input, Card, Label, Separator, RadioGroup, Badge, Skeleton) rather than custom equivalents.
* Use Tailwind spacing, layout and typography utilities. Icons come from `lucide-react`.

### Brand palette injection (CRITICAL)

The checkout is **LIGHT by default** (it is a customer-facing storefront, NOT a dashboard) and applies the merchant's brand palette on first paint. To skin the checkout to the requested brand, **edit the `BRAND_THEME` constant at the top of `src/pages/CheckoutPage.tsx`** — this is the single source of truth for the look:

```ts
export const BRAND_THEME = {
  primaryColor: "#2563eb",     // CTAs, links, focus rings, selected states
  accentColor: "#16a34a",      // highlights / success accents
  backgroundColor: "#ffffff",  // page surface — keep light
  foregroundColor: "#0a0a0a",  // ink
  fontFamily: "Inter, sans-serif",
  logoUrl: "",                 // optional merchant logo (replaces the wordmark)
  supportEmail: "support@example.com",
  statementName: "MERCHANT",
};
```

When the build request supplies a brand color palette, **set these values** — do NOT leave the defaults. The `theme` state seeds directly from `BRAND_THEME`, and the page injects a scoped `<style>` (`.checkout-root`) that pins the shadcn HSL tokens to LIGHT and applies the brand hex colors to `.bg-primary` / `.text-primary` / `.bg-accent` / focus rings. `/api/omnicart-config?code=` may still override per-checkout-code at runtime, merged over these defaults.

Alongside `BRAND_THEME`, `CheckoutPage.tsx` exposes a `CONFIG_SNAPSHOT` constant (default `null`): bake the merchant's resolved product config into it so that, when the live config endpoint is unreachable, the cart still seeds the merchant's real products instead of the generic demo cart.

* **Do NOT make the checkout dark by default** and do NOT add a dark-mode toggle to the checkout — the storefront strips the document `.dark` class on mount.
* **Do NOT use HSL triplets for the injected brand colors** — `BRAND_THEME` colors are plain CSS color strings (hex/rgb). The HSL token variables in the scoped `<style>` stay in `H S% L%` form because they are consumed via `hsl(var(--token))`.

### Brand voice, product context & marketing persona (CRITICAL)

The build brief may include a **brand voice / marketing persona** block and **product context** gathered up-front by the Delegate Checkout Builder AI (the merchant is asked for these at the start of the chat, and may also link Knowledge Base articles for company branding, product details, and persona). Treat any such guidance as **authoritative** and write ALL customer-facing copy to match it:

* **Tone & voice** — Match the requested brand voice everywhere copy is generated: headlines, the value-prop / benefits blurb, button labels (e.g. the CTA / "Complete Order" text), trust-signal microcopy, upsell offer headlines and accept/decline labels, and the success/receipt page. If the persona says "premium and understated", do not write punchy hype copy; if it says "playful DTC", loosen up. Never fall back to generic "Complete your purchase" filler when a voice is supplied.
* **Product context** — Use the supplied product description and target customer to write accurate, specific benefit copy and offer framing instead of placeholder text. Reflect who the buyer is in the persuasion angle.
* **Marketing persona** — When a persona/ICP is provided, tailor the urgency, social proof, and upsell framing to that audience.
* **Consistency** — The same voice must carry across the checkout one-pager, every upsell offer page, and the success page so the whole flow reads as one brand.

The brand voice / persona text arrives in the natural-language build query (rendered by Delegate's `renderFunnelQuery` from `spec.meta.marketingPersona`) alongside the color palette — apply BOTH: palette → `BRAND_THEME`, voice/persona → generated copy.

### Browser tab title & favicon

The `index.html` ships with a neutral `<title>Checkout</title>` and no Vite favicon — it is a customer-facing storefront, so it must NOT show "Vite + React + TS" in the browser tab. When the build brief supplies a brand/product name, **rewrite the `<title>` in `index.html` to that name** (e.g. `<title>Acme — Checkout</title>`). If a merchant logo/favicon is provided, add it as the favicon `<link rel="icon">`; otherwise leave the favicon out.

### Single-page stacked layout (CRITICAL)

The checkout one-pager is a **two-column layout** (left: stacked sections, right: sticky order summary), NOT a step wizard. ALL sections render at once on the left, stacked top-to-bottom:

1. Processor picker → 2. Cart line items (`CartStep`) → 3. Shipping address + options (`ShippingStep`) → 4. Payment (`PaymentStep`).

The right column is a sticky `OrderSummary` (subtotal, shipping, tax, discount, total, coupon field). Keep this stacked layout — do NOT gate sections behind "next" steps or collapse them into a wizard. The `CheckoutSteps` indicator component exists but the one-pager renders every section visible simultaneously.

## Routing (CRITICAL)

Uses `createBrowserRouter` - do NOT switch to `BrowserRouter`/`HashRouter`/`MemoryRouter`. If you switch routers, `RouteErrorBoundary`/`useRouteError()` will break.

**The route map is fixed (mirrors upw-sendpaylinks). Do NOT add a homepage route** - `/` redirects into the checkout:
```tsx
import { Navigate } from "react-router-dom";

const router = createBrowserRouter([
  { path: "/", element: <Navigate to="/c/demo" replace />, errorElement: <RouteErrorBoundary /> },
  { path: "/c/:code", element: <CheckoutPage />, errorElement: <RouteErrorBoundary /> },
  { path: "/upsell/:sessionId", element: <UpsellOfferPage />, errorElement: <RouteErrorBoundary /> },
  { path: "/success", element: <SuccessPage />, errorElement: <RouteErrorBoundary /> },
]);
```

**Navigation between routes:** use `import { useNavigate } from 'react-router-dom'` then `const navigate = useNavigate(); navigate('/upsell/' + sessionId + '?nodeId=' + nextId, { state: { node, offerIndex } })`. The checkout->upsell->success handoff travels via `saveHandoff`/`loadHandoff` (`src/lib/checkout-session-store.ts`) plus the `?session=`/`?nodeId=` query params. Do NOT add a storefront/homepage route - the public entry point is `/c/:code`.

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

* **OMNICART_BACKEND_URL** - the OmniCart commerce backend base URL (storefront + OmniCart charge adapter).
* **OMNICART_PUBLISHABLE_KEY** - the OmniCart storefront publishable key (injected server-side by the proxy).
* **STRIPE_CHECKOUT_BACKEND_URL** - backend base URL for the **Stripe** charge adapter (`/api/checkout/stripe/*`).
* **KONNEKTIVE_CHECKOUT_BACKEND_URL** - backend base URL for the **Konnektive** charge adapter (`/api/checkout/konnektive/*`).
* **STICKYIO_CHECKOUT_BACKEND_URL** - backend base URL for the **Sticky.io** charge adapter (`/api/checkout/stickyio/*`).
* **OMNICART_UPSELL_RUNTIME_URL** - base URL of the OmniCart **Flow Builder** upsell runtime.
* **OMNICART_UPSELL_RUNTIME_TOKEN** - service token for the upsell runtime (Bearer, server-side only).
* **STRIPE_PUBLISHABLE_KEY** - Stripe publishable key, returned to the browser via `/api/omnicart-config`.

Each processor's charge backend is independent: leave a processor's env var unset and that processor's `/api/checkout/:kind/*` calls return `503 { demo: true }`, so the adapter runs in demo mode while the others stay live. Payment charges always go **directly** to these processor backends and **never** through the Delegate platform (CORE), so a CORE outage cannot break checkout.

## Direct-Medusa override (client build vars, optional)

By default the storefront reaches OmniCart through the same-origin Worker proxy (above). To instead connect the browser **directly** to a merchant's own Medusa (self-hosted or Medusa Cloud) — e.g. a backend they already linked with DelegateCore/DelegateBuild — set these **client build** variables (both are browser-safe by Medusa's design):

* **VITE_OMNICART_BACKEND_URL** - ABSOLUTE Medusa backend URL. When set, the Medusa SDK connects straight to it (bypassing the Worker proxy). The backend must allow the storefront origin in its `store_cors`.
* **VITE_OMNICART_PUBLISHABLE_KEY** - the Medusa publishable key (scoped to a sales channel) for that backend.

Leave both unset to use the default same-origin proxy + `OMNICART_BACKEND_URL` (with the built-in demo fallback).

# Important Notes

* The route flow `/c/:code` (cart -> shipping -> payment on-page sections) -> `/upsell/:sessionId` (one offer per route) -> `/success` (receipt) is the core of this template. Build your storefront around these routes rather than replacing them or collapsing them back into a single page.
* The initial charge is **processor-agnostic** - add or swap a gateway by implementing a `CheckoutProcessorAdapter` (manifest entry + registry thunk), not by editing `CheckoutPage`.
* The upsell offers are driven by the Flow Builder graph, not hardcoded in `UpsellOfferPage`, and run regardless of the initial processor.
* Keep secrets server-side: only browser-safe values ever reach the client — the Stripe **publishable** key, OmniCart public config, and (in direct-Medusa override mode) the Medusa backend URL + **publishable** key. Processor secret keys and the upsell runtime token stay on the Worker.
* **Do not edit/add/remove worker bindings or touch `wrangler.jsonc`/`wrangler.toml`.** Build around what is provided.
