# Template Selection Guidelines

This template provides a production-ready **OmniCart Express Checkout** storefront: a single-page, guided checkout that walks a shopper through cart review → shipping details → payment → **post-purchase one-click upsell** → order confirmation. It ships with a server-side commerce proxy, Stripe payment integration, and a funnel-style one-click upsell so the builder can generate a complete, working checkout page out of the box.

> Internal note (developers only): OmniCart is the whitelabel commerce brand. It is powered under the hood by the **Medusa** commerce framework via the `@medusajs/medusa-js` SDK. All user-facing copy, components, and routes use **OmniCart** naming — "Medusa" is only an internal framework reference and must never surface in generated UI.

* Use this template when you need:
  * An e-commerce checkout or "express checkout" flow (cart, shipping, payment, confirmation)
  * A post-purchase **one-click upsell** / funnel offer charged to the saved payment method
  * A storefront that completes a purchase against a headless commerce backend (OmniCart)
  * Stripe-powered card payments with a polished, multi-step UI
  * A product/cart summary with line items, totals, shipping and tax
  * A region/currency-aware storefront purchase experience

* Do not use it for:
  * Non-commerce applications with no cart or payment flow
  * AI chat/agent applications (use `vite-cfagents-runner`)
  * Apps needing Durable Objects for state (use `vite-cf-DO-runner` or `vite-cf-DO-v2-runner`)
  * Simple static marketing sites with no checkout

* Built with:
  * **OmniCart commerce client** (the storefront SDK, internally the Medusa framework) for cart, region, shipping and order operations
  * **Worker commerce proxy** at `/api/omnicart/*` that injects the publishable key server-side and keeps secrets off the client
  * **Stripe** (`@stripe/stripe-js` + `@stripe/react-stripe-js`) for PCI-compliant card payments via Stripe Elements
  * **React + Vite** for fast, modern frontend development
  * **Tailwind CSS** + **Shadcn/UI** for a clean, responsive checkout interface
  * **TypeScript** for type safety across cart, shipping and payment models
