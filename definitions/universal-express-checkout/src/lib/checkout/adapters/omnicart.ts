/**
 * OmniCart checkout adapter (template / client-side variant).
 *
 * Mirrors the Delegate platform's `lib/integrations/checkout/omnicart.ts`
 * capability declaration and the OmniCart (Medusa) two-call browser-payment
 * contract. Unlike the platform — which talks to the OmniCart admin SDK
 * server-side — this template adapter REUSES the cart-lifecycle helpers already
 * shipped in `@/lib/omnicart` (createPaymentCollection / initPaymentSession /
 * completeCart), which themselves route through the Worker proxy and decode the
 * `503 { demo: true }` signal. So the OmniCart adapter is a thin wrapper that
 * adapts those `BackendResult<T>` returns into the universal contract's
 * discriminated unions.
 *
 * Class: PAYMENT. `initPayment` uses the `confirm_client_secret` mode (Medusa
 * pre-creates a PaymentIntent inside a store payment-session; the browser
 * confirms it). `chargeInitial` then completes the cart into an order.
 *
 * Capabilities (identical to the platform OmniCart adapter):
 *   publish         : card_charge, refund, order_bump, address_validation,
 *                     saved_payment_method
 *   render          : (none)
 *   runtimeFallback : (none)
 */

import {
  createPaymentCollection,
  initPaymentSession,
  completeCart,
  formatAmount,
  type OmniCartPaymentCollection,
  type OmniOrder,
} from "@/lib/omnicart";
import type { OrderSummary } from "@/lib/checkout-types";
import { buildCapabilities } from "../capabilities";
import type {
  CheckoutProcessorAdapter,
  ChargeInitialInput,
  ChargeInitialResult,
  PaymentInitInput,
  PaymentInitResult,
} from "../types";

const OMNICART_CAPABILITIES = buildCapabilities(
  ["card_charge", "refund", "order_bump", "address_validation", "saved_payment_method"],
  [],
  [],
);

/** OmniCart's default card payment provider id (Stripe-backed in Medusa). */
const DEFAULT_PROVIDER_ID = "pp_stripe_stripe";

/** Extract a `client_secret` from an initialized OmniCart payment collection. */
function clientSecretFromCollection(
  pc: OmniCartPaymentCollection | undefined,
): string | undefined {
  if (!pc?.payment_sessions?.length) return undefined;
  for (const s of pc.payment_sessions) {
    const data = (s.data ?? {}) as Record<string, unknown>;
    const cs = data.client_secret;
    if (typeof cs === "string" && cs.length > 0) return cs;
  }
  return undefined;
}

/**
 * Map a placed OmniCart order to the universal `OrderSummary`. The cart's
 * captured totals are authoritative.
 */
function orderToSummary(order: OmniOrder, email: string): OrderSummary {
  return {
    id: order.id,
    email: order.email || email,
    subtotal: order.subtotal ?? 0,
    shipping_total: order.shipping_total ?? 0,
    tax_total: order.tax_total ?? 0,
    discount_total: order.discount_total ?? 0,
    total: order.total ?? 0,
    currency_code: order.currency_code ?? "usd",
    items: order.items ?? [],
    // OmniOrder doesn't echo applied promotions; the order is already
    // discount-adjusted via discount_total. Surface an empty list.
    promotions: [],
  };
}

/**
 * FIRST call: create a payment collection on the cart and initialize the card
 * payment session, then hand the browser the PaymentIntent `client_secret` to
 * confirm. `confirm_client_secret` mode.
 */
async function initPayment(input: PaymentInitInput): Promise<PaymentInitResult> {
  const cartId = input.cart.id;
  const collected = await createPaymentCollection(cartId);
  if (collected.demo) return { mode: "demo" };
  if (!collected.ok || !collected.data) {
    return {
      status: "failed",
      errorCode: "not_configured",
      userMessage:
        collected.error ||
        "This store has not finished payment setup. Please contact the merchant.",
    };
  }

  const session = await initPaymentSession(collected.data.id, DEFAULT_PROVIDER_ID);
  if (session.demo) return { mode: "demo" };
  if (!session.ok || !session.data) {
    return {
      status: "failed",
      errorCode: "init_failed",
      userMessage: session.error || "Could not initialize payment.",
    };
  }

  const clientSecret = clientSecretFromCollection(session.data);
  if (!clientSecret) {
    return {
      status: "failed",
      errorCode: "no_client_secret",
      userMessage: "Could not initialize payment. Please try again.",
    };
  }

  return {
    mode: "confirm_client_secret",
    // The publishable key is surfaced by the existing /api/omnicart-config route
    // and read by PaymentStep; the contract field is populated there. We pass an
    // empty string here so the page falls back to its config fetch.
    publishableKey: "",
    clientSecret,
    paymentCollectionId: collected.data.id,
    cartId,
  };
}

/**
 * SECOND call: the browser has confirmed the PaymentIntent; complete the cart
 * into an order. `succeeded` carries the order; a recoverable cart error maps to
 * `failed`; no backend maps to `demo`.
 */
async function chargeInitial(
  input: ChargeInitialInput,
): Promise<ChargeInitialResult> {
  const result = await completeCart(input.cart.id);
  if (result.demo) return { status: "demo" };
  if (result.ok && result.order) {
    return {
      status: "succeeded",
      processorOrderId: result.order.id,
      order: orderToSummary(result.order, input.customer.email),
    };
  }
  return {
    status: "failed",
    errorCode: "cart_incomplete",
    userMessage: result.error || "We could not complete your order.",
  };
}

// `formatAmount` is intentionally imported to keep parity with the platform
// adapter's currency handling; referenced here so tree-shaking keeps the symbol
// available to consumers that import the adapter module.
void formatAmount;

export const omnicartAdapter: CheckoutProcessorAdapter = {
  kind: "omnicart",
  capabilities: OMNICART_CAPABILITIES,
  chargeInitial,
  initPayment,
};
