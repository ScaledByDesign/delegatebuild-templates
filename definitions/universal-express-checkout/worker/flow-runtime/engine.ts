/**
 * FlowRuntime — the portable upsell state machine.
 *
 * Deployer-owned twin of core lib/upsell-flows/runtime.ts. Runs entirely in the
 * generated worker: the graph is the in-memory signed FlowExport, sessions live
 * in the worker's SessionStore, and charges go through the worker's registered
 * ChargeAdapters. Core is NEVER called in the charge path.
 *
 * Parity with core semantics (acceptButton / declineButton):
 *   • 1-click off-session charge BEFORE recording the step, so a decline
 *     short-circuits the revenue but still advances the journey.
 *   • Idempotency key `accept:{sessionId}:{buttonId}:{version}` — a double click
 *     returns the same transaction.
 *   • Optimistic version locking via SessionStore.update CAS.
 *   • Terminal flag wins over any next pointer.
 *   • Cross-flow guard: a button must belong to the session's flow.
 */

import {
  type ChargeStoredResult,
  type FlowExport,
  type FlowExportNode,
  type NextButtonView,
  type RuntimeSession,
  type SessionStore,
  type StepResult,
  type ProcessorKind,
  ProviderError,
} from "./types";
import {
  indexNodes,
  getNode,
  resolveEntryNode,
  staticNextId,
  isTerminalEdge,
  isOfferTimerExpired,
} from "./graph";
import { ProviderRegistry } from "./registry";
import { verifyFlowExport } from "./flow-export";

export interface FlowRuntimeOptions {
  flow: FlowExport;
  store: SessionStore;
  registry: ProviderRegistry;
  /** The worker's own base URL — used for internal /u/:sessionId redirects. */
  selfOrigin: string;
  /** Override clock for tests. */
  now?: () => number;
}

export interface InitializeInput {
  cartId?: string | null;
  orderId?: string | null;
  /** Stored token from the initial buy ("{pmId}|{cusId}" for Stripe). */
  paymentMethodToken?: string | null;
  originalOrderTotalCents?: number;
  processorKind?: ProcessorKind | null;
  /** Affiliate partner CODE carried from the initial buy (null for organic). */
  affiliateRef?: string | null;
}

