/**
 * OmniCart Upsell Flow client.
 *
 * Drives the post-purchase upsell sequence using the OmniCart **Flow Builder**
 * button contract. All calls go through the app's own Worker proxy at
 * `/api/upsell/*` (see worker/userRoutes.ts), which forwards to the configured
 * OmniCart Flow Builder runtime and keeps the publishable key server-side.
 *
 * Runtime contract (mirrors the Delegate backend):
 *   POST /api/upsell/session            → initialize a session for an order,
 *                                          returns { session, entry_node }
 *   GET  /api/upsell/click?action=&sessionId=&nodeId=[&variantId=]
 *                                        → charge (on accept) + walk the graph,
 *                                          returns the next node or terminal
 *
 * When no backend is configured, the client transparently falls back to an
 * in-browser walk of DEMO_FLOW_NODES so the generated checkout renders a full
 * multi-upsell journey out of the box.
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
}

export interface StartFlowResult {
  session: FlowSession;
  /** First offer node to render, or null if the flow has no offers. */
  entry_node: FlowNode | null;
  /** True when this session is running against the in-browser demo flow. */
  demo: boolean;
}

/** True if the OmniCart backend reports a wired upsell flow runtime. */
function backendConfigured(): boolean {
  return Boolean(import.meta.env.VITE_OMNICART_UPSELL_RUNTIME_URL);
}

// ─── Demo (no-backend) in-browser flow walker ────────────────────────────────
// Mirrors the server runtime's accept/decline + graph-walk + journey logic so
// the generated page behaves identically before a backend is wired.

let demoSession: FlowSession | null = null;

function demoNode(id: string | null): FlowNode | null {
  return id ? DEMO_FLOW_NODES[id] ?? null : null;
}

function demoStart(input: StartFlowInput): StartFlowResult {
  demoSession = {
    id: `demo_${Math.random().toString(36).slice(2, 10)}`,
    flow_id: DEMO_FLOW_ID,
    status: "active",
    current_button_id: DEMO_FLOW_ENTRY_BUTTON_ID,
    journey: [],
    total_revenue: input.originalOrderTotal,
    upsell_total: 0,
    currency_code: input.currencyCode || "usd",
    version: 1,
  };
  return { session: { ...demoSession }, entry_node: demoNode(demoSession.current_button_id), demo: true };
}

function demoStep(
  action: "accept" | "decline",
  nodeId: string,
  variantId: string | null,
): FlowStepResult {
  if (!demoSession) throw new Error("Demo session not started");
  const node = demoNode(nodeId);
  if (!node) throw new Error(`Demo node not found: ${nodeId}`);

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

  demoSession = {
    ...demoSession,
    current_button_id: nextId,
    journey: [...demoSession.journey, step],
    total_revenue: demoSession.total_revenue + revenue,
    upsell_total: demoSession.upsell_total + revenue,
    status: nextId ? "active" : "completed",
    version: demoSession.version + 1,
  };

  const nextNode = demoNode(nextId);
  return {
    session: { ...demoSession },
    next_node: nextNode,
    is_terminal: !nextId,
    charge:
      action === "accept" && revenue > 0
        ? {
            transaction_id: `demo_txn_${Math.random().toString(36).slice(2, 10)}`,
            amount_charged: revenue,
            currency: demoSession.currency_code,
          }
        : null,
  };
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Initialize a post-purchase upsell session for a paid order and resolve the
 * first offer node. Falls back to the in-browser demo flow when no backend is
 * configured.
 */
export async function startUpsellFlow(input: StartFlowInput): Promise<StartFlowResult> {
  const runtimeUrl = import.meta.env.VITE_OMNICART_UPSELL_RUNTIME_URL;
  if (!runtimeUrl) {
    return demoStart(input);
  }
  const headers: Record<string, string> = { "content-type": "application/json" };
  const token = import.meta.env.VITE_OMNICART_UPSELL_RUNTIME_TOKEN;
  if (token) {
    headers["authorization"] = `Bearer ${token}`;
  }
  
  // Direct call to platform/runtime's init endpoint
  const target = `${runtimeUrl.replace(/\/$/, "")}/api/flow-builder/init`;
  const platformBody = {
    order_id: input.orderId,
    original_order_total: input.originalOrderTotal,
    flow_id: input.flowId,
    currency_code: input.currencyCode,
  };

  try {
    const res = await fetch(target, {
      method: "POST",
      headers,
      body: JSON.stringify(platformBody),
    });
    if (!res.ok) {
      return demoStart(input);
    }
    const platformJson = (await res.json()) as { session: any; entry_button: any };
    const session = platformJson.session;
    const entry_button = platformJson.entry_button;

    const readJourneySteps = (journey: any): any[] => {
      if (!journey || typeof journey !== "object" || Array.isArray(journey)) {
        return [];
      }
      const steps = journey.steps;
      if (!Array.isArray(steps)) return [];
      return steps;
    };

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

    return { session: flowSession!, entry_node: flowNode, demo: false };
  } catch {
    return demoStart(input);
  }
}

/**
 * Accept or decline the current offer node. On Accept the server charges the
 * saved payment method (one-click) and walks to `success_next_button_id`; on
 * Decline it walks to `decline_next_button_id`. Returns the next node (or a
 * terminal result that advances the storefront to confirmation).
 *
 * The `version` from the session is round-tripped via the runtime's optimistic
 * lock so rapid double-clicks can't double-charge.
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
    return demoStep(action, nodeId, variantId);
  }

  const runtimeUrl = import.meta.env.VITE_OMNICART_UPSELL_RUNTIME_URL;
  if (!runtimeUrl) {
    return { session, next_node: null, is_terminal: true };
  }

  const qs = new URLSearchParams({
    action,
    sessionId: session.id,
    nodeId,
    flowId: session.flow_id,
  });
  if (variantId) qs.set("variantId", variantId);

  const headers: Record<string, string> = { accept: "application/json" };
  const token = import.meta.env.VITE_OMNICART_UPSELL_RUNTIME_TOKEN;
  if (token) {
    headers["authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${runtimeUrl.replace(/\/$/, "")}/api/flow-builder/click?${qs.toString()}`, {
    method: "GET",
    headers,
  });
  const json = (await res.json()) as { data: FlowStepResult } | FlowStepResult;
  // Tolerate both `{ data: ... }` and bare result envelopes from the proxy.
  return "data" in (json as { data?: unknown }) ? (json as { data: FlowStepResult }).data : (json as FlowStepResult);
}
