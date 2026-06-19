import { Hono } from "hono";
import { Env } from './core-utils';
import {
  FlowRuntime,
  ProviderRegistry,
  MemorySessionStore,
  type ProcessorKind,
  type SessionStore,
  type FlowExportNode,
  type RuntimeSession,
} from './flow-runtime';
import { resolveFlow, type FlowCacheEnv, type KVNamespace } from './flow-cache';
import { makeBackendChargeAdapter } from './charge-adapters';

/**
 * Universal Express Checkout - Worker API routes.
 *
 * One storefront, any payment processor. These routes:
 *   1. Proxy the UNIVERSAL checkout API (`/api/checkout/:kind/*`) DIRECTLY to
 *      whichever processor backend is configured (Stripe, OmniCart, Konnektive,
 *      Sticky.io), keying each backend on the processor kind and keeping every
 *      credential server-side. Payments NEVER route through the Delegate platform
 *      (CORE): each app talks straight to its processor backend, so a CORE outage
 *      can never take a merchant's checkout down (blast-radius isolation). When a
 *      processor has no backend configured, the route short-circuits with
 *      `503 { demo: true }` so that processor's adapter falls back to demo mode.
 *   2. Proxy the OmniCart storefront API (`/api/omnicart/*`) - the retained
 *      Medusa v2 cart lifecycle the OmniCart adapter composes - injecting the
 *      publishable key server-side.
 *   3. Proxy the Flow Builder upsell runtime (`/api/upsell/*`), keeping the
 *      service token server-side. The upsell is post-purchase and DEGRADABLE: if
 *      CORE is unreachable the storefront falls back to its baked flow snapshot,
 *      so the upsell never blocks the (already completed) checkout.
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
  // Flow Builder source-of-truth (Delegate core). Base URL + machine token are
  // used ONLY to fetch the SIGNED, read-only flow GRAPH export — never to run a
  // charge. The upsell runtime + 1-click charge execute LOCALLY in this worker
  // (deployer-owned), so a Delegate core outage can never break checkout/upsell.
  OMNICART_UPSELL_RUNTIME_URL?: string;
  OMNICART_UPSELL_RUNTIME_TOKEN?: string;
  // Tenant + signing for the deployer-owned upsell runtime.
  DELEGATE_WORKSPACE_ID?: string;
  FLOW_EXPORT_SIGNING_SECRET?: string;
  // Optional KV namespace for the durable pull-through flow cache.
  FLOW_CACHE?: KVNamespace;
  // Default flow to run when the client doesn't pass one.
  OMNICART_UPSELL_FLOW_ID?: string;
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

type ProxyCtx = {
  req: {
    url: string;
    method: string;
    raw: Request;
    header: (name: string) => string | undefined;
  };
};

// --- Browser-safe env exposure --------------------------------------------
// Mirrors omnicart-storefront's /api/public-env contract so the universal
// checkout resolves browser-safe connector values (publishable/public keys,
// public URLs, region/channel ids) DYNAMICALLY from whatever workspace
// connectors are bound to THIS deployment. Self-healing: new browser-safe vars
// flow through with no code change; secret/private/token/password keys are
// denied by name and NEVER returned.
const BROWSER_ENV_DENY = /(SECRET|PRIVATE|PASSWORD|SERVICE_ROLE|SECURITY|_TOKEN|ACCESS_TOKEN|API_KEY|CLIENT_SECRET|WEBHOOK_SECRET|ADMIN)/i;
const BROWSER_ENV_ALLOW = /(PUBLISHABLE_KEY|PUBLIC_KEY|ANON_KEY|_URL$|REGION_ID|SALES_CHANNEL_ID|INVENTORY_LOCATION_ID|COLLECTION_FALLBACK|MERCHANT_ID|ACCOUNT_ID|TEAM_ID|STORE_DOMAIN)/i;

/** True when an env var name is safe to expose to browser code. */
function isBrowserSafeEnvName(name: string): boolean {
  if (BROWSER_ENV_DENY.test(name)) return false;
  return BROWSER_ENV_ALLOW.test(name);
}

