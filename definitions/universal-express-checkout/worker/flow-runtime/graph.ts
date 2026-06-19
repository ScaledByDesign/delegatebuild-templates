/**
 * Pure, in-memory flow-graph helpers.
 *
 * Core's runtime walks the graph with per-node DB reads (getNextFlowNodeUrl).
 * Here the ENTIRE graph is already in memory (FlowExport.nodes), so the same
 * routing logic becomes pure functions over a node index — no I/O, fully
 * unit-testable, and safe to run in workerd.
 *
 * Semantics intentionally mirror lib/upsell-flows/runtime.ts:
 *   • Terminal flag wins over any next pointer.
 *   • A missing next pointer ends the flow.
 *   • A next node that is itself terminal ends the flow.
 *   • externalPageUrl nodes redirect off-site (with sessionId/nodeId appended).
 *   • internal nodes redirect to the worker's own /u/:sessionId page.
 *
 * NOTE: split-test / experiment routing is deliberately NOT replicated here.
 * The portable runtime uses the STATIC successNextButtonId/declineNextButtonId
 * pointers (the deterministic backbone). Experiment assignment stays a
 * control-plane concern; if a deployer needs split-tests at the edge, the
 * resolved pointer can be baked into the exported node ahead of time.
 */

import type {
  FlowExport,
  FlowExportNode,
  FlowNavResult,
} from "./types";

/** Build an id → node map for O(1) lookups. */
export function indexNodes(
  flow: FlowExport,
): Map<string, FlowExportNode> {
  const m = new Map<string, FlowExportNode>();
  for (const n of flow.nodes) m.set(n.id, n);
  return m;
}

export function getNode(
  index: Map<string, FlowExportNode>,
  id: string,
): FlowExportNode | null {
  return index.get(id) ?? null;
}

/** Prepend https:// when a saved URL lacks a protocol (merchants paste bare hosts). */
export function normalizeRedirectUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

/**
 * The static next-node pointer for an edge (no experiment/split-test routing).
 */
export function staticNextId(
  node: FlowExportNode,
  action: "accept" | "decline",
): string | null {
  return action === "accept"
    ? node.successNextButtonId
    : node.declineNextButtonId;
}

/** Whether THIS node terminates the flow on the given edge. */
export function isTerminalEdge(
  node: FlowExportNode,
  action: "accept" | "decline",
): boolean {
  return action === "accept" ? node.isTerminalSuccess : node.isTerminalDecline;
}

/**
 * Pure twin of core getNextFlowNodeUrl. Resolves the next destination as a
 * discriminated union. `selfOrigin` is the worker's own base URL (used to build
 * the internal /u/:sessionId page URL).
 */
export function getNextFlowNode(
  flow: FlowExport,
  index: Map<string, FlowExportNode>,
  currentButtonId: string,
  action: "accept" | "decline",
  sessionId: string,
  selfOrigin: string,
): FlowNavResult {
  const current = getNode(index, currentButtonId);
  if (!current) return { type: "not_found" };

  const nextId = staticNextId(current, action);

  // Terminal flag wins over any pointer.
  if (isTerminalEdge(current, action) || !nextId) {
    return { type: "end" };
  }

  const target = getNode(index, nextId);
  if (!target) return { type: "not_found" };

  // Terminal target ends the flow.
  if (target.isTerminalSuccess || target.isTerminalDecline) {
    return { type: "end" };
  }

  // External page node — append flow context for the merchant's page.
  if (target.externalPageUrl) {
    try {
      const url = new URL(normalizeRedirectUrl(target.externalPageUrl));
      url.searchParams.set("sessionId", sessionId);
      url.searchParams.set("nodeId", target.id);
      return { type: "redirect", url: url.toString() };
    } catch {
      /* malformed URL — fall through to internal redirect */
    }
  }

  // Internal node — render via the worker's own /u/:sessionId page.
  try {
    const internalUrl = new URL(
      `/u/${sessionId}?nodeId=${target.id}`,
      selfOrigin,
    );
    return { type: "redirect", url: internalUrl.toString() };
  } catch {
    return { type: "redirect", url: `/u/${sessionId}?nodeId=${target.id}` };
  }
}

/** Resolve the flow's entry node (denorm cache, then INITIAL fallback). */
export function resolveEntryNode(
  flow: FlowExport,
  index: Map<string, FlowExportNode>,
): FlowExportNode | null {
  if (flow.entryButtonId) {
    const cached = getNode(index, flow.entryButtonId);
    if (cached) return cached;
  }
  return flow.nodes.find((n) => n.positionKind === "INITIAL") ?? null;
}

/**
 * Upper-bound timer check — pure twin of core isOfferTimerExpired. Sums the
 * timers of all nodes with a timer in the flow as the upper bound for when this
 * offer could have started (matches core's pessimistic-but-customer-friendly
 * estimate).
 */
export function isOfferTimerExpired(
  flow: FlowExport,
  index: Map<string, FlowExportNode>,
  buttonId: string,
  sessionCreatedAtMs: number,
  nowMs: number = Date.now(),
): boolean {
  const node = getNode(index, buttonId);
  if (!node?.timer || node.timer <= 0) return false;

  let previousTimersMs = 0;
  for (const n of flow.nodes) {
    if (n.timer && n.timer > 0) previousTimersMs += n.timer * 1000;
  }
  const offerExpireMs =
    sessionCreatedAtMs + previousTimersMs + node.timer * 1000;
  return nowMs > offerExpireMs;
}

/** Resolve a multi-accept variant option by id (pure twin of resolveAcceptVariant). */
export function resolveAcceptVariant(
  node: FlowExportNode,
  variantId: string,
): {
  id: string;
  label: string;
  productId?: string | null;
  price: number;
  compareAtPrice?: number | null;
  ctaText?: string | null;
} | null {
  const match = node.acceptOptions.find((o) => o.id === variantId);
  if (!match) return null;
  return {
    id: match.id,
    label: match.label,
    productId: match.productId ?? null,
    price: typeof match.price === "number" ? match.price : 0,
    compareAtPrice: match.compareAtPrice ?? null,
    ctaText: match.ctaText ?? null,
  };
}
