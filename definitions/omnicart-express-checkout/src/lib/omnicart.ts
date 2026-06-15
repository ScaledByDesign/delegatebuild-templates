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

/**
 * An applied discount/coupon code on the cart. OmniCart (Medusa) returns a
 * `discounts` array; we surface the slice the UI needs to render a removable
 * "Discount" row. `amount` is the resolved minor-unit value off this cart.
 */
export interface OmniCartDiscount {
  id: string;
  code: string;
  amount: number; // minor units (e.g. cents) discounted on this cart
  is_dynamic?: boolean;
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
  discount_total?: number;
  /** Applied coupon/promo codes (empty when none). */
  discounts?: OmniCartDiscount[];
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

/** Result of applying/removing a coupon code to a cart. */
export interface DiscountResult {
  ok: boolean;
  /** The updated cart (when the backend is wired). */
  cart?: OmniCart;
  /** Human-readable error (e.g. invalid/expired code) when `ok` is false. */
  error?: string;
}

/**
 * Apply a coupon/promo code to a cart via the Worker proxy
 * (`POST /api/omnicart/carts/:id/discounts`), which forwards to the OmniCart
 * (Medusa) backend. The backend re-validates and re-prices the cart, so the
 * returned cart's `discount_total`/`total` are authoritative.
 */
export async function applyDiscount(cartId: string, code: string): Promise<DiscountResult> {
  try {
    const res = await fetch(`/api/omnicart/carts/${encodeURIComponent(cartId)}/discounts`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      cart?: OmniCart;
      message?: string;
      error?: string;
    };
    if (!res.ok) {
      return { ok: false, error: json.message || json.error || "That code isn’t valid." };
    }
    return { ok: true, cart: json.cart };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not apply code." };
  }
}

/**
 * Remove a previously applied coupon code via the Worker proxy
 * (`DELETE /api/omnicart/carts/:id/discounts/:code`).
 */
export async function removeDiscount(cartId: string, code: string): Promise<DiscountResult> {
  try {
    const res = await fetch(
      `/api/omnicart/carts/${encodeURIComponent(cartId)}/discounts/${encodeURIComponent(code)}`,
      { method: "DELETE" },
    );
    const json = (await res.json().catch(() => ({}))) as { cart?: OmniCart; error?: string };
    if (!res.ok) {
      return { ok: false, error: json.error || "Could not remove code." };
    }
    return { ok: true, cart: json.cart };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not remove code." };
  }
}
