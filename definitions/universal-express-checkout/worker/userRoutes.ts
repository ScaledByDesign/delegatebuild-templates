import { Hono } from "hono";
import { Env } from './core-utils';

/**
 * Universal Express Checkout - Worker API routes.
 *
 * One storefront, any payment processor. These routes:
 *   1. Proxy the UNIVERSAL checkout API (`/api/checkout/:kind/*`) to whichever
 *      processor backend is configured (Stripe, OmniCart, Konnektive, Sticky.io),
 *      keying each backend on the processor kind and keeping every credential
 *      server-side. When a processor has no backend configured, the route
 *      short-circuits with `503 { demo: true }` so that processor's adapter
 *      falls back to demo mode.
 *   2. Proxy the OmniCart storefront API (`/api/omnicart/*`) - the retained
 *      Medusa v2 cart lifecycle the OmniCart adapter composes - injecting the
 *      publishable key server-side.
 *   3. Proxy the Flow Builder upsell runtime (`/api/upsell/*`), keeping the
 *      service token server-side. The upsell runs uniformly for every processor.
 *   4. Expose a thin Stripe helper used by the payment step.
 *
 * DO NOT MODIFY CORS OR OVERRIDE ERROR HANDLERS.
 */

// Deployment vars (configured in wrangler.jsonc / dashboard).
interface OmniCartEnv extends Env {
  // OmniCart (Medusa) - retained cart lifecycle + the OmniCart processor.
  OMNICART_BACKEND_URL?: string;
  OMNICART_PUBLISHABLE_KEY?: string;
  // Per-processor backends for the universal /api/checkout/:kind proxy. Each is
  // the base URL of a small server that owns that processor's credentials and
  // implements `init-payment` (payment-class) + `charge-initial`. Leave unset to
  // keep that processor in demo mode.
  STRIPE_CHECKOUT_BACKEND_URL?: string;
  KONNEKTIVE_CHECKOUT_BACKEND_URL?: string;
  STICKYIO_CHECKOUT_BACKEND_URL?: string;
  // Flow Builder upsell runtime (Delegate). Base URL + service token for the
  // session-init + click endpoints. The runtime is the authority for pricing
  // and graph-walking; the storefront only renders nodes + reports outcomes.
  OMNICART_UPSELL_RUNTIME_URL?: string;
  OMNICART_UPSELL_RUNTIME_TOKEN?: string;
}

/**
 * Map a processor kind to its configured backend base URL (or undefined when
 * unconfigured). OmniCart routes through the existing `/api/omnicart/*` Medusa
 * proxy rather than a standalone checkout backend, so it resolves against
 * `OMNICART_BACKEND_URL`.
 */
function processorBackend(
  env: OmniCartEnv,
  kind: string,
): string | undefined {
  switch (kind) {
    case "stripe":
      return env.STRIPE_CHECKOUT_BACKEND_URL;
    case "omnicart":
      return env.OMNICART_BACKEND_URL;
    case "konnektive":
      return env.KONNEKTIVE_CHECKOUT_BACKEND_URL;
    case "stickyio":
      return env.STICKYIO_CHECKOUT_BACKEND_URL;
    default:
      return undefined;
  }
}

const KNOWN_PROCESSOR_KINDS = new Set([
  "stripe",
  "omnicart",
  "konnektive",
  "stickyio",
]);

