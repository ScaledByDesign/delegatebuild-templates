import { Hono } from "hono";
import { Env } from './core-utils';

/**
 * OmniCart Express Checkout — Worker API routes.
 *
 * OmniCart is the whitelabel commerce brand; it is powered internally by the
 * Medusa commerce framework. These routes:
 *   1. Proxy the OmniCart storefront API (`/api/omnicart/*`) to the configured
 *      OmniCart (Medusa) backend, injecting the publishable key server-side.
 *   2. Proxy the OmniCart **Flow Builder** upsell runtime (`/api/upsell/*`) to
 *      the configured runtime, keeping the service token server-side. This is
 *      what drives the post-purchase multi-offer upsell sequence.
 *   3. Expose a thin Stripe helper used by the payment step.
 *
 * DO NOT MODIFY CORS OR OVERRIDE ERROR HANDLERS.
 */

// OmniCart deployment vars (configured in wrangler.jsonc / dashboard).
interface OmniCartEnv extends Env {
  OMNICART_BACKEND_URL?: string;
  OMNICART_PUBLISHABLE_KEY?: string;
  // Flow Builder upsell runtime (Delegate). Base URL + service token for the
  // session-init + click endpoints. The runtime is the authority for pricing
  // and graph-walking; the storefront only renders nodes + reports outcomes.
  OMNICART_UPSELL_RUNTIME_URL?: string;
  OMNICART_UPSELL_RUNTIME_TOKEN?: string;
}

export function userRoutes(app: Hono<{ Bindings: Env }>) {
  // Health/demo route kept from the reference template.
  app.get('/api/test', (c) => c.json({ success: true, data: { name: 'this works' } }));

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