function genId(): string {
  // workerd + Node both expose crypto.randomUUID on globalThis.crypto.
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function toNextButtonView(node: FlowExportNode): NextButtonView {
  return {
    id: node.id,
    label: node.label,
    buttonText: node.buttonText,
    displayPrice: node.displayPrice,
    currencyCode: node.currencyCode,
    successRedirectUrl: node.successRedirectUrl,
    declineRedirectUrl: node.declineRedirectUrl,
    externalPageUrl: node.externalPageUrl,
  };
}

export class FlowRuntime {
  private readonly flow: FlowExport;
  private readonly store: SessionStore;
  private readonly registry: ProviderRegistry;
  private readonly selfOrigin: string;
  private readonly now: () => number;
  private readonly index: Map<string, FlowExportNode>;

  constructor(opts: FlowRuntimeOptions) {
    this.flow = opts.flow;
    this.store = opts.store;
    this.registry = opts.registry;
    this.selfOrigin = opts.selfOrigin;
    this.now = opts.now ?? (() => Date.now());
    this.index = indexNodes(opts.flow);
  }

  /**
   * Construct a runtime from a SIGNED flow-export token. The token is verified
   * (HMAC + schema version) before use — so a tampered or stale cached snapshot
   * is rejected at construction time. This is the recommended entry point.
   */
  static async fromSignedToken(
    token: string,
    secret: string,
    opts: Omit<FlowRuntimeOptions, "flow">,
  ): Promise<FlowRuntime> {
    const flow = await verifyFlowExport(token, secret);
    return new FlowRuntime({ ...opts, flow });
  }

  getFlow(): FlowExport {
    return this.flow;
  }

  node(id: string): FlowExportNode | null {
    return getNode(this.index, id);
  }

  entryNode(): FlowExportNode | null {
    return resolveEntryNode(this.flow, this.index);
  }

  /** Mint a new runtime session positioned at the flow's entry node. */
  async initialize(input: InitializeInput = {}): Promise<{
    session: RuntimeSession;
    entryNode: FlowExportNode;
  }> {
    const entry = this.entryNode();
    if (!entry) {
      throw new Error(
        `Flow ${this.flow.flowId} has no entry (INITIAL) node configured`,
      );
    }
    const session: RuntimeSession = {
      id: genId(),
      flowId: this.flow.flowId,
      flowVersion: this.flow.flowVersion,
      currentButtonId: entry.id,
      status: "active",
      journey: [],
      totalRevenueCents: 0,
      upsellTotalCents: 0,
      originalOrderTotalCents: input.originalOrderTotalCents ?? 0,
      paymentMethodToken: input.paymentMethodToken ?? null,
      version: 1,
      createdAt: this.now(),
      processorKind: input.processorKind ?? null,
      workspaceId: this.flow.workspaceId,
      orderId: input.orderId ?? null,
      affiliateRef: input.affiliateRef ?? null,
    };
    const created = await this.store.create(session);
    return { session: created, entryNode: entry };
  }

  /** Persist the stored payment token after the initial buy completes. */
  async attachPaymentToken(
    sessionId: string,
    paymentMethodToken: string,
    processorKind: ProcessorKind | null,
  ): Promise<RuntimeSession> {
    const session = await this.requireSession(sessionId);
    const updated = await this.store.update(sessionId, session.version, {
      paymentMethodToken,
      processorKind: processorKind ?? session.processorKind,
      version: session.version + 1,
    });
    if (!updated) throw new Error("Concurrent session update — retry");
    return updated;
  }

  // ─── Accept ────────────────────────────────────────────────────────────────

  async accept(
    sessionId: string,
    buttonId: string,
    opts: { variantId?: string } = {},
  ): Promise<StepResult> {
    const node = this.requireNode(buttonId);
    const session = await this.requireSession(sessionId);
    this.assertNodeInFlow(node, session);

    // Resolve effective price (multi-accept variant override).
    let amount = node.displayPrice ?? 0;
    if (opts.variantId) {
      const opt = node.acceptOptions.find((o) => o.id === opts.variantId);
      if (opt && typeof opt.price === "number") amount = opt.price;
    }

    // 1-click charge BEFORE recording (decline short-circuits revenue).
    let charge: StepResult["charge"] = null;
    let paymentError: StepResult["paymentError"] = null;
    const shouldCharge = Boolean(session.paymentMethodToken && amount > 0);

    if (shouldCharge && session.paymentMethodToken) {
      try {
        const result: ChargeStoredResult = await this.registry.charge(
          session.processorKind,
          {
            workspaceId: session.workspaceId,
            paymentMethodToken: session.paymentMethodToken,
            amount,
            currency: node.currencyCode || "USD",
            metadata: {
              sessionId,
              buttonId: node.id,
              flowId: session.flowId,
              ...(session.orderId
                ? { originalOrderId: String(session.orderId) }
                : {}),
              // Affiliate attribution — stamp the partner code onto the upsell
              // charge's Stripe metadata so the conversion webhook credits the
              // same partner that drove the initial buy. Omitted for organic.
              ...(session.affiliateRef
                ? { affiliate_ref: session.affiliateRef }
                : {}),
            },
            idempotencyKey: `accept:${sessionId}:${node.id}:${session.version}`,
          },
        );
        if (result.status && result.status !== "succeeded") {
          paymentError = {
            code: result.status,
            message: `Charge status: ${result.status}`,
          };
        } else {
          charge = {
            transactionId: result.paymentIntentId,
            amountCharged: result.amountCharged,
            currency: result.currency,
          };
        }
      } catch (err) {
        if (err instanceof ProviderError) {
          paymentError = { code: err.code, message: err.message };
        } else {
          paymentError = {
            code: "upstream_error",
            message: err instanceof Error ? err.message : String(err),
          };
        }
      }
    }

    const recordedRevenue = charge ? charge.amountCharged : 0;
    const newStep = {
      buttonId: node.id,
      buttonText: node.buttonText,
      action: "success" as const,
      timestamp: new Date(this.now()).toISOString(),
      revenue: recordedRevenue,
    };
    const updatedJourney = [...session.journey, newStep];
    const newTotal = session.totalRevenueCents + recordedRevenue;
    const newUpsell = session.upsellTotalCents + recordedRevenue;

    const nextId = staticNextId(node, "accept");

    // Terminal — complete the session.
    if (isTerminalEdge(node, "accept") || !nextId) {
      const done = await this.store.update(sessionId, session.version, {
        journey: updatedJourney,
        totalRevenueCents: newTotal,
        upsellTotalCents: newUpsell,
        status: "completed",
        version: session.version + 1,
      });
      if (!done) throw new Error("Concurrent session update — retry");
      return {
        nextButtonId: null,
        redirect: node.successRedirectUrl ?? null,
        isTerminal: true,
        nextButton: null,
        charge,
        paymentError,
      };
    }

    const nextNode = this.node(nextId);
    const advanced = await this.store.update(sessionId, session.version, {
      currentButtonId: nextId,
      journey: updatedJourney,
      totalRevenueCents: newTotal,
      upsellTotalCents: newUpsell,
      version: session.version + 1,
    });
    if (!advanced) throw new Error("Concurrent session update — retry");

    return {
      nextButtonId: nextId,
      redirect: null,
      isTerminal: false,
      nextButton: nextNode ? toNextButtonView(nextNode) : null,
      charge,
      paymentError,
    };
  }

  // ─── Decline ─────────────────────────────────────────────────────────────────

  async decline(sessionId: string, buttonId: string): Promise<StepResult> {
    const node = this.requireNode(buttonId);
    const session = await this.requireSession(sessionId);
    this.assertNodeInFlow(node, session);

    const newStep = {
      buttonId: node.id,
      buttonText: node.buttonText,
      action: "decline" as const,
      timestamp: new Date(this.now()).toISOString(),
      revenue: 0,
    };
    const updatedJourney = [...session.journey, newStep];
    const nextId = staticNextId(node, "decline");

    if (isTerminalEdge(node, "decline") || !nextId) {
      const done = await this.store.update(sessionId, session.version, {
        journey: updatedJourney,
        status: "completed",
        version: session.version + 1,
      });
      if (!done) throw new Error("Concurrent session update — retry");
      return {
        nextButtonId: null,
        redirect: node.declineRedirectUrl ?? null,
        isTerminal: true,
        nextButton: null,
        charge: null,
        paymentError: null,
      };
    }

    const nextNode = this.node(nextId);
    const advanced = await this.store.update(sessionId, session.version, {
      currentButtonId: nextId,
      journey: updatedJourney,
      version: session.version + 1,
    });
    if (!advanced) throw new Error("Concurrent session update — retry");

    return {
      nextButtonId: nextId,
      redirect: null,
      isTerminal: false,
      nextButton: nextNode ? toNextButtonView(nextNode) : null,
      charge: null,
      paymentError: null,
    };
  }

  /** Timer-expiry check for the current/passed node. */
  isTimerExpired(sessionCreatedAtMs: number, buttonId: string): boolean {
    return isOfferTimerExpired(
      this.flow,
      this.index,
      buttonId,
      sessionCreatedAtMs,
      this.now(),
    );
  }

  // ─── Guards ──────────────────────────────────────────────────────────────────

  private requireNode(id: string): FlowExportNode {
    const n = this.node(id);
    if (!n) throw new Error(`Button not found in flow: ${id}`);
    return n;
  }

  private async requireSession(id: string): Promise<RuntimeSession> {
    const s = await this.store.get(id);
    if (!s) throw new Error(`Session not found: ${id}`);
    return s;
  }

  /** Cross-flow guard (IDOR) — the node must belong to the session's flow. */
  private assertNodeInFlow(node: FlowExportNode, session: RuntimeSession): void {
    if (session.flowId !== this.flow.flowId) {
      throw new Error("Session does not belong to this flow runtime");
    }
    if (!this.index.has(node.id)) {
      throw new Error("Button does not belong to this session's flow");
    }
  }
}
