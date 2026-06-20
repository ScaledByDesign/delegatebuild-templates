/**
 * OmniCart Upsell Flow client.
 *
 * Drives the post-purchase upsell sequence using the OmniCart **Flow Builder**
 * button contract. All calls go through the app's OWN same-origin Worker proxy
 * at `/api/upsell/*` (see worker/userRoutes.ts), which forwards to the configured
 * OmniCart Flow Builder runtime and keeps the service token server-side — the
 * token never ships to the browser.
 *
 * Runtime contract (mirrors the Delegate backend):
 *   POST /api/upsell/session            → initialize a session for an order,
 *                                          returns { session, entry_node }
 *   GET  /api/upsell/click?action=&sessionId=&nodeId=[&variantId=]
 *                                        → charge (on accept) + walk the graph,
 *                                          returns the next node or terminal
 *
 * DEGRADABLE BY DESIGN: the upsell is post-purchase, so it must never block the
 * (already completed) checkout. When the platform/CORE runtime is unreachable or
 * unconfigured, the client transparently falls back to a LOCAL walk of the
 * merchant's baked `FLOW_SNAPSHOT` — or the built-in `DEMO_FLOW_NODES` when no
 * snapshot was injected — so the generated checkout always renders a full
 * multi-upsell journey, even during a CORE outage.
 */
import {
  DEMO_FLOW_ENTRY_BUTTON_ID,
  DEMO_FLOW_ID,
  DEMO_FLOW_NODES,
  type FlowNode,
  type FlowSession,
  type FlowStepResult,
  type JourneyStep,
} from "@/lib/flow-types";

export interface StartFlowInput {
  /** The paid OmniCart order this upsell session attaches to. */
  orderId: string;
  /** Original order total in minor units (for AOV math + receipt). */
  originalOrderTotal: number;
  currencyCode?: string;
  /** Override the flow to run. Defaults to the merchant's active flow. */
  flowId?: string;
  /** Saved payment method id (`pm_...`) captured at the initial buy, so the
   *  upsell runtime can charge it off-session for 1-click upsells. The worker
   *  re-resolves pricing server-side; this is only the stored-method token,
   *  never an amount. */
  paymentMethodId?: string;
  /** The initial-buy PaymentIntent id (`pi_...`) for order linkage. */
  paymentIntentId?: string;
  /** The processor that completed the initial buy (`stripe` | `omnicart` |
   *  `konnektive` | `stickyio`). The deployer-owned worker runtime uses this to
   *  pick which 1-click charge adapter handles the upsell. */
  processorKind?: string;
  /** Affiliate partner CODE captured at the landing/initial buy (`?ref`/`?aff`
   *  or the `affiliate_ref` cookie). Persisted on the upsell session so the
   *  runtime stamps it onto every upsell charge's Stripe `affiliate_ref`
   *  metadata. Omitted for organic visits. */
  affiliateRef?: string;
}

export interface StartFlowResult {
  session: FlowSession;
  /** First offer node to render, or null if the flow has no offers. */
  entry_node: FlowNode | null;
  /** True when this session is running against a LOCAL flow (snapshot/demo). */
  demo: boolean;
}

/**
 * A self-contained upsell flow used as the OFFLINE FALLBACK when the live CORE
 * runtime is unreachable. The shape matches what the local walker needs: an
 * entry node id plus the full node table to walk.
 */
export interface FlowSnapshot {
  flow_id: string;
  entry_button_id: string;
  nodes: Record<string, FlowNode>;
}

/**
 * BUILD-TIME INJECTABLE: the merchant's published upsell flow, pulled down from
 * CORE at generation time and baked in here as an OFFLINE FALLBACK. At runtime
 * the LIVE CORE flow (via `/api/upsell/*`) is preferred; if CORE is unreachable
 * the client falls back to THIS snapshot so the post-purchase upsell still runs
 * the merchant's REAL offers rather than the generic demo. Leave `null` to fall
 * back to the built-in `DEMO_FLOW_NODES`.
 */
export const FLOW_SNAPSHOT: FlowSnapshot | null = null;

/** The built-in demo flow, expressed as a snapshot. */
const DEMO_FLOW: FlowSnapshot = {
  flow_id: DEMO_FLOW_ID,
  entry_button_id: DEMO_FLOW_ENTRY_BUTTON_ID,
  nodes: DEMO_FLOW_NODES,
};

/** Resolve the local fallback flow: the baked snapshot, else the demo flow. */
function resolveLocalFlow(): FlowSnapshot {
  return FLOW_SNAPSHOT ?? DEMO_FLOW;
}

// ─── Local (no-backend) in-browser flow walker ───────────────────────────────
// Mirrors the server runtime's accept/decline + graph-walk + journey logic so
// the generated page behaves identically when CORE is unreachable. Operates over
// `activeNodes`, set to the resolved local flow's node table when a local
// session starts. Local session ids are prefixed `demo_` so `stepUpsellFlow`
// routes them through this walker.

let localSession: FlowSession | null = null;
let activeNodes: Record<string, FlowNode> = DEMO_FLOW_NODES;

function localNode(id: string | null): FlowNode | null {
  return id ? activeNodes[id] ?? null : null;
}

function localStart(input: StartFlowInput): StartFlowResult {
  const flow = resolveLocalFlow();
  activeNodes = flow.nodes;
  localSession = {
    id: `demo_${Math.random().toString(36).slice(2, 10)}`,
    flow_id: flow.flow_id,
    status: "active",
    current_button_id: flow.entry_button_id,
    journey: [],
    total_revenue: input.originalOrderTotal,
    upsell_total: 0,
    currency_code: input.currencyCode || "usd",
    version: 1,
  };
  return { session: { ...localSession }, entry_node: localNode(localSession.current_button_id), demo: true };
}

