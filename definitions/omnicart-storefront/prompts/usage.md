# Usage Instructions

This template generates a complete **OmniCart Headless Storefront**. It connects directly to the OmniCart commerce backend using the client SDK, managing product discovery, variants, cart operations, customer profiles, and checkout entirely client-side.

> Developer note: OmniCart is the whitelabel commerce brand. It is implemented on top of **Medusa v2** using the official storefront SDK (`@medusajs/js-sdk`), which is already declared in `package.json` — do NOT run `bun add`/`npm install` for it. NEVER install `@medusajs/medusa-js`: that is the deprecated Medusa **v1** client, it is incompatible with this v2 storefront, and the version the build may guess does not exist (the install will fail). Keep all generated UI, copy, and component names branded as **OmniCart** - never expose "Medusa" to end users.

## THIS IS A WORKING PRODUCTION STOREFRONT — CHANGE FRONT-END UI ONLY

This template is a 1:1 deployment of a **live, production storefront**. The entire commerce engine is **already built, tested, and working** against the OmniCart (Medusa v2) backend, with credentials injected automatically from the connected workspace. When this app boots it already has a functional catalog, cart, checkout, and account — driven entirely by the API (categories, products, images, prices, currency, sales channels, shipping all come from the OmniCart admin server).

**Your ONLY job is the visual front-end: branding, layout, copy, imagery, and theme.** Do NOT rebuild, "fix", refactor, or re-implement any functionality — it already works.

**NEVER touch (locked, fully functional — editing is blocked and will be discarded):**
- `src/lib/`, `src/hooks/`, `src/context/`, `src/services/`, `src/integrations/`, `src/types/` — all data, state, and API logic
- `worker/` — the same-origin proxy and server config
- The commerce pages/components: `ProductDetail.tsx`, `Cart.tsx`, `ExpressCheckout.tsx`, `CheckoutSuccess.tsx`, cart/checkout/product components
- `package.json`, `wrangler.jsonc`, `vite.config.ts`, `tailwind.config.js`, `tsconfig*`

**Do NOT** reimplement the cart, write new API/data-fetching code, swap the SDK, add data dependencies, or "wire up" the backend — all of that exists and runs. Assume every commerce feature works; if something looks empty in preview it is a data/credential matter, not a code bug to "fix".

**You MAY edit (the presentation surface):**
- `src/pages/Index.tsx` (homepage) and new marketing/landing pages
- Layout/branding components (header, footer, hero, banners, navigation **styling**)
- `src/index.css` — **rebrand by changing the existing CSS variables** here (`--primary`, `--vnsh-red`, `--vnsh-green`, `--vnsh-dark`, fonts). This is how you recolor the whole site; do NOT invent new Tailwind color tokens.
- Copy, images, and logo assets under `public/`

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
Browser requests always go to the **same-origin Worker proxy** at `/api/omnicart`, which forwards them server-side to the real OmniCart backend and injects the publishable key. This is mandatory: the OmniCart backend does not send CORS headers, so calling it directly from the browser (an absolute cross-origin URL) is blocked by the browser. **Do not** set the browser backend URL to an absolute URL like `https://...` and do not call the backend host directly from client code — `src/lib/omnicart-config.ts` already collapses any cross-origin value back to `/api/omnicart`.

The OmniCart connection variables are consumed **server-side** by the Worker proxy (`worker/userRoutes.ts`), not in the browser:
- `OMNICART_BACKEND_URL` — Base URL of the OmniCart commerce server (Worker binding/secret; server-side only).
- `OMNICART_PUBLISHABLE_KEY` — Publishable API key the proxy attaches to upstream requests (server-side only).

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

## Rebranding Must Keep the App Buildable

A single broken file fails `vite build`, and the whole preview then returns a blank 500 — not just the page you changed. To rebrand safely:
- **Prefer tokens over rewrites.** Rebrand by editing the CSS design tokens in `src/index.css` (the `:root` variables like `--primary`, `--vnsh-red`, `--vnsh-green`, fonts) and swapping logo/image assets. `tailwind.config.js` is LOCKED and only maps those variables (`hsl(var(--primary))`) — you do not edit it; change the variable values in `src/index.css` instead. This restyles the entire storefront without touching component logic, so it can't break the build.
- **Define a custom color BEFORE you use its class.** A custom color used in any `bg-*`/`text-*`/`border-*`/`ring-*` class — especially inside an `@apply` in `src/index.css` — only exists if you first add it to `theme.extend.colors` in `tailwind.config.js`. `@apply bg-vanguard-obsidian/80` fails the CSS build with "The `bg-vanguard-obsidian/80` class does not exist" unless `vanguard-obsidian` is defined there. When in doubt, use an arbitrary value (`bg-[#0b0b0f]/80`) or a raw CSS property instead of inventing a token.
- **Every file you output must be complete and compile.** Resolve all imports, never reference a component, hook, or export that does not exist, and keep all existing imports a file still uses. Do not leave half-written files.
- **Do not add new dependencies.** Use only packages already in `package.json`. A missing dependency breaks the build at deploy.
- **NEVER `@apply` (or use in `className`) a custom color you have not defined.** A `@apply` of an unknown utility — e.g. `@apply bg-vanguard-obsidian/80` — is a HARD Tailwind error that fails the entire CSS build and blanks the preview. If you want a custom brand color, FIRST add it under `theme.extend.colors` in `tailwind.config.js`, THEN reference it. Otherwise use only the standard Tailwind palette (`bg-slate-900`, `text-zinc-100`, …) or the tokens already defined in this template (`bg-vnsh-red`, `text-foreground`, `bg-primary`, …). A build-time guard drops unresolved custom-color `@apply` utilities so a slip degrades instead of bricking the build — but do not rely on it; define the color.
- **When editing an existing component** (e.g. `Navbar.tsx`, `Footer.tsx`), change copy/classes/colors in place and keep its imports and exports intact — do not introduce references to things you have not created.

## Imports, Exports, and Provider Wiring (Do Not Break)

These conventions keep the app booting. Violating them is the most common cause of a blank screen or a runtime `does not provide an export named ...` / `must be used within a Provider` crash.

- **Do not change the provider nesting in `src/App.tsx`.** The context providers (`RegionProvider`, `CartProvider`, `CartSummaryProvider`, `CustomerProvider`, `WishlistProvider`, etc.) are intentionally ordered so child providers can read their parents. Add routes and pages inside the existing tree; never reorder, remove, or hoist a provider out of it.
- **Do not change a component's export style.** Existing components export **both** a default and a matching named export, so either `import Foo from "@/components/Foo"` or `import { Foo } from "@/components/Foo"` works. When you create a new component, follow the same convention: `export default Foo;` **and** `export { Foo };`. Do not convert a default export to named-only (or vice versa) on an existing file.
- **Use the context hooks (`useCart`, `useCustomer`, `useRegion`, `useWishlist`, `useCartSummary`) only via their exported hook** — never read the raw context. They return safe defaults outside a provider, so do not add your own `throw` guards.
- **Do not `bun add` / `npm install` commerce SDKs.** `@medusajs/js-sdk`, Stripe, Supabase, and React Query are already declared. Never install `@medusajs/medusa-js` (deprecated v1 — incompatible and the guessed version does not exist).