/**
 * Resolve the first non-empty value for any of the given logical env names,
 * normalizing across the common '' / VITE_ / NEXT_PUBLIC_ prefixes. Mirrors the
 * client-side resolver (src/lib/public-env.ts) so the worker and browser agree
 * on which connector name carries a value regardless of how the host injected
 * it. Lets a dedicated Stripe connector's STRIPE_PUBLISHABLE_KEY resolve even if
 * the host wrote it under a prefixed variant.
 */
function resolveEnvValue(env: Record<string, unknown>, ...keys: string[]): string {
  const prefixes = ['', 'VITE_', 'NEXT_PUBLIC_'];
  for (const key of keys) {
    const bare = key.replace(/^(VITE_|NEXT_PUBLIC_)/, '');
    for (const prefix of prefixes) {
      const v = env[prefix + bare];
      if (typeof v === 'string' && v) return v;
    }
    const exact = env[key];
    if (typeof exact === 'string' && exact) return exact;
  }
  return '';
}

/** Normalize a backend base URL: trim, ensure an https:// scheme, drop trailing slash. */
function normalizeBackend(raw: string | undefined): string {
  let backend = (raw || '').trim();
  if (backend && !/^https?:\/\//i.test(backend)) {
    backend = `https://${backend}`;
  }
  return backend.replace(/\/$/, '');
}

function proxyError(label: string, message: string, detail?: string, status = 502): Response {
  return new Response(
    JSON.stringify({ success: false, error: message, ...(detail ? { detail } : {}) }),
    { status, headers: { 'content-type': 'application/json' } },
  );
}

/**
 * Hardened reverse proxy. Validates + normalizes the target, guards against a
 * self-referential backend (which Cloudflare surfaces as an opaque "internal
 * error"), forwards only a minimal header allowlist (never the full inbound set,
 * which leaks client/cf-* headers and can break the upstream), passes set-cookie
 * through, and on failure surfaces the backend host while logging the full target
 * server-side. extraHeaders (e.g. the publishable key or a service token) are
 * applied last so they win over any inbound value.
 */
async function proxyTo(
  c: ProxyCtx,
  target: string,
  label: string,
  extraHeaders?: Record<string, string>,
): Promise<Response> {
  const reqUrl = new URL(c.req.url);
  let targetUrl: URL;
  try {
    targetUrl = new URL(target);
  } catch {
    console.error(`[${label}] invalid backend URL: "${target}"`);
    return proxyError(label, `${label} misconfigured: backend URL is not valid.`);
  }
  if (targetUrl.host === reqUrl.host) {
    console.error(`[${label}] backend loops back at app host "${reqUrl.host}"; fix the backend URL`);
    return proxyError(
      label,
      `${label} misconfigured: backend points back at this app (${reqUrl.host}). Set it to the processor backend URL.`,
    );
  }

  const headers = new Headers();
  headers.set('accept', 'application/json');
  const contentType = c.req.header('content-type');
  if (contentType) headers.set('content-type', contentType);
  const cookie = c.req.header('cookie');
  if (cookie) headers.set('cookie', cookie);
  const authorization = c.req.header('authorization');
  if (authorization) headers.set('authorization', authorization);
  for (const [k, v] of Object.entries(extraHeaders ?? {})) headers.set(k, v);

  const method = c.req.method;
  const init: RequestInit = {
    method,
    headers,
    body: ['GET', 'HEAD'].includes(method) ? undefined : c.req.raw.body,
  };

  try {
    const upstream = await fetch(targetUrl.toString(), init);
    const resBody = await upstream.arrayBuffer();
    const resHeaders = new Headers();
    resHeaders.set('content-type', upstream.headers.get('content-type') || 'application/json');
    const setCookie = upstream.headers.get('set-cookie');
    if (setCookie) resHeaders.append('set-cookie', setCookie);
    return new Response(resBody, { status: upstream.status, headers: resHeaders });
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'unknown';
    console.error(`[${label}] ${method} ${targetUrl.toString()} failed: ${detail}`);
    return proxyError(label, `${label} unreachable (${targetUrl.host})`, detail);
  }
}

// --- Wire mappers: runtime (camelCase) → storefront contract (snake_case) ---
// The local FlowRuntime exposes camelCase RuntimeSession / FlowExportNode; the
// storefront's flow-types.ts expects snake_case FlowSession / FlowNode. These
// map between them so the deployer-owned runtime is a drop-in for the old proxy.

