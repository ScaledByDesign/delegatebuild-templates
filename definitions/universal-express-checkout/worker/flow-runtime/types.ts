/**
 * @delegate/flow-runtime — portable types.
 *
 * This package is the deployer-owned twin of the core upsell runtime. It runs
 * INSIDE the generated worker (Cloudflare workerd / Node) so the worker owns the
 * full charge runtime and Delegate core is NEVER in the payment hot path.
 *
 * ZERO runtime dependencies on `@/lib/db`, `@prisma/client`, or Next.js. The
 * flow graph arrives as a signed `FlowExport` (see flow-export.ts), session
 * state is held by a pluggable `SessionStore` the worker provides (KV / DO /
 * memory), and charges go through `ChargeAdapter`s the worker registers (it
 * holds the processor secrets).
 */

import type {
  FlowExport,
  FlowExportNode,
} from "./flow-export";

export type { FlowExport, FlowExportNode };

// ─── Provider contract (mirrors core lib/upsell-flows/providers/types.ts) ──────
// Kept structurally identical so a core adapter can be vendored into a worker
// adapter with no shape changes.

export type ProcessorKind =
  | "stripe"
  | "ultracart"
  | "stickyio"
  | "konnektive"
  | "clickbank"
  | "checkoutchamp"
  | "omnicart";

export interface ChargeStoredInput {
  workspaceId: string;
  /** Processor-specific token format (Stripe = "pmId|cusId"). */
  paymentMethodToken: string;
  /** Amount in cents. */
  amount: number;
  /** ISO currency (3-letter). */
  currency: string;
  metadata?: Record<string, string>;
  idempotencyKey?: string;
}

export interface ChargeStoredResult {
  paymentIntentId: string;
  amountCharged: number;
  currency: string;
  /** Anything non-"succeeded" is treated as a paymentError by the runtime. */
  status: string;
}

export type ProviderErrorCode =
  | "not_configured"
  | "not_supported"
  | "card_declined"
  | "authentication_required"
  | "invalid_token"
  | "upstream_error";

export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly code: ProviderErrorCode,
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

/** A 1-click charge adapter the worker registers (it holds the secrets). */
export interface ChargeAdapter {
  kind: ProcessorKind;
  chargeStoredPaymentMethod(
    input: ChargeStoredInput,
  ): Promise<ChargeStoredResult>;
}

// ─── Session state (held by the worker's SessionStore) ─────────────────────────

export interface JourneyStep {
  buttonId: string;
  buttonText: string;
  action: "success" | "decline";
  timestamp: string;
  /** Cents actually recorded (charge succeeded → price; else 0). */
  revenue: number;
}

export type SessionStatus = "active" | "completed" | "abandoned";

/**
 * Runtime session — the portable equivalent of core's UpsellSession row, but
 * the worker decides where to persist it. `paymentMethodToken` is the stored
 * "{pmId}|{cusId}" slot set after the initial buy completes.
 */
export interface RuntimeSession {
  id: string;
  flowId: string;
  flowVersion: number;
  /** Current node the customer is sitting on. */
  currentButtonId: string;
  status: SessionStatus;
  journey: JourneyStep[];
  totalRevenueCents: number;
  upsellTotalCents: number;
  originalOrderTotalCents: number;
  /** Stored payment method token for 1-click upsell charges (null until set). */
  paymentMethodToken: string | null;
  /** Optimistic-concurrency guard — bump on every mutation. */
  version: number;
  createdAt: number;
  /** processorKind resolved at initial buy — drives which ChargeAdapter to use. */
  processorKind: ProcessorKind | null;
  workspaceId: string;
  orderId?: string | null;
  /** Affiliate partner CODE carried from the initial buy. Stamped onto every
   *  upsell charge's Stripe `affiliate_ref` metadata so second-charge sales
   *  attribute to the same partner. Null for organic buys. */
  affiliateRef?: string | null;
}

/**
 * Pluggable persistence the worker supplies. Implementations: in-memory (tests),
 * Cloudflare KV, or a Durable Object (recommended for the optimistic lock).
 *
 * `update` MUST honor the optimistic version: it receives the version the caller
 * read and should reject (return null) if the stored version moved — mirroring
 * core's `updateSessionWithLocking`.
 */
export interface SessionStore {
  get(sessionId: string): Promise<RuntimeSession | null>;
  create(session: RuntimeSession): Promise<RuntimeSession>;
  /** CAS update; returns updated session or null if the version moved. */
  update(
    sessionId: string,
    expectedVersion: number,
    patch: Partial<RuntimeSession>,
  ): Promise<RuntimeSession | null>;
}

// ─── Step results (mirror core StepResult) ─────────────────────────────────────

export interface StepCharge {
  transactionId: string;
  amountCharged: number;
  currency: string;
}

export interface StepPaymentError {
  code: string;
  message: string;
}

export interface NextButtonView {
  id: string;
  label: string;
  buttonText: string;
  displayPrice: number | null;
  currencyCode: string;
  successRedirectUrl: string | null;
  declineRedirectUrl: string | null;
  externalPageUrl: string | null;
}

export interface StepResult {
  nextButtonId: string | null;
  redirect: string | null;
  isTerminal: boolean;
  nextButton: NextButtonView | null;
  charge: StepCharge | null;
  paymentError: StepPaymentError | null;
}

// ─── Navigation result (mirror core FlowNavResult) ─────────────────────────────

export type FlowNavResult =
  | { type: "redirect"; url: string }
  | { type: "end" }
  | { type: "not_found" };
