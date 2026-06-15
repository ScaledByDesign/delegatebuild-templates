/**
 * OmniCart commerce client.
 *
 * OmniCart is the whitelabel commerce brand used across the storefront.
 * Internally it is powered by the Medusa commerce framework — this module
 * wraps the `@medusajs/medusa-js` SDK and exposes it under OmniCart naming so
 * the rest of the app never references the underlying framework directly.
 *
 * All store calls go through the app's own Worker proxy at `/api/omnicart/*`
 * (see worker/userRoutes.ts) so the publishable key / backend URL stay on the
 * server and CORS is handled centrally.
 */
import Medusa from "@medusajs/medusa-js";

// The OmniCart client points at our same-origin Worker proxy, which forwards
// to the configured OmniCart (Medusa) backend. This keeps secrets server-side.
export const omnicart = new Medusa({
  baseUrl: "/api/omnicart",
  maxRetries: 2,
});

/** OmniCart cart shape (subset of the framework cart we rely on in the UI). */
export interface OmniCartLineItem {
  id: string;
  title: string;
  quantity: number;
  unit_price: number;
  thumbnail?: string | null;
  variant?: { id: string; title: string } | null;
}

export interface OmniCart {
  id: string;
  email?: string | null;
  region_id?: string;
  currency_code?: string;
  items: OmniCartLineItem[];
  subtotal?: number;
  shipping_total?: number;
  tax_total?: number;
  total?: number;
  shipping_address?: Record<string, unknown> | null;
  payment_session?: { provider_id: string; data: Record<string, unknown> } | null;
}

/** Format minor-unit amounts (e.g. cents) using the cart currency. */
export function formatAmount(amount = 0, currencyCode = "usd"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode.toUpperCase(),
  }).format(amount / 100);
}
