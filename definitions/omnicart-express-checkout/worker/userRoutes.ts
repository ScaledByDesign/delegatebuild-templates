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

  app.post('/api/upsell/session', async (c) => {
    const env = c.env as OmniCartEnv;
    const { base, token } = upsellRuntime(c);
    if (!base) {
      return c.json({ success: false, error: 'Upsell runtime not configured' }, 503);
    }

    // Parse incoming camelCase body
    let clientBody: any = {};
    try {
      clientBody = await c.req.json();
    } catch {
      // Empty body
    }

    // Map to platform's snake_case parameters
    const platformBody = {
      order_id: clientBody.orderId,
      original_order_total: clientBody.originalOrderTotal,
      flow_id: clientBody.flowId,
      currency_code: clientBody.currencyCode,
    };

    const target = `${base}/api/flow-builder/init`;
    const headers = new Headers(c.req.raw.headers);
    headers.delete('host');
    headers.set('content-type', 'application/json');
    headers.set('accept', 'application/json');
    if (token) headers.set('authorization', `Bearer ${token}`);

    try {
      const upstream = await fetch(target, {
        method: 'POST',
        headers,
        body: JSON.stringify(platformBody),
      });

      if (!upstream.ok) {
        const errText = await upstream.text();
        return new Response(errText, { status: upstream.status, headers: { 'content-type': 'application/json' } });
      }

      const platformJson = await upstream.json() as { session: any; entry_button: any };
      const session = platformJson.session;
      const entry_button = platformJson.entry_button;

      // Helper to read journey steps
      const readJourneySteps = (journey: any): any[] => {
        if (!journey || typeof journey !== "object" || Array.isArray(journey)) {
          return [];
        }
        const steps = journey.steps;
        if (!Array.isArray(steps)) return [];
        return steps;
      };

      // Map session to FlowSession
      const flowSession = session ? {
        id: session.id,
        flow_id: session.flowId,
        status: session.status,
        current_button_id: session.currentButtonId,
        journey: readJourneySteps(session.journey).map((s: any) => ({
          button_id: s.buttonId,
          button_text: s.buttonText,
          action: s.action,
          revenue: s.revenue,
          timestamp: s.timestamp,
        })),
        total_revenue: session.totalRevenueCents ?? 0,
        upsell_total: session.upsellTotalCents ?? 0,
        currency_code: session.currencyCode || "USD",
        version: session.version ?? 1,
      } : null;

      // Map button to FlowNode
      let flowNode = null;
      if (entry_button) {
        const meta = (entry_button.metadata ?? {}) as Record<string, unknown>;
        const pitch = typeof meta.description === "string" ? meta.description : (typeof meta.subheadline === "string" ? meta.subheadline : null);
        const compare_at_price = typeof meta.compareAtPrice === "number" ? meta.compareAtPrice : null;
        const decline_text = typeof meta.declineText === "string" ? meta.declineText : null;
        const accept_options = Array.isArray(entry_button.acceptOptions)
          ? entry_button.acceptOptions.map((v: any) => ({
              id: v.id,
              label: v.label || "",
              price: v.price,
              compareAtPrice: v.compareAtPrice ?? null,
              ctaText: v.ctaText ?? null,
            }))
          : null;

        flowNode = {
          id: entry_button.id,
          label: typeof meta.headline === "string" && meta.headline ? meta.headline : entry_button.label,
          button_text: entry_button.buttonText,
          pitch,
          display_price: entry_button.displayPrice ?? null,
          currency_code: entry_button.currencyCode || "USD",
          compare_at_price,
          accept_options,
          decline_text,
          success_next_button_id: entry_button.successNextButtonId ?? null,
          decline_next_button_id: entry_button.declineNextButtonId ?? null,
          is_terminal_success: entry_button.isTerminalSuccess ?? false,
          is_terminal_decline: entry_button.isTerminalDecline ?? false,
          timer: entry_button.timer ?? null,
          external_page_url: entry_button.externalPageUrl ?? null,
        };
      }

      return c.json({
        success: true,
        data: {
          session: flowSession,
          entry_node: flowNode,
        }
      });
    } catch (err) {
      return c.json({
        success: false,
        error: `Upsell runtime unreachable: ${err instanceof Error ? err.message : 'unknown'}`
      }, 502);
    }
  });

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
