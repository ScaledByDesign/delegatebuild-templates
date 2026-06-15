import { Hono } from "hono";
import { Env } from './core-utils';

/**
 * OmniCart Express Checkout — Worker API routes.
 *
 * OmniCart is the whitelabel commerce brand; it is powered internally by the
 * Medusa commerce framework. These routes:
 *   1. Proxy the OmniCart storefront API (`/api/omnicart/*`) to the configured
 *      OmniCart (Medusa) backend, injecting the publishable key server-side.
 *   2. Expose a thin Stripe helper used by the payment step.
 *
 * DO NOT MODIFY CORS OR OVERRIDE ERROR HANDLERS.
 */

// OmniCart deployment vars (configured in wrangler.jsonc / dashboard).
interface OmniCartEnv extends Env {
  OMNICART_BACKEND_URL?: string;
  OMNICART_PUBLISHABLE_KEY?: string;
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

  // --- OmniCart config (publishable Stripe key for the browser) -------------
  // Returns only public, browser-safe config for initializing Stripe Elements.
  app.get('/api/omnicart-config', (c) => {
    const env = c.env as OmniCartEnv & { STRIPE_PUBLISHABLE_KEY?: string };
    return c.json({
      success: true,
      data: {
        stripePublishableKey: env.STRIPE_PUBLISHABLE_KEY || '',
        backendConfigured: Boolean(env.OMNICART_BACKEND_URL),
      },
    });
  });
}
