/**
 * ClickBank adapter (template / client-side variant).
 *
 * Mirrors the Delegate platform's `lib/integrations/checkout/clickbank.ts` —
 * ClickBank is a hosted-checkout marketplace. Vendors send buyers to a
 * ClickBank-hosted pitch page; there is NO public initial-buy API the
 * storefront can call directly. The platform adapter exposes the kind so
 * funnels can route attribution and post-purchase upsell rules through
 * Delegate, but `chargeInitial` always returns `not_configured` because the
 * order is completed off-template.
 *
 * Capabilities (identical to the platform ClickBank adapter):
 *   publish         : (none — no on-site charge primitives)
 *   render          : (none)
 *   runtimeFallback : (none)
 *
 * Closes the F3e (Funnels Unification — processor adapters) gap so the
 * platform's `TEMPLATE_SUPPORTED_PROCESSORS` set can include "clickbank"
 * (the generated app still ships, but the checkout page is expected to
 * redirect to the ClickBank pitch URL).
 */

import { buildCapabilities } from "../capabilities";
import type {
  CheckoutProcessorAdapter,
  ChargeInitialInput,
  ChargeInitialResult,
} from "../types";

const CLICKBANK_CAPABILITIES = buildCapabilities([], [], []);

async function chargeInitial(
  _input: ChargeInitialInput,
): Promise<ChargeInitialResult> {
  return {
    status: "failed",
    errorCode: "not_configured",
    userMessage:
      "ClickBank checkouts are completed on ClickBank's hosted pitch page. Please contact the merchant.",
  };
}

export const clickbankAdapter: CheckoutProcessorAdapter = {
  kind: "clickbank",
  capabilities: CLICKBANK_CAPABILITIES,
  chargeInitial,
};
