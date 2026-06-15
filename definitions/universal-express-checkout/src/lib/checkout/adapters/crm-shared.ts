/**
 * Shared helpers for CRM-class checkout adapters (Konnektive, Sticky.io).
 *
 * CRM platforms own the order lifecycle and don't return a Medusa-shaped order
 * object, so the adapter synthesizes the universal `OrderSummary` from the
 * authoritative `ChargeTarget` the page built, stamped with the CRM's returned
 * order id. Totals come from `chargeTarget.totalCents`; line items are mapped
 * 1:1 from the charge's line items.
 */

import type { OmniCartLineItem } from "@/lib/omnicart";
import type { OrderSummary } from "@/lib/checkout-types";
import type { ChargeTarget } from "../types";

/**
 * Build an `OrderSummary` from a CRM charge result. The CRM returns only an
 * order id; the rest of the summary is derived from the charge target the page
 * already validated, so the confirmation screen renders consistently across
 * payment-class and CRM-class processors.
 */
export function summarizeChargeTarget(
  orderId: string,
  email: string,
  chargeTarget: ChargeTarget,
): OrderSummary {
  const items: OmniCartLineItem[] = chargeTarget.lineItems.map((li, i) => ({
    id: `${orderId}_${i}`,
    title: li.title ?? li.sku ?? li.priceId,
    quantity: li.quantity,
    unit_price: li.unitPriceCents,
    thumbnail: null,
    variant: { id: li.priceId, title: li.title ?? "" },
  }));
  const subtotal = items.reduce((s, i) => s + i.unit_price * i.quantity, 0);
  return {
    id: orderId,
    email,
    subtotal,
    shipping_total: 0,
    tax_total: Math.max(0, chargeTarget.totalCents - subtotal),
    discount_total: 0,
    total: chargeTarget.totalCents,
    currency_code: chargeTarget.currency.toLowerCase(),
    items,
    promotions: [],
  };
}