const KNOWN_KINDS = new Set<ProcessorKind>([
  'stripe',
  'omnicart',
  'konnektive',
  'stickyio',
  'ultracart',
  'clickbank',
  'checkoutchamp',
]);

/** Coerce a client-supplied processor kind to a known kind (else null). */
function normalizeProcessorKind(raw?: string): ProcessorKind | null {
  if (!raw) return null;
  const v = raw.trim().toLowerCase() as ProcessorKind;
  return KNOWN_KINDS.has(v) ? v : null;
}

/** Read a string field off a node's opaque metadata bag. */
function metaStr(
  meta: Record<string, unknown> | null | undefined,
  ...keys: string[]
): string | null {
  if (!meta) return null;
  for (const k of keys) {
    const v = meta[k];
    if (typeof v === 'string' && v) return v;
  }
  return null;
}

/** Read a number field off a node's opaque metadata bag. */
function metaNum(
  meta: Record<string, unknown> | null | undefined,
  ...keys: string[]
): number | null {
  if (!meta) return null;
  for (const k of keys) {
    const v = meta[k];
    if (typeof v === 'number') return v;
  }
  return null;
}

/** Map a runtime session to the storefront's snake_case FlowSession. The
 *  currency is sourced from the flow graph (sessions don't carry one). */
function sessionToWire(s: RuntimeSession, currencyCode = 'USD') {
  return {
    id: s.id,
    flow_id: s.flowId,
    status: s.status,
    current_button_id: s.currentButtonId,
    journey: s.journey.map((j) => ({
      button_id: j.buttonId,
      button_text: j.buttonText,
      action: j.action,
      revenue: j.revenue,
      timestamp: j.timestamp,
    })),
    total_revenue: s.totalRevenueCents,
    upsell_total: s.upsellTotalCents,
    currency_code: currencyCode || 'USD',
    version: s.version,
  };
}

/** Map a runtime flow node to the storefront's snake_case FlowNode. */
function nodeToWire(node: FlowExportNode) {
  const meta = node.metadata ?? {};
  const accept_options =
    node.acceptOptions.length > 0
      ? node.acceptOptions.map((o) => ({
          id: o.id,
          label: o.label || '',
          price: typeof o.price === 'number' ? o.price : 0,
          compareAtPrice: o.compareAtPrice ?? null,
          ctaText: o.ctaText ?? null,
        }))
      : null;
  return {
    id: node.id,
    label: metaStr(meta, 'headline') || node.label,
    button_text: node.buttonText,
    pitch: metaStr(meta, 'description', 'subheadline'),
    display_price: node.displayPrice ?? null,
    currency_code: node.currencyCode || 'USD',
    compare_at_price: metaNum(meta, 'compareAtPrice'),
    accept_options,
    decline_text: metaStr(meta, 'declineText'),
    success_next_button_id: node.successNextButtonId ?? null,
    decline_next_button_id: node.declineNextButtonId ?? null,
    is_terminal_success: node.isTerminalSuccess,
    is_terminal_decline: node.isTerminalDecline,
    timer: node.timer ?? null,
    external_page_url: node.externalPageUrl ?? null,
  };
}

// --- Deployer-owned upsell runtime wiring ----------------------------------
// The worker runs the flow state machine LOCALLY. Sessions live in a process
// store; charges go through worker-owned adapters that call the deployer's
// processor backends (which hold the secrets). Delegate core is used ONLY as the
// signed graph source (pull-through cached). This removes core from the payment
// hot path entirely.

// Module-level session store — shared across requests in this isolate. For
// multi-isolate durability a KV/DO-backed SessionStore can be substituted; the
// graph walk + charge logic are identical either way.
const sessionStore: SessionStore = new MemorySessionStore();

/** Build the charge registry from whatever processor backends are configured. */
function buildRegistry(env: OmniCartEnv): ProviderRegistry {
  const resolveBackend = (kind: ProcessorKind): string | undefined =>
    processorBackend(env, kind);
  const registry = new ProviderRegistry();
  const kinds: ProcessorKind[] = [
    'stripe',
    'omnicart',
    'konnektive',
    'stickyio',
  ];
  for (const kind of kinds) {
    const extraHeaders =
      kind === 'omnicart' && env.OMNICART_PUBLISHABLE_KEY
        ? () => ({ 'x-publishable-api-key': env.OMNICART_PUBLISHABLE_KEY as string })
        : undefined;
    registry.register(makeBackendChargeAdapter(kind, resolveBackend, extraHeaders));
  }
  return registry;
}

