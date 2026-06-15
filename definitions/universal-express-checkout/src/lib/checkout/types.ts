/**
 * Checkout adapter contract for the universal express checkout.
 *
 * Mirrors the Delegate platform's `lib/integrations/checkout/types.ts`
 * (`CheckoutProcessorAdapter` + `ChargeInitialResult` / `PaymentInitResult`
 * discriminated unions), adapted for a client-side storefront template. Every
 * processor — Stripe, OmniCart/Medusa, Konnektive, Sticky.io — implements this
 * one interface, so `CheckoutPage` drives any backend through the same calls.
 *
 * Each adapter routes through the same-origin Worker proxy (`/api/checkout/*`)
 * so credentials stay server-side, and degrades to demo mode when no backend is
 * configured (the proxy returns `503 { demo: true }`).
 */

import type { OmniCart, OmniCartAddress } from "@/lib/omnicart";
import type { OrderSummary as OrderSummaryData } from "@/lib/checkout-types";
import type {
  Capability,
  CheckoutProcessorCapabilities,
} from "./capabilities";
import type { ProcessorKind } from "./manifest";

export type { Capability, CheckoutProcessorCapabilities, ProcessorKind };

// ─── Customer + charge target ────────────────────────────────────────────────

/** Customer-visible identity captured from the public form. */
export interface CheckoutCustomer {
  email: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  shipping_address?: OmniCartAddress;
}

/** A single charge line; `priceId` is the processor's native variant/price id. */
export interface ChargeLineItem {
  priceId: string;
  quantity: number;
  unitPriceCents: number;
  sku?: string;
  title?: string;
}

/**
 * Authoritative charge target. On the platform this is resolved server-side
 * from the published snapshot; in the template it is built from the cart so the
 * demo flow runs end to end.
 */
export interface ChargeTarget {
  currency: string;
  lineItems: ChargeLineItem[];
  totalCents: number;
  /** Processor-specific ids (e.g. Sticky/Konnektive campaignId, offerId). */
  metadata?: Record<string, string>;
}

// ─── chargeInitial ───────────────────────────────────────────────────────────

export interface ChargeInitialInput {
  cart: OmniCart;
  customer: CheckoutCustomer;
  chargeTarget: ChargeTarget;
  /** Idempotency key the page supplies so a double-submit returns one order. */
  idempotencyKey: string;
}

/**
 * Discriminated `chargeInitial` result. The page pattern-matches on `status`.
 *  - `succeeded`        → adopt the order, advance to upsell/confirmation.
 *  - `requires_action`  → SCA/3DS: confirm `clientSecret` in-browser, retry.
 *  - `failed`           → surface `userMessage`; never throws.
 *  - `demo`             → no backend wired; page synthesizes a demo order.
 */
export type ChargeInitialResult =
  | {
      status: "succeeded";
      processorOrderId: string;
      order: OrderSummaryData;
    }
  | {
      status: "requires_action";
      clientSecret: string;
      returnUrl?: string;
    }
  | {
      status: "failed";
      errorCode: string;
      userMessage: string;
    }
  | { status: "demo" };

// ─── Two-call browser-payment contract (initPayment) ─────────────────────────

export interface PaymentInitInput {
  cart: OmniCart;
  customer: CheckoutCustomer;
  chargeTarget: ChargeTarget;
}

/**
 * Result of `initPayment` — the FIRST call of the two-call browser flow used by
 * payment-class processors (Stripe, OmniCart/Medusa). CRM-class processors
 * (Konnektive, Sticky.io) omit `initPayment` and use single-call `chargeInitial`.
 *
 *  - `collect_payment_method`: client mints a payment method (Stripe Elements),
 *    then `chargeInitial` confirms it.
 *  - `confirm_client_secret`: server pre-created a PaymentIntent (Medusa store
 *    payment-session); client confirms it in-browser, then `chargeInitial`
 *    completes the cart.
 *  - `failed` / `demo`: structured fallbacks (never a thrown error).
 */
export type PaymentInitResult =
  | {
      mode: "collect_payment_method";
      publishableKey: string;
      amountCents: number;
      currencyCode: string;
      initToken?: string;
    }
  | {
      mode: "confirm_client_secret";
      publishableKey: string;
      clientSecret: string;
      paymentCollectionId: string;
      cartId?: string;
    }
  | {
      status: "failed";
      errorCode: string;
      userMessage: string;
    }
  | { mode: "demo" };

// ─── The adapter contract ────────────────────────────────────────────────────

/**
 * The contract every processor adapter implements. Keep the surface MINIMAL:
 * the page composes the cart-lifecycle helpers (in each adapter) and then calls
 * `chargeInitial` (optionally preceded by `initPayment` for payment-class
 * processors). The Flow Builder post-purchase upsell is processor-independent
 * and lives outside this contract (`src/lib/upsell-flow.ts`), so it runs
 * uniformly for every processor.
 */
export interface CheckoutProcessorAdapter {
  readonly kind: ProcessorKind;
  readonly capabilities: CheckoutProcessorCapabilities;

  /**
   * Initial-buy charge. NEVER throws on declines/SCA/missing config — returns a
   * discriminated result. `demo` signals no backend is wired.
   */
  chargeInitial(input: ChargeInitialInput): Promise<ChargeInitialResult>;

  /**
   * FIRST call of the two-call browser-payment contract. Optional: only
   * payment-class processors implement it. CRM-class adapters omit it and the
   * page goes straight to `chargeInitial`.
   */
  initPayment?(input: PaymentInitInput): Promise<PaymentInitResult>;
}