export function userRoutes(app: Hono<{ Bindings: Env }>) {
  // Health/demo route kept from the reference template.
  app.get('/api/test', (c) => c.json({ success: true, data: { name: 'this works' } }));

  // --- Universal checkout proxy (/api/checkout/:kind/*) ----------------------
  // The single entry point every adapter uses. The path's first segment is the
  // processor kind; the rest is forwarded to that processor's backend:
  //   POST /api/checkout/stripe/init-payment        (payment-class, FIRST call)
  //   POST /api/checkout/stripe/charge-initial      (payment-class, SECOND call)
  //   POST /api/checkout/konnektive/charge-initial  (CRM-class, single call)
  //   POST /api/checkout/stickyio/charge-initial    (CRM-class, single call)
  // (OmniCart's adapter composes the existing /api/omnicart/* Medusa lifecycle
  // instead of this path, so it rarely hits here - but it resolves correctly if
  // it does.) When the processor has no backend configured, return the
  // `503 { demo: true }` signal so the adapter falls back to demo mode. The
  // backend owns ALL processor credentials; none ship to the browser.
  app.all('/api/checkout/:kind/*', async (c) => {
    const env = c.env as OmniCartEnv;
    const kind = c.req.param('kind');

    if (!KNOWN_PROCESSOR_KINDS.has(kind)) {
      return c.json({ success: false, error: `Unknown processor: ${kind}` }, 404);
    }

    const backend = processorBackend(env, kind);
    if (!backend) {
      // No backend wired for this processor -> demo mode.
      return c.json(
        { success: false, error: `${kind} backend not configured`, demo: true },
        503,
      );
    }

    const url = new URL(c.req.url);
    const upstreamPath = c.req.path.replace(
      new RegExp(`^/api/checkout/${kind}`),
      '',
    );
    const target = `${backend.replace(/\/$/, '')}/checkout${upstreamPath}${url.search}`;

    const headers = new Headers(c.req.raw.headers);
    headers.delete('host');
    headers.set('accept', 'application/json');
    if (kind === 'omnicart' && env.OMNICART_PUBLISHABLE_KEY) {
      headers.set('x-publishable-api-key', env.OMNICART_PUBLISHABLE_KEY);
    }

    const init: RequestInit = {
      method: c.req.method,
      headers,
      body: ['GET', 'HEAD'].includes(c.req.method) ? undefined : c.req.raw.body,
    };

    try {
      const upstream = await fetch(target, init);
      const resBody = await upstream.arrayBuffer();
      return new Response(resBody, {
        status: upstream.status,
        headers: {
          'content-type': upstream.headers.get('content-type') || 'application/json',
        },
      });
    } catch (err) {
      return c.json(
        {
          success: false,
          error: `${kind} backend unreachable: ${err instanceof Error ? err.message : 'unknown'}`,
        },
        502,
      );
    }
  });

  // --- OmniCart demo-mode guard ---------------------------------------------
  // When no OmniCart backend is configured, short-circuit the ENTIRE storefront
  // surface with a clear `503 { demo: true }` signal instead of forwarding to
  // the placeholder demo host. This covers the full Medusa v2 cart lifecycle
  // used by the express checkout:
  //   POST   /api/omnicart/carts                                  (create cart)
  //   GET    /api/omnicart/carts/:id                              (retrieve)
  //   POST   /api/omnicart/carts/:id                              (email/address)
  //   POST   /api/omnicart/carts/:id/line-items                   (add item)
  //   POST   /api/omnicart/carts/:id/line-items/:line_id          (update qty)
  //   DELETE /api/omnicart/carts/:id/line-items/:line_id          (remove item)
  //   GET    /api/omnicart/shipping-options?cart_id=:id           (list options)
  //   POST   /api/omnicart/carts/:id/shipping-methods             (set method)
  //   GET    /api/omnicart/payment-providers?region_id=:rid       (list providers)
  //   POST   /api/omnicart/payment-collections                    (create pc)
  //   POST   /api/omnicart/payment-collections/:id/payment-sessions (init session)
  //   POST   /api/omnicart/carts/:id/complete                     (place order)
  //   POST | DELETE /api/omnicart/carts/:id/promotions            (coupon codes)
  // Each OmniCart client decodes this `503 { demo: true }` and falls back to
  // its in-template demo behavior, so the checkout works out of the box.
  // Refs: docs.medusajs.com/resources/storefront-development/guides/express-checkout
  //       docs.medusajs.com/resources/storefront-development/cart/manage-promotions
  app.all('/api/omnicart/*', async (c, next) => {
    const env = c.env as OmniCartEnv;
    if (!env.OMNICART_BACKEND_URL) {
      return c.json(
        { success: false, error: 'OmniCart backend not configured', demo: true },
        503,
      );
    }
    return next();
  });

  // --- OmniCart storefront proxy --------------------------------------------
  // Forwards any /api/omnicart/* request to the OmniCart (Medusa) backend.
  // The publishable key is attached here so it never ships to the browser.
  app.all('/api/omnicart/*', async (c) => {
    const env = c.env as OmniCartEnv;
    const backend = env.OMNICART_BACKEND_URL || 'https://demo.omnicart.commerce';
    const upstreamPath = c.req.path.replace(/^\/api\/omnicart/, '');
    const url = new URL(c.req.url);
    const target = `${backend.replace(/\/$/, '')}/store${upstreamPath}${url.search}`;

    const headers = new Headers(c.req.raw.headers);
    headers.delete('host');
    if (env.OMNICART_PUBLISHABLE_KEY) {
      headers.set('x-publishable-api-key', env.OMNICART_PUBLISHABLE_KEY);
    }

    const init: RequestInit = {
      method: c.req.method,
      headers,
      body: ['GET', 'HEAD'].includes(c.req.method) ? undefined : c.req.raw.body,
    };

    try {
      const upstream = await fetch(target, init);
      const resBody = await upstream.arrayBuffer();
      return new Response(resBody, {
        status: upstream.status,
        headers: { 'content-type': upstream.headers.get('content-type') || 'application/json' },
      });
    } catch (err) {
      return c.json(
        { success: false, error: `OmniCart backend unreachable: ${err instanceof Error ? err.message : 'unknown'}` },
        502,
      );
    }
  });

  // --- OmniCart Flow Builder upsell runtime ---------------------------------
  // POST /api/upsell/session  → initialize a post-purchase upsell session for a
  //                             paid order; returns { session, entry_node }.
  // GET  /api/upsell/click    → accept/decline the current node (1-click charge
  //                             on accept) + walk the flow graph; returns the
  //                             next node or a terminal result.
  // Both forward to the configured Flow Builder runtime with the service token
  // attached server-side. The runtime re-resolves all pricing (anti-tamper).
  const upsellRuntime = (c: { env: Env }) => {
    const env = c.env as OmniCartEnv;
    return {
      base: (env.OMNICART_UPSELL_RUNTIME_URL || '').replace(/\/$/, ''),
      token: env.OMNICART_UPSELL_RUNTIME_TOKEN || '',
    };
  };

  const forwardUpsell = async (
    c: { env: Env; req: { url: string; method: string; raw: Request } },
    upstreamPath: string,
  ): Promise<Response> => {
    const { base, token } = upsellRuntime(c);
    if (!base) {
      return new Response(
        JSON.stringify({ success: false, error: 'Upsell runtime not configured' }),
        { status: 503, headers: { 'content-type': 'application/json' } },
      );
    }
    const url = new URL(c.req.url);
    const target = `${base}${upstreamPath}${url.search}`;
    const headers = new Headers(c.req.raw.headers);
    headers.delete('host');
    headers.set('accept', 'application/json');
    if (token) headers.set('authorization', `Bearer ${token}`);
    const init: RequestInit = {
      method: c.req.method,
      headers,
      body: ['GET', 'HEAD'].includes(c.req.method) ? undefined : c.req.raw.body,
    };
    try {
      const upstream = await fetch(target, init);
      const resBody = await upstream.arrayBuffer();
      return new Response(resBody, {
        status: upstream.status,
        headers: { 'content-type': upstream.headers.get('content-type') || 'application/json' },
      });
    } catch (err) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Upsell runtime unreachable: ${err instanceof Error ? err.message : 'unknown'}`,
        }),
        { status: 502, headers: { 'content-type': 'application/json' } },
      );
    }
  };

  app.post('/api/upsell/session', (c) => forwardUpsell(c, '/api/upsell-flows/session'));
  app.get('/api/upsell/click', (c) => forwardUpsell(c, '/api/upsell/click'));

  // --- OmniCart config (publishable Stripe key for the browser) -------------
  // Returns only public, browser-safe config for initializing Stripe Elements.
  app.get('/api/omnicart-config', (c) => {
    const env = c.env as OmniCartEnv & { STRIPE_PUBLISHABLE_KEY?: string };
    return c.json({
      success: true,
      data: {
        stripePublishableKey: env.STRIPE_PUBLISHABLE_KEY || '',
        // The client uses this flag to decide whether to drive the real Flow
        // Builder runtime or fall back to the in-browser demo flow.
        backendConfigured: Boolean(env.OMNICART_BACKEND_URL && env.OMNICART_UPSELL_RUNTIME_URL),
      },
    });
  });
}
