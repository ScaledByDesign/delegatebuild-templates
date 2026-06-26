/**
 * Checkout Champ adapter (template / client-side variant).
 *
 * Mirrors the Delegate platform's
 * `lib/integrations/checkout/checkoutchamp.ts` capability declaration and
 * single-call charge model. Checkout Champ is a CRM-class processor that
 * owns the full order lifecycle and charges in ONE call against
 * `/api/checkout/import-order`. There is NO two-call browser flow, so this
 * adapter omits `initPayment`; the page goes straight to `chargeInitial`.
 *
 * The browser posts the order to the Worker proxy
 * (`/api/checkout/checkoutchamp/charge-initial`); the proxy forwards to
 * Checkout Champ with server-side credentials and returns the resulting
 * order id (or a structured decline). No backend wired →
 * `503 { demo: true }` → `{ status: "demo" }`.
 *
 * Capabilities (identical to the platform Checkout Champ adapter):
 *   publish         : card_charge, subscription, saved_payment_method,
 *                     paypal_wallet, refund, order_bump
 *   render          : (none)
 *   runtimeFallback : (none) — Checkout Champ owns 3DS in its gateway.
 *
 * Closes the F3e (Funnels Unification — processor adapters) gap so the
 * platform's `TEMPLATE_SUPPORTED_PROCESSORS` set can include "checkoutchamp"
 * without dropping into permanent demo mode.
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

const CHECKOUTCHAMP_CAPABILITIES = buildCapabilities(
  [
    "card_charge",
    "subscription",
    "saved_payment_method",
    "paypal_wallet",
    "refund",
    "order_bump",
  ],
  [],
  [],
);

async function chargeInitial(
  input: ChargeInitialInput,
): Promise<ChargeInitialResult> {
  const r = await checkoutProxy<{ orderId?: string; declineReason?: string }>(
    "checkoutchamp",
    "charge-initial",
    {
      idempotencyKey: input.idempotencyKey,
      currency: input.chargeTarget.currency,
      lineItems: input.chargeTarget.lineItems,
      totalCents: input.chargeTarget.totalCents,
      // campaignId / productId / billingModelId / shippingId ride in metadata.
      metadata: input.chargeTarget.metadata,
      customer: input.customer,
    },
    (j) => j as { orderId?: string; declineReason?: string },
    "Could not process your payment.",
  );

  if (r.demo) return { status: "demo" };

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
      : r.error ||
        "We couldn't process your payment right now. Please try again in a moment.",
  };
}

export const checkoutChampAdapter: CheckoutProcessorAdapter = {
  kind: "checkoutchamp",
  capabilities: CHECKOUTCHAMP_CAPABILITIES,
  chargeInitial,
};
