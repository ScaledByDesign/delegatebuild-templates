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

    // Check if the platform's Flow Builder upsell runtime is set (indicating the platform is our backend)
    const { base: runtimeUrl, token: runtimeToken } = upsellRuntime(c);
    const upstreamPath = c.req.path.replace(
      new RegExp(`^/api/checkout/${kind}`),
      '',
    );

    if (runtimeUrl) {
      let clientBody: any = {};
      if (c.req.method === 'POST') {
        try {
          clientBody = await c.req.json();
        } catch {
          // Empty body
        }
      }

      const checkoutCode = clientBody.metadata?.checkoutCode || "demo";
      const headers = new Headers();
      headers.set('content-type', 'application/json');
      headers.set('accept', 'application/json');
      if (runtimeToken) {
        headers.set('authorization', `Bearer ${runtimeToken}`);
      }

      if (upstreamPath === '/init-payment') {
        const initBody = {
          token: checkoutCode,
          provider: kind,
          customer: {
            email: clientBody.email || "",
          },
          currency: clientBody.currency,
          totalOverride: clientBody.totalCents,
          lineItems: clientBody.lineItems,
          metadata: clientBody.metadata,
        };

        const target = `${runtimeUrl}/api/checkout/initialize`;
        try {
          const upstream = await fetch(target, {
            method: 'POST',
            headers,
            body: JSON.stringify(initBody),
          });

          if (!upstream.ok) {
            const errText = await upstream.text();
            return new Response(errText, { status: upstream.status, headers: { 'content-type': 'application/json' } });
          }

          const resJson = await upstream.json() as any;
          return c.json(resJson);
        } catch (err) {
          return c.json(
            { success: false, error: `Platform checkout initialization unreachable: ${err instanceof Error ? err.message : 'unknown'}` },
            502,
          );
        }
      } else if (upstreamPath === '/charge-initial') {
        const completeBody = {
          token: checkoutCode,
          orderId: clientBody.idempotencyKey,
          transactionId: clientBody.metadata?.paymentIntentId || clientBody.metadata?.paymentMethodId || clientBody.idempotencyKey,
          provider: kind,
          providerOrderId: clientBody.metadata?.paymentIntentId,
          customerEmail: clientBody.customer?.email,
          customerName: `${clientBody.customer?.first_name || ""} ${clientBody.customer?.last_name || ""}`.trim(),
          amount: clientBody.totalCents,
          currency: clientBody.currency,
          lineItems: clientBody.lineItems,
          metadata: clientBody.metadata,
          customer: {
            firstName: clientBody.customer?.first_name,
            lastName: clientBody.customer?.last_name,
            phone: clientBody.customer?.phone,
          },
        };

        const target = `${runtimeUrl}/api/checkout/complete`;
        try {
          const upstream = await fetch(target, {
            method: 'POST',
            headers,
            body: JSON.stringify(completeBody),
          });

          if (!upstream.ok) {
            const errText = await upstream.text();
            return new Response(errText, { status: upstream.status, headers: { 'content-type': 'application/json' } });
          }

          const resJson = await upstream.json() as any;

          if (resJson.status === "requires_action") {
            return c.json({
              status: "requires_action",
              clientSecret: resJson.clientSecret,
              returnUrl: resJson.returnUrl,
            });
          }

          if (resJson.status === "succeeded") {
            return c.json({
              status: "succeeded",
              processorOrderId: resJson.processorOrderId,
              order: resJson.order,
            });
          }

          return c.json(resJson);
        } catch (err) {
          return c.json(
            { success: false, error: `Platform checkout complete unreachable: ${err instanceof Error ? err.message : 'unknown'}` },
            502,
          );
        }
      }
    }

    // Fallback: proxy to independent processor backend (original behavior)
    const backend = processorBackend(env, kind);
    if (!backend) {
      // No backend wired for this processor -> demo mode.
      return c.json(
        { success: false, error: `${kind} backend not configured`, demo: true },
        503,
      );
    }

    const url = new URL(c.req.url);
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
  app.get('/api/omnicart-config', async (c) => {
    const env = c.env as OmniCartEnv & { STRIPE_PUBLISHABLE_KEY?: string };
    const code = c.req.query('code') || 'demo';

    const { base: runtimeUrl, token: runtimeToken } = upsellRuntime(c);
    const backendConfigured = Boolean(env.OMNICART_BACKEND_URL && env.OMNICART_UPSELL_RUNTIME_URL);

    const defaultTheme = {
      logoUrl: '',
      primaryColor: '#2563eb',
      accentColor: '#16a34a',
      fontFamily: 'Inter, sans-serif',
      supportEmail: 'support@example.com',
      statementName: 'MERCHANT',
    };

    let theme = defaultTheme;
    let config: any = null;

    if (backendConfigured && runtimeUrl && code !== 'demo') {
      try {
        const headers = new Headers();
        headers.set('accept', 'application/json');
        if (runtimeToken) {
          headers.set('authorization', `Bearer ${runtimeToken}`);
        }

        const response = await fetch(`${runtimeUrl}/api/checkout/config?token=${encodeURIComponent(code)}`, {
          headers,
        });

        if (response.ok) {
          const resBody = await response.json() as any;
          if (resBody.success && resBody.theme) {
            theme = {
              logoUrl: resBody.theme.logoUrl || defaultTheme.logoUrl,
              primaryColor: resBody.theme.primaryColor || defaultTheme.primaryColor,
              accentColor: resBody.theme.accentColor || defaultTheme.accentColor,
              fontFamily: resBody.theme.fontFamily || defaultTheme.fontFamily,
              supportEmail: resBody.theme.supportEmail || defaultTheme.supportEmail,
              statementName: resBody.theme.statementName || defaultTheme.statementName,
            };
          }
          if (resBody.success && resBody.config) {
            config = resBody.config;
          }
        }
      } catch (err) {
        console.error("Failed to fetch checkout theme", err);
      }
    }

    return c.json({
      success: true,
      data: {
        stripePublishableKey: env.STRIPE_PUBLISHABLE_KEY || '',
        // The client uses this flag to decide whether to drive the real Flow
        // Builder runtime or fall back to the in-browser demo flow.
        backendConfigured,
        theme,
        config,
      },
    });
  });
}
