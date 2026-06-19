# Usage instructions

This is the **OmniCart storefront** — a Next.js (Pages Router) shopfront for the OmniCart headless commerce engine. The catalog lives at `src/pages/index.tsx` and product detail pages at `src/pages/products/[handle].tsx`. Pages auto-update as you edit.

## Connecting to OmniCart

The storefront reads two public environment variables:

* `NEXT_PUBLIC_OMNICART_BACKEND_URL` — base URL of your OmniCart commerce engine (e.g. `http://localhost:9000`)
* `NEXT_PUBLIC_OMNICART_PUBLISHABLE_KEY` — the storefront publishable key

Set them in `wrangler.jsonc` (`vars`) for deployment, or in a `.env.local` file for local development:

```bash
NEXT_PUBLIC_OMNICART_BACKEND_URL=http://localhost:9000
NEXT_PUBLIC_OMNICART_PUBLISHABLE_KEY=pk_your_key_here
```

When unset, the storefront renders a friendly "not configured" notice instead of crashing.

## Talking to the Store API

All commerce data flows through `src/lib/omnicart.ts`. Every request to a `/store/*` endpoint **must** include the publishable key in the `x-publishable-api-key` header — the engine rejects calls without it. `src/lib/omnicart.ts` already wires this header into every request, so use its helpers rather than calling `fetch` directly:

* `listProducts(limit)` — `GET {backend}/store/products?limit=...` for the catalog grid
* `getProductByHandle(handle)` — a single product for the detail page
* `formatProductPrice(product)` — a display price string from the first variant

To add cart, checkout, or account pages, call the corresponding OmniCart Store API endpoints (`/store/carts`, `/store/orders`, etc.) through the same header-aware fetch pattern.

## Branding

The product is named **OmniCart** in all user-facing copy. The word "Medusa" is the internal engine only and must never appear in UI strings.

## Conventions

* Built with Next.js (Pages Router) — use the Pages router, not the App router.
* Next.js cannot infer props for React components, so always provide default props.
* When customizing `tailwind.config.js`, hardcode custom colors directly in the config; do not define them in `globals.css` unless specified.
* Generate fully responsive, accessible layouts using Tailwind's spacing, layout, and typography utilities.

## Components

All shadcn/ui components live in `src/components/ui/...` and can be imported directly, e.g. `import { Button } from "@/components/ui/button";`. Prefer these over writing custom components, and do not rewrite them. Icons come from `lucide-react`.

## API routes

The `src/pages/api` directory is mapped to `/api/*`. `src/pages/api/client-errors.ts` receives frontend error reports.
