/**
 * Stripe checkout adapter (template / client-side variant).
 *
 * Mirrors the Delegate platform's `lib/integrations/checkout/stripe.ts`
 * capability declaration and two-call browser-payment contract, but the actual
 * Stripe SDK work happens server-side behind the Worker proxy
 * (`/api/checkout/stripe/*`). The browser never holds a secret key.
 *
 * Class: PAYMENT. Implements both `initPayment` (FIRST call — mint a payment
 * method against the publishable key via Stripe Elements) and `chargeInitial`
 * (SECOND call — server creates + confirms the PaymentIntent). SCA bounces back
 * as `requires_action` with a `clientSecret` the page confirms in-browser.
 *
 * Capabilities (identical to the platform Stripe adapter):
 *   publish         : card_charge, subscription, refund, saved_payment_method
 *   render          : apple_pay, google_pay, paypal_wallet
 *   runtimeFallback : sca_3ds_fallback
 */

import type { OrderSummary } from "@/lib/checkout-types";
import { checkoutProxy } from "../proxy";
import { buildCapabilities } from "../capabilities";
import type {
  CheckoutProcessorAdapter,
  ChargeInitialInput,
  ChargeInitialResult,
  PaymentInitInput,
  PaymentInitResult,
} from "../types";

const STRIPE_CAPABILITIES = buildCapabilities(
  ["card_charge", "subscription", "refund", "saved_payment_method"],
  ["apple_pay", "google_pay", "paypal_wallet"],
  ["sca_3ds_fallback"],
);

/**
 * FIRST call: ask the server for the publishable key + authoritative amount so
 * the browser can mount Stripe Elements and mint a PaymentMethod. Returns the
 * `collect_payment_method` mode on success, `demo` when no backend is wired.
 */
async function initPayment(input: PaymentInitInput): Promise<PaymentInitResult> {
  const r = await checkoutProxy<{
    publishableKey?: string;
    amountCents?: number;
    currencyCode?: string;
    initToken?: string;
  }>(
    "stripe",
    "init-payment",
    {
      currency: input.chargeTarget.currency,
      lineItems: input.chargeTarget.lineItems,
      totalCents: input.chargeTarget.totalCents,
      metadata: input.chargeTarget.metadata,
      email: input.customer.email,
    },
    (j) => j as {
      publishableKey?: string;
      amountCents?: number;
      currencyCode?: string;
      initToken?: string;
    },
    "Could not start checkout.",
  );

  if (r.demo) return { mode: "demo" };
  if (r.ok && r.data?.publishableKey && r.data.amountCents != null) {
    return {
      mode: "collect_payment_method",
      publishableKey: r.data.publishableKey,
      amountCents: r.data.amountCents,
      currencyCode: (r.data.currencyCode || input.chargeTarget.currency).toLowerCase(),
      ...(r.data.initToken ? { initToken: r.data.initToken } : {}),
    };
  }
  return {
    status: "failed",
    errorCode: r.httpStatus === 412 ? "not_configured" : "init_failed",
    userMessage:
      r.error ||
      "This store hasn't finished card-payment setup. Please contact the merchant.",
  };
}

/**
 * SECOND call: server creates + confirms the PaymentIntent with the
 * client-minted PaymentMethod (passed in `chargeTarget.metadata.paymentMethodId`).
 * SCA returns `requires_action` with the PI client secret; declines return
 * `failed`; no backend returns `demo`.
 */
async function chargeInitial(
  input: ChargeInitialInput,
): Promise<ChargeInitialResult> {
  interface StripeChargeBody {
    status?: string;
    processorOrderId?: string;
    order?: OrderSummary;
    clientSecret?: string;
    returnUrl?: string;
  }
  const r = await checkoutProxy<StripeChargeBody>(
    "stripe",
    "charge-initial",
    {
      idempotencyKey: input.idempotencyKey,
      currency: input.chargeTarget.currency,
      lineItems: input.chargeTarget.lineItems,
      totalCents: input.chargeTarget.totalCents,
      metadata: input.chargeTarget.metadata,
      customer: input.customer,
    },
    (j) => j as StripeChargeBody,
    "Could not process your payment.",
  );

  if (r.demo) return { status: "demo" };

  if (r.ok && r.data) {
    const d = r.data;
    if (d.status === "requires_action" && d.clientSecret) {
      return {
        status: "requires_action",
        clientSecret: d.clientSecret,
        ...(d.returnUrl ? { returnUrl: d.returnUrl } : {}),
      };
    }
    if (d.status === "succeeded" && d.processorOrderId && d.order) {
      return {
        status: "succeeded",
        processorOrderId: d.processorOrderId,
        order: d.order,
      };
    }
  }

  // SCA returned as a structured 402 body even on a non-2xx response.
  return {
    status: "failed",
    errorCode: r.httpStatus === 402 ? "card_declined" : "upstream_error",
    userMessage:
      r.error ||
      (r.httpStatus === 402
        ? "Your card was declined. Please try a different payment method."
        : "We couldn't process your payment right now. Please try again in a moment."),
  };
}

export const stripeAdapter: CheckoutProcessorAdapter = {
  kind: "stripe",
  capabilities: STRIPE_CAPABILITIES,
  chargeInitial,
  initPayment,
};
