/**
 * UltraCart checkout adapter (template / client-side variant).
 *
 * Mirrors the Delegate platform's `lib/integrations/checkout/ultracart.ts`
 * capability declaration and single-call charge model. UltraCart is a
 * CRM-class processor that owns the full order lifecycle and charges in ONE
 * call against `/order`. There is NO two-call browser flow, so this adapter
 * omits `initPayment`; the page goes straight to `chargeInitial`.
 *
 * The browser posts the order to the Worker proxy
 * (`/api/checkout/ultracart/charge-initial`); the proxy forwards to UltraCart
 * with server-side credentials and returns the resulting order id (or a
 * structured decline). No backend wired → `503 { demo: true }` →
 * `{ status: "demo" }`.
 *
 * Capabilities (identical to the platform UltraCart adapter):
 *   publish         : card_charge, subscription (auto-orders),
 *                     saved_payment_method, paypal_wallet, refund,
 *                     order_bump, address_validation
 *   render          : (none)
 *   runtimeFallback : (none) — UltraCart's gateway pipeline owns 3DS upstream.
 *
 * Closes the F3e (Funnels Unification — processor adapters) gap so the
 * platform's `TEMPLATE_SUPPORTED_PROCESSORS` set can include "ultracart"
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

const ULTRACART_CAPABILITIES = buildCapabilities(
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
  [],
);

async function chargeInitial(
  input: ChargeInitialInput,
): Promise<ChargeInitialResult> {
  const r = await checkoutProxy<{ orderId?: string; declineReason?: string }>(
    "ultracart",
    "charge-initial",
    {
      idempotencyKey: input.idempotencyKey,
      currency: input.chargeTarget.currency,
      lineItems: input.chargeTarget.lineItems,
      totalCents: input.chargeTarget.totalCents,
      // UltraCart merchant_item_id + storefront oid ride in metadata.
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

export const ultracartAdapter: CheckoutProcessorAdapter = {
  kind: "ultracart",
  capabilities: ULTRACART_CAPABILITIES,
  chargeInitial,
};
