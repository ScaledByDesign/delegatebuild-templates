/**
 * Sticky.io checkout adapter (template / client-side variant).
 *
 * Mirrors the Delegate platform's `lib/integrations/checkout/stickyio.ts`
 * capability declaration and single-call charge model. Like Konnektive, Sticky.io
 * is a CRM-class processor that owns the order lifecycle and charges in ONE call
 * (`new_order`). It omits `initPayment`; the page goes straight to
 * `chargeInitial`.
 *
 * Sticky.io DOES advertise `sca_3ds_fallback` (runtimeFallback): a charge can
 * come back needing 3DS continuation, so `chargeInitial` may resolve to
 * `requires_action` with a `clientSecret` the page confirms before retrying.
 *
 * The browser posts the order to the Worker proxy (`/api/checkout/stickyio/
 * charge-initial`); the proxy forwards to Sticky.io with server-side
 * credentials. No backend wired → `503 { demo: true }` → `{ status: "demo" }`.
 *
 * Capabilities (identical to the platform Sticky.io adapter):
 *   publish         : card_charge, subscription, saved_payment_method,
 *                     paypal_wallet, refund, order_bump, address_validation
 *   render          : (none)
 *   runtimeFallback : sca_3ds_fallback
 *
 * Section config (rides in `chargeTarget.metadata`): campaignId, productId,
 * billingModelId, offerId, shippingId.
 */

import type { OrderSummary } from "@/lib/checkout-types";
import { checkoutProxy } from "../proxy";
import { buildCapabilities } from "../capabilities";
import { summarizeChargeTarget } from "./crm-shared";
import type {
  CheckoutProcessorAdapter,
  ChargeInitialInput,
  ChargeInitialResult,
} from "../types";

const STICKYIO_CAPABILITIES = buildCapabilities(
  [
    "card_charge",
    "subscription",
    "saved_payment_method",
    "paypal_wallet",
    "refund",
    "order_bump",
    "address_validation",
  ],
  [],
  ["sca_3ds_fallback"],
);

async function chargeInitial(
  input: ChargeInitialInput,
): Promise<ChargeInitialResult> {
  const r = await checkoutProxy<{
    orderId?: string;
    declineReason?: string;
    requiresAction?: boolean;
    clientSecret?: string;
    returnUrl?: string;
  }>(
    "stickyio",
    "charge-initial",
    {
      idempotencyKey: input.idempotencyKey,
      currency: input.chargeTarget.currency,
      lineItems: input.chargeTarget.lineItems,
      totalCents: input.chargeTarget.totalCents,
      // Sticky.io campaignId/productId/billingModelId/offerId/shippingId ride
      // in chargeTarget.metadata.
      metadata: input.chargeTarget.metadata,
      customer: input.customer,
    },
    (j) =>
      j as {
        orderId?: string;
        declineReason?: string;
        requiresAction?: boolean;
        clientSecret?: string;
        returnUrl?: string;
      },
    "Could not process your payment.",
  );

  if (r.demo) return { status: "demo" };

  // runtimeFallback: 3DS continuation surfaced by Sticky.io's gateway.
  if (r.data?.requiresAction && r.data.clientSecret) {
    return {
      status: "requires_action",
      clientSecret: r.data.clientSecret,
      ...(r.data.returnUrl ? { returnUrl: r.data.returnUrl } : {}),
    };
  }

  if (r.ok && r.data?.orderId) {
    const order: OrderSummary = summarizeChargeTarget(
      r.data.orderId,
      input.customer.email,
      input.chargeTarget,
    );
    return { status: "succeeded", processorOrderId: r.data.orderId, order };
  }

  const reason = (r.data?.declineReason || r.error || "").toLowerCase();
  const declined =
    r.httpStatus === 402 ||
    reason.includes("declin") ||
    reason.includes("insufficient") ||
    reason.includes("expired");
  return {
    status: "failed",
    errorCode: declined ? "card_declined" : "upstream_error",
    userMessage: declined
      ? "Your card was declined. Please try a different payment method."
      : r.error || "We couldn't process your payment right now. Please try again in a moment.",
  };
}

export const stickyioAdapter: CheckoutProcessorAdapter = {
  kind: "stickyio",
  capabilities: STICKYIO_CAPABILITIES,
  chargeInitial,
};
