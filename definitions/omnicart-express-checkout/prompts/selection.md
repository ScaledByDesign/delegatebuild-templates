# Template Selection Guidelines

This template provides a production-ready **OmniCart Express Checkout** storefront: a single-page, guided checkout that walks a shopper through cart review → shipping details → payment → a **Flow Builder driven post-purchase upsell sequence** (multiple one-click offers, upsell/downsell branching) → order confirmation. It ships with a server-side commerce proxy, Stripe payment integration, and an OmniCart **Flow Builder** upsell runtime client so the builder can generate a complete, working checkout page — with a real multi-offer funnel — out of the box.

> Internal note (developers only): OmniCart is the whitelabel commerce brand. It is powered under the hood by the **Medusa** commerce framework via the `@medusajs/medusa-js` SDK. All user-facing copy, components, and routes use **OmniCart** naming — "Medusa" is only an internal framework reference and must never surface in generated UI.

* Use this template when you need:
  * An e-commerce checkout or "express checkout" flow (cart, shipping, payment, confirmation)
  * A post-purchase **multi-offer upsell funnel** (one-click upsell → downsell → ...) driven by the OmniCart **Flow Builder**, each offer charged to the saved payment method
  * A storefront that completes a purchase against a headless commerce backend (OmniCart)
  * Stripe-powered card payments with a polished, multi-step UI
  * A product/cart summary with line items, totals, shipping, tax and **coupon/promo codes**
  * An itemized **receipt / confirmation** breaking out subtotal, discounts, shipping, tax and total paid
  * A region/currency-aware storefront purchase experience

* Do not use it for:
  * Non-commerce applications with no cart or payment flow
  * AI chat/agent applications (use `vite-cfagents-runner`)
  * Apps needing Durable Objects for state (use `vite-cf-DO-runner` or `vite-cf-DO-v2-runner`)
  * Simple static marketing sites with no checkout

* Built with:
  * **OmniCart commerce client** (the storefront SDK, internally the Medusa framework) for cart, region, shipping and order operations, with the **full Medusa v2 cart lifecycle wired into the initial checkout** (`createCart` → `addLineItem`/`updateLineItem`/`removeLineItem` → `updateCartContact` → `listShippingOptions`/`addShippingMethod` → `createPaymentCollection`/`initPaymentSession` → `completeCart`), each with a `503 { demo: true }` fallback
  * **Worker commerce proxy** at `/api/omnicart/*` (storefront) and `/api/upsell/*` (Flow Builder upsell runtime) that injects keys/tokens server-side and keeps secrets off the client
  * **OmniCart Flow Builder client** (`src/lib/upsell-flow.ts`) that walks the merchant's upsell graph node-by-node after payment, with an in-browser demo flow fallback
  * **Coupon / promo-code support** (`applyDiscount`/`removeDiscount` in `src/lib/omnicart.ts`) proxied to the OmniCart **promotions** API (`POST`/`DELETE /api/omnicart/carts/:id/promotions`, body `{ promo_codes: [code] }`), with an in-template demo coupon table fallback
  * **Stripe** (`@stripe/stripe-js` + `@stripe/react-stripe-js`) for PCI-compliant card payments via Stripe Elements
  * **React + Vite** for fast, modern frontend development
  * **Tailwind CSS** + **Shadcn/UI** for a clean, responsive checkout interface
  * **TypeScript** for type safety across cart, shipping and payment models
