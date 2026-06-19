# Template Selection Guidelines

This template is a customer-facing **OmniCart storefront** — a Next.js (Pages Router) shopfront that renders a product catalog and product detail pages from a headless OmniCart commerce engine over its Store API.

* Use this template when you need:
  * A branded ecommerce storefront on top of a headless commerce backend
  * A product catalog grid plus product detail pages, server-rendered for SEO
  * A starting point for cart, checkout, and account pages on an OmniCart backend
  * Server-side data fetching against a commerce Store API with a publishable key
  * A responsive, accessible shopping experience with shadcn/ui components

* Do not use it for:
  * Generic landing pages or marketing sites with no commerce backend
  * Apps that do not talk to an OmniCart / headless commerce engine
  * Purely static, content-only sites

* Built with:
  * **Next.js (Pages Router)** for server-rendered, SEO-friendly product pages
  * **OmniCart Store API** integration (publishable-key header wired in)
  * **Tailwind CSS** + **shadcn/ui** for accessible, responsive UI
  * **Lucide Icons** for consistent iconography
  * **TypeScript** and **ESLint** for type safety and code quality

* Configuration:
  * `NEXT_PUBLIC_OMNICART_BACKEND_URL` — base URL of the OmniCart engine
  * `NEXT_PUBLIC_OMNICART_PUBLISHABLE_KEY` — storefront publishable key
