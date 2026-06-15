/**
 * Checkout processor capabilities — PURE TWIN (no network, no SDK).
 *
 * Mirrors the Delegate platform's
 * `lib/integrations/checkout/capabilities-kind.ts`. Defines the closed set of
 * capability tokens a processor can advertise, and the three-class shape used
 * to gate sections at publish / render / mid-charge time.
 *
 * This module is safe to import from any client component — it has no runtime
 * dependencies. Adapters declare their capabilities with this shape; the
 * checkout UI reads them to decide which sections to render and how to degrade.
 *
 * Three-class semantics:
 *   1. publish         — required to render a section AT ALL. A section that
 *                        needs a publish-class capability the processor lacks
 *                        should be hidden (the editor would reject it at
 *                        publish time on the platform).
 *   2. render          — browser feature-detected (e.g. `apple_pay` via
 *                        `PaymentRequest.canMakePayment()`). Degrades
 *                        gracefully; never blocks.
 *   3. runtimeFallback — mid-charge contingency (e.g. `sca_3ds_fallback`). The
 *                        adapter MUST return a structured `requires_action`
 *                        result instead of throwing.
 *
 * Invariant: the SAME capability token must NOT appear in more than one class
 * for a given processor.
 */

/** Closed set of capability tokens a processor adapter can advertise. */
export const CAPABILITIES = [
  "card_charge",
  "subscription",
  "saved_payment_method",
  "apple_pay",
  "google_pay",
  "paypal_wallet",
  "sca_3ds_fallback",
  "refund",
  "order_bump",
  "address_validation",
] as const;

export type Capability = (typeof CAPABILITIES)[number];

/** Three-class capability shape declared by every adapter. */
export interface CheckoutProcessorCapabilities {
  /** Required to render a section at all. */
  publish: ReadonlySet<Capability>;
  /** Browser feature-detected; degrades gracefully when absent. */
  render: ReadonlySet<Capability>;
  /** Mid-charge contingency the adapter must handle structurally. */
  runtimeFallback: ReadonlySet<Capability>;
}

/** True iff the processor advertises `capability` as a PUBLISH-class capability. */
export function hasPublishCapability(
  caps: CheckoutProcessorCapabilities,
  capability: Capability,
): boolean {
  return caps.publish.has(capability);
}

/** True iff the processor advertises `capability` as a RENDER-class capability. */
export function hasRenderCapability(
  caps: CheckoutProcessorCapabilities,
  capability: Capability,
): boolean {
  return caps.render.has(capability);
}

/** True iff the processor advertises `capability` as a RUNTIME-FALLBACK capability. */
export function hasRuntimeFallbackCapability(
  caps: CheckoutProcessorCapabilities,
  capability: Capability,
): boolean {
  return caps.runtimeFallback.has(capability);
}

/** Convenience builder so adapters declare capabilities in one expression. */
export function buildCapabilities(
  publish: Capability[],
  render: Capability[] = [],
  runtimeFallback: Capability[] = [],
): CheckoutProcessorCapabilities {
  return {
    publish: new Set(publish),
    render: new Set(render),
    runtimeFallback: new Set(runtimeFallback),
  };
}
