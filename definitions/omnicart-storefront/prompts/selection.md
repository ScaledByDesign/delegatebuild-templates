# Template Selection Guidelines

Use this template to build a complete, multi-page headless storefront powered by the OmniCart API (Medusa v2). The storefront includes a full collection browser, individual product details, search, catalog navigation, shopping cart drawer/page, complete user account management (loyalty programs, wishlist, order history), a comprehensive multi-step checkout (`/checkout`), and a confirmation/receipt page.

> Internal note (developers only): OmniCart is the whitelabel commerce brand. It is powered under the hood by the **Medusa** commerce framework via the `@medusajs/js-sdk` SDK. All user-facing copy, components, and routes use **OmniCart** naming - "Medusa" is only an internal framework reference and must never surface in generated UI.

## When to Use

**Use this template when:**
- The user requests a full, multi-page e-commerce storefront or shop site (e.g. "Build a storefront", "Create an e-commerce shop", "Build a shopping website").
- You need deep product catalog browsing (categories, search, product detail pages).
- You need comprehensive customer account functionality (customer profiles, loyalty accounts, order tracking, returns, wishlists).
- You need a full checkout experience directly integrated with the storefront pages.

**Do NOT use this template when:**
- The user requests a single checkout link / express checkout page with post-purchase upsell steps (use `universal-express-checkout` instead).
- The application does not require product catalog or shopping cart workflows.
- Building general SaaS landing pages, presentation slides, or pure database applications.