function localStep(
  action: "accept" | "decline",
  nodeId: string,
  variantId: string | null,
): FlowStepResult {
  if (!localSession) throw new Error("Local upsell session not started");
  const node = localNode(nodeId);
  if (!node) throw new Error(`Local upsell node not found: ${nodeId}`);

  // Resolve the charge amount (multi-accept variant overrides node price).
  let revenue = 0;
  if (action === "accept") {
    if (variantId && node.accept_options?.length) {
      const opt = node.accept_options.find((o) => o.id === variantId);
      revenue = opt?.price ?? node.display_price ?? 0;
    } else {
      revenue = node.display_price ?? 0;
    }
  }

  // Record the journey step (mirror of the server's append-only log).
  const step: JourneyStep = {
    button_id: node.id,
    button_text: node.button_text,
    action: action === "accept" ? "success" : "decline",
    revenue,
    timestamp: new Date().toISOString(),
  };

  // Walk the graph.
  const terminal =
    action === "accept" ? node.is_terminal_success : node.is_terminal_decline;
  const nextId = terminal
    ? null
    : action === "accept"
      ? node.success_next_button_id ?? null
      : node.decline_next_button_id ?? null;

  localSession = {
    ...localSession,
    current_button_id: nextId,
    journey: [...localSession.journey, step],
    total_revenue: localSession.total_revenue + revenue,
    upsell_total: localSession.upsell_total + revenue,
    status: nextId ? "active" : "completed",
    version: localSession.version + 1,
  };

  const nextNode = localNode(nextId);
  return {
    session: { ...localSession },
    next_node: nextNode,
    is_terminal: !nextId,
    charge:
      action === "accept" && revenue > 0
        ? {
            transaction_id: `demo_txn_${Math.random().toString(36).slice(2, 10)}`,
            amount_charged: revenue,
            currency: localSession.currency_code,
          }
        : null,
  };
}

// ─── Public API ──────────────────────────────────────────────────────────────

interface UpsellSessionResponse {
  success?: boolean;
  data?: { session: FlowSession | null; entry_node: FlowNode | null };
}

/**
 * Initialize a post-purchase upsell session for a paid order and resolve the
 * first offer node. Prefers the live CORE runtime via the same-origin Worker
 * proxy; falls back to the local snapshot/demo flow when CORE is unreachable or
 * unconfigured.
 */
export async function startUpsellFlow(input: StartFlowInput): Promise<StartFlowResult> {
  try {
    const res = await fetch("/api/upsell/session", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        orderId: input.orderId,
        originalOrderTotal: input.originalOrderTotal,
        flowId: input.flowId,
        currencyCode: input.currencyCode,
        // Stored payment method + processor so the worker's local upsell runtime
        // can charge it off-session (1-click). The worker re-resolves pricing
        // server-side from the signed flow graph; this is only the token + kind.
        paymentMethodId: input.paymentMethodId,
        paymentIntentId: input.paymentIntentId,
        processorKind: input.processorKind,
        // Affiliate carry-over so second-charge (upsell) sales attribute to the
        // same partner as the initial buy. Snake_case matches the embed widget
        // + Delegate `/api/flow-builder/init` convention.
        affiliate_ref: input.affiliateRef,
      }),
    });
    if (res.ok) {
      const json = (await res.json()) as UpsellSessionResponse;
      if (json.success && json.data?.session) {
        return { session: json.data.session, entry_node: json.data.entry_node, demo: false };
      }
    }
  } catch {
    // Network/CORE failure → fall through to the local fallback below.
  }
  // CORE unreachable or not configured → run the merchant's baked snapshot
  // (or the built-in demo flow when no snapshot was injected).
  return localStart(input);
}

/**
 * Accept or decline the current offer node. On Accept the server charges the
 * saved payment method (one-click) and walks to `success_next_button_id`; on
 * Decline it walks to `decline_next_button_id`. Returns the next node (or a
 * terminal result that advances the storefront to confirmation).
 *
 * The `version` from the session is round-tripped via the runtime's optimistic
 * lock so rapid double-clicks can't double-charge. A local (`demo_`) session is
 * walked in-browser instead.
 */
export async function stepUpsellFlow(args: {
  session: FlowSession;
  action: "accept" | "decline";
  /** Multi-accept selection id (sent as `variantId`). */
  variantId?: string | null;
}): Promise<FlowStepResult> {
  const { session, action, variantId = null } = args;
  const nodeId = session.current_button_id;
  if (!nodeId) {
    // Nothing left to act on — already terminal.
    return { session, next_node: null, is_terminal: true };
  }

  if (session.id.startsWith("demo_")) {
    return localStep(action, nodeId, variantId);
  }

  const qs = new URLSearchParams({
    action,
    sessionId: session.id,
    nodeId,
    flowId: session.flow_id,
  });
  if (variantId) qs.set("variantId", variantId);

  try {
    const res = await fetch(`/api/upsell/click?${qs.toString()}`, {
      method: "GET",
      headers: { accept: "application/json" },
    });
    const json = (await res.json()) as { data?: FlowStepResult } | FlowStepResult;
    // Tolerate both `{ data: ... }` and bare result envelopes from the proxy.
    return "data" in json && json.data ? json.data : (json as FlowStepResult);
  } catch {
    // CORE went away mid-flow: end the (post-purchase) upsell gracefully.
    return { session, next_node: null, is_terminal: true };
  }
}
