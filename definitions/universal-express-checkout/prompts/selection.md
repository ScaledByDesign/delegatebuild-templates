# Template Selection Guidelines

This template provides a production-ready **Universal Express Checkout** storefront. The flow is split across THREE routes that mirror the upw-sendpaylinks headless checkout: **`/c/:code`** (the public checkout one-pager - cart review -> shipping -> payment on-page sections), **`/upsell/:sessionId`** (a **Flow Builder driven post-purchase upsell**, one one-click offer per route, with upsell/downsell branching), and **`/success`** (the itemized receipt). `/` redirects into `/c/:code` - there is no separate homepage/storefront landing. Unlike a single-gateway checkout, it is **processor-agnostic**: the initial charge runs through a pluggable `CheckoutProcessorAdapter` contract, with four real adapters shipped out of the box (Stripe, OmniCart, Konnektive, Sticky.io). The builder can target any of them - or switch between them at runtime - without changing the checkout UI.

> Internal note (developers only): OmniCart is the whitelabel commerce brand. It is powered under the hood by the **Medusa** commerce framework via the `@medusajs/medusa-js` SDK. All user-facing copy, components, and routes use **OmniCart** naming - "Medusa" is only an internal framework reference and must never surface in generated UI.

## Processor adapters

The checkout is driven by a small contract (`src/lib/checkout/types.ts`) that every processor implements. There are two adapter classes:

* **Payment-class** (`Stripe`, `OmniCart`) - tokenize/collect a payment method in the browser, then confirm the charge. These implement both `initPayment` (collect/confirm step) and `chargeInitial`.
* **CRM-class** (`Konnektive`, `Sticky.io`) - single server-side charge call with the order details. These implement `chargeInitial` only (the CRM owns the gateway + vaulting).

A manifest (`src/lib/checkout/manifest.ts`) declares each processor's `id`, `label`, and `class`, and a capabilities map (`src/lib/checkout/capabilities.ts`) declares what each adapter can do across three tiers: **publish** (always supported), **render** (UI-surfaced, e.g. wallets), and **runtimeFallback** (e.g. SCA/3DS). A registry (`src/lib/checkout/registry.ts`) lazily resolves the active adapter, and a `ProcessorPicker` component lets the user choose one.

* Use this template when you need:
  * An e-commerce checkout or "express checkout" flow (cart, shipping, payment on `/c/:code`, then `/upsell/:sessionId` offers, then `/success`)
  * A **payment-processor-agnostic** checkout that can target Stripe, OmniCart, Konnektive, or Sticky.io behind one UI (or let you add another processor by implementing one adapter)
  * A post-purchase **multi-offer upsell funnel** (one-click upsell -> downsell -> ...) driven by the OmniCart **Flow Builder**, charged to the same order regardless of the initial processor
  * Stripe-powered or CRM-gateway card payments with a polished, multi-step UI
  * A product/cart summary with line items, totals, shipping, tax and **coupon/promo codes**
  * An itemized **receipt / confirmation** breaking out subtotal, discounts, shipping, tax and total paid
  * A region/currency-aware storefront purchase experience

* Do not use it for:
  * Non-commerce applications with no cart or payment flow
  * AI chat/agent applications (use `vite-cfagents-runner`)
  * Apps needing Durable Objects for state (use `vite-cf-DO-runner` or `vite-cf-DO-v2-runner`)
  * Simple static marketing sites with no checkout

* Built with:
  * **Processor-agnostic adapter contract** (`src/lib/checkout/`) - `CheckoutProcessorAdapter` with `chargeInitial` (+ optional `initPayment`), discriminated-union results (`succeeded` / `requires_action` / `failed` / `demo`), a three-tier capabilities map, a processor manifest, and a lazy registry (`getCheckoutAdapter` / `listRegisteredKinds`)
  * **Four shipped adapters**: `stripe` and `omnicart` (payment-class), `konnektive` and `stickyio` (CRM-class), each declaring its capabilities and falling back to demo mode when its backend is unset
  * **OmniCart commerce client** (the storefront SDK, internally the Medusa framework) for cart, region, shipping and order operations, with the **full Medusa v2 cart lifecycle wired into the initial checkout** (`createCart` -> `addLineItem`/`updateLineItem`/`removeLineItem` -> `updateCartContact` -> `listShippingOptions`/`addShippingMethod` -> ...), each with a `503 { demo: true }` fallback
  * **Worker commerce proxy** at `/api/checkout/:kind/*` (per-processor charge backends), `/api/omnicart/*` (storefront) and `/api/upsell/*` (Flow Builder upsell runtime) that injects keys/tokens server-side and keeps secrets off the client
  * **OmniCart Flow Builder client** (`src/lib/upsell-flow.ts`) that walks the merchant's upsell graph node-by-node after payment, with an in-browser demo flow fallback
  * **Coupon / promo-code support** (`applyDiscount`/`removeDiscount` in `src/lib/omnicart.ts`) proxied to the OmniCart **promotions** API, with an in-template demo coupon table fallback
  * **Stripe** (`@stripe/stripe-js` + `@stripe/react-stripe-js`) for PCI-compliant card payments via Stripe Elements
  * **React + Vite** for fast, modern frontend development
  * **Tailwind CSS** + **Shadcn/UI** for a clean, responsive checkout interface
  * **TypeScript** for type safety across the adapter contract, cart, shipping and payment models