/** Resolve the worker's own public origin (for internal /u redirects). */
function selfOrigin(c: ProxyCtx): string {
  try {
    return new URL(c.req.url).origin;
  } catch {
    return '';
  }
}

/**
 * Build a local FlowRuntime for a flow id using the pull-through cached signed
 * export. Throws when no flow is resolvable (caller degrades to demo).
 */
async function buildRuntime(
  c: ProxyCtx & { env: Env },
  flowId: string,
): Promise<{ runtime: FlowRuntime; source: string }> {
  const env = c.env as OmniCartEnv;
  const resolved = await resolveFlow(env as unknown as FlowCacheEnv, flowId);
  const secret =
    (env.FLOW_EXPORT_SIGNING_SECRET || env.OMNICART_UPSELL_RUNTIME_TOKEN || '').trim();
  const runtime = await FlowRuntime.fromSignedToken(resolved.token, secret, {
    store: sessionStore,
    registry: buildRegistry(env),
    selfOrigin: selfOrigin(c),
  });
  return { runtime, source: resolved.source };
}

export function userRoutes(app: Hono<{ Bindings: Env }>) {
  // Health/demo route kept from the reference template.
  app.get('/api/test', (c) => c.json({ success: true, data: { name: 'this works' } }));

  // --- Dynamic browser-safe env -------------------------------------------
  // Expose only the connector values that are safe to ship to the browser so
  // the frontend resolves credentials dynamically from whatever workspace
  // connectors are bound to THIS deployment (e.g. when a workspace is linked
  // AFTER the build and the values were never baked into import.meta.env).
  // Secret/private/token/password keys are never returned.
  app.get('/api/public-env', (c) => {
    const env = c.env as unknown as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(env)) {
      if (typeof value !== 'string' || value === '') continue;
      if (isBrowserSafeEnvName(key)) out[key] = value;
    }
    return c.json(out);
  });

  // --- Universal checkout proxy (/api/checkout/:kind/*) ----------------------
  // The single entry point every adapter uses. The path's first segment is the
  // processor kind; the rest is forwarded DIRECTLY to that processor's backend:
  //   POST /api/checkout/stripe/init-payment        (payment-class, FIRST call)
  //   POST /api/checkout/stripe/charge-initial      (payment-class, SECOND call)
  //   POST /api/checkout/konnektive/charge-initial  (CRM-class, single call)
  //   POST /api/checkout/stickyio/charge-initial    (CRM-class, single call)
  // (OmniCart's adapter composes the existing /api/omnicart/* Medusa lifecycle
  // instead of this path, so it rarely hits here - but it resolves correctly if
  // it does.) Payments are forwarded straight to the processor's own backend and
  // NEVER through the Delegate platform, so a platform outage cannot break a
  // merchant's checkout. When the processor has no backend configured, return the
  // `503 { demo: true }` signal so the adapter falls back to demo mode. The
  // backend owns ALL processor credentials; none ship to the browser.
  app.all('/api/checkout/:kind/*', async (c) => {
    const env = c.env as OmniCartEnv;
    const kind = c.req.param('kind');

    if (!KNOWN_PROCESSOR_KINDS.has(kind)) {
      return c.json({ success: false, error: `Unknown processor: ${kind}` }, 404);
    }

    const backend = normalizeBackend(processorBackend(env, kind));
    if (!backend) {
      // No backend wired for this processor -> demo mode.
      return c.json(
        { success: false, error: `${kind} backend not configured`, demo: true },
        503,
      );
    }

    const upstreamPath = c.req.path.replace(
      new RegExp(`^/api/checkout/${kind}`),
      '',
    );
    const url = new URL(c.req.url);
    const target = `${backend}/checkout${upstreamPath}${url.search}`;
    const extra = kind === 'omnicart' && env.OMNICART_PUBLISHABLE_KEY
      ? { 'x-publishable-api-key': env.OMNICART_PUBLISHABLE_KEY }
      : undefined;
    return proxyTo(c, target, `${kind} checkout`, extra);
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
    const backend = normalizeBackend(env.OMNICART_BACKEND_URL);
    if (!backend) {
      return c.json({ success: false, error: 'OmniCart backend not configured', demo: true }, 503);
    }
    const upstreamPath = c.req.path.replace(/^\/api\/omnicart/, '');
    const targetPath = upstreamPath.startsWith('/store') ? upstreamPath : `/store${upstreamPath}`;
    const url = new URL(c.req.url);
    const target = `${backend}${targetPath}${url.search}`;
    const extra = env.OMNICART_PUBLISHABLE_KEY
      ? { 'x-publishable-api-key': env.OMNICART_PUBLISHABLE_KEY }
      : undefined;
    return proxyTo(c, target, 'OmniCart', extra);
  });

  // --- Deployer-owned upsell runtime (/api/upsell/*) ------------------------
  // POST /api/upsell/session  → initialize a post-purchase upsell session for a
  //                             paid order; returns { session, entry_node }.
  // GET  /api/upsell/click    → accept/decline the current node (1-click charge
  //                             on accept) + walk the flow graph; returns the
  //                             next node or a terminal result.
  //
  // The flow state machine + 1-click charge run LOCALLY in this worker. Delegate
  // core is touched ONLY to pull the SIGNED, read-only flow GRAPH (pull-through
  // cached, signature-verified). Charges go through the deployer's processor
  // backends (which hold the secrets). A Delegate core outage can therefore
  // never break the post-purchase upsell — at worst the worker serves a slightly
  // stale cached graph, and if even that is unavailable it returns 503+demo so
  // the (already-completed) checkout degrades to the baked snapshot/demo flow.

  // Resolve the flow id the client asked for, else the deployment default.
  const resolveFlowId = (env: OmniCartEnv, bodyFlowId?: string): string =>
    (bodyFlowId || env.OMNICART_UPSELL_FLOW_ID || '').trim();

  app.post('/api/upsell/session', async (c) => {
    const env = c.env as OmniCartEnv;

    interface UpsellSessionRequest {
      orderId?: string;
      originalOrderTotal?: number;
      flowId?: string;
      currencyCode?: string;
      paymentMethodId?: string;
      paymentMethodToken?: string;
      paymentIntentId?: string;
      processorKind?: string;
    }
    let body: UpsellSessionRequest = {};
    try {
      body = (await c.req.json()) as UpsellSessionRequest;
    } catch {
      // Empty body — falls through to the default flow.
    }

    const flowId = resolveFlowId(env, body.flowId);
    if (!flowId) {
      // No flow wired for this deployment → client runs its baked snapshot/demo.
      return c.json(
        { success: false, error: 'No upsell flow configured', demo: true },
        503,
      );
    }

    try {
      const { runtime, source } = await buildRuntime(c, flowId);
      const paymentMethodToken =
        (body.paymentMethodToken || body.paymentMethodId || '').trim() || null;
      const processorKind = normalizeProcessorKind(body.processorKind);
      const { session, entryNode } = await runtime.initialize({
        orderId: body.orderId ?? null,
        originalOrderTotalCents: body.originalOrderTotal ?? 0,
        paymentMethodToken,
        processorKind,
      });
      const currency = entryNode.currencyCode || body.currencyCode || 'USD';
      return c.json(
        {
          success: true,
          data: {
            session: sessionToWire(session, currency),
            entry_node: nodeToWire(runtime.node(entryNode.id) ?? entryNode),
          },
        },
        200,
        { 'x-flow-source': source },
      );
    } catch (err) {
      // Core unreachable / signature invalid / no entry node → degrade. The
      // client falls back to its baked snapshot (or demo) on a non-success body.
      console.error(
        `[upsell/session] flow ${flowId} init failed:`,
        err instanceof Error ? err.message : err,
      );
      return c.json({ success: false, demo: true }, 503);
    }
  });

  // Accept/decline the current node. 1-click charge happens locally on accept.
  app.get('/api/upsell/click', async (c) => {
    const env = c.env as OmniCartEnv;
    const action = (c.req.query('action') || '').toLowerCase();
    const sessionId = c.req.query('sessionId') || '';
    const nodeId = c.req.query('nodeId') || c.req.query('buttonId') || '';
    const variantId = c.req.query('variantId') || undefined;
    const flowId = resolveFlowId(env, c.req.query('flowId') || undefined);

    if (action !== 'accept' && action !== 'decline') {
      return c.json({ success: false, error: 'action must be accept|decline' }, 400);
    }
    if (!sessionId || !nodeId) {
      return c.json({ success: false, error: 'sessionId and nodeId are required' }, 400);
    }
    if (!flowId) {
      return c.json({ success: false, error: 'No upsell flow configured', demo: true }, 503);
    }

    try {
      const { runtime, source } = await buildRuntime(c, flowId);
      const step =
        action === 'accept'
          ? await runtime.accept(sessionId, nodeId, { variantId })
          : await runtime.decline(sessionId, nodeId);

      // Re-read the session post-step so the client gets the authoritative
      // cursor + cumulative revenue (the engine's StepResult omits the session).
      const session = await sessionStore.get(sessionId);
      const nextNode = step.nextButtonId ? runtime.node(step.nextButtonId) : null;
      const actedNode = runtime.node(nodeId);
      const currency =
        nextNode?.currencyCode || actedNode?.currencyCode || 'USD';

      return c.json(
        {
          success: true,
          data: {
            session: session ? sessionToWire(session, currency) : null,
            next_node: nextNode ? nodeToWire(nextNode) : null,
            is_terminal: step.isTerminal,
            redirect: step.redirect ?? null,
            charge: step.charge
              ? {
                  transaction_id: step.charge.transactionId,
                  amount_charged: step.charge.amountCharged,
                  currency: step.charge.currency,
                }
              : null,
            payment_error: step.paymentError
              ? { code: step.paymentError.code, message: step.paymentError.message }
              : null,
          },
        },
        200,
        { 'x-flow-source': source },
      );
    } catch (err) {
      // Mid-flow failure on a POST-PURCHASE step: end the upsell gracefully so
      // the storefront advances to the receipt rather than erroring.
      console.error(
        `[upsell/click] ${action} on ${sessionId}/${nodeId} failed:`,
        err instanceof Error ? err.message : err,
      );
      return c.json(
        { success: false, demo: true, data: { next_node: null, is_terminal: true } },
        503,
      );
    }
  });

  // --- OmniCart config (publishable Stripe key for the browser) -------------
  // Returns only public, browser-safe config for initializing Stripe Elements.
  app.get('/api/omnicart-config', async (c) => {
    const env = c.env as OmniCartEnv & { STRIPE_PUBLISHABLE_KEY?: string };
    const code = c.req.query('code') || 'demo';

    // The checkout THEME/CONFIG (logo, colors) is a non-critical, read-only
    // lookup against core — never the payment path — so it may still call core
    // directly. It degrades silently to the default theme when core is absent.
    const runtimeUrl = normalizeBackend(env.OMNICART_UPSELL_RUNTIME_URL);
    const runtimeToken = (env.OMNICART_UPSELL_RUNTIME_TOKEN || '').trim();
    const backendConfigured = Boolean(env.OMNICART_BACKEND_URL && env.OMNICART_UPSELL_RUNTIME_URL);

    interface CheckoutTheme {
      logoUrl: string;
      primaryColor: string;
      accentColor: string;
      fontFamily: string;
      supportEmail: string;
      statementName: string;
    }

    const defaultTheme: CheckoutTheme = {
      logoUrl: '',
      primaryColor: '#2563eb',
      accentColor: '#16a34a',
      fontFamily: 'Inter, sans-serif',
      supportEmail: 'support@example.com',
      statementName: 'MERCHANT',
    };

    let theme = defaultTheme;
    let config: unknown = null;

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
          const resBody = (await response.json()) as {
            success?: boolean;
            theme?: Partial<CheckoutTheme>;
            config?: unknown;
          };
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
        stripePublishableKey: resolveEnvValue(
          env as unknown as Record<string, unknown>,
          'STRIPE_PUBLISHABLE_KEY',
          'STRIPE_PUBLIC_KEY',
        ),
        // The client uses this flag to decide whether to drive the real Flow
        // Builder runtime or fall back to the in-browser demo flow.
        backendConfigured,
        theme,
        config,
      },
    });
  });
}
