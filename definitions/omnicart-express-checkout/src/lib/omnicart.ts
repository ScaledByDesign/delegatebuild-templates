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
 * An applied promotion (coupon/promo code) on the cart. This mirrors the
 * OmniCart (Medusa v2) `StoreCartPromotion` shape returned in the cart's
 * `promotions` array. The per-promotion discount amount is NOT on this object
 * in v2 — the cart-level `discount_total` is the source of truth for how much
 * was discounted. `application_method` describes how the promotion applies
 * (`fixed`/`percentage`, target `items`/`shipping_methods`/`order`).
 */
export interface OmniCartPromotion {
  id: string;
  code?: string;
  /** True when applied automatically (no code entered by the customer). */
  is_automatic?: boolean;
  application_method?: {
    type?: "fixed" | "percentage";
    target_type?: "items" | "shipping_methods" | "order";
    value?: number;
    currency_code?: string;
  } | null;
}

export interface OmniCart {
  id: string;
  email?: string | null;
  region_id?: string;
  currency_code?: string;
  items: OmniCartLineItem[];
  // OmniCart (Medusa v2) cart totals (minor units). See:
  // docs.medusajs.com/resources/storefront-development/cart/totals
  subtotal?: number; // before discounts, excluding taxes
  shipping_total?: number; // shipping after discounts, incl. taxes
  tax_total?: number; // tax after discounts
  discount_total?: number; // total discounts applied (incl. tax portion)
  total?: number; // final total after discounts + taxes
  /** Applied promotions/coupon codes (empty when none). */
  promotions?: OmniCartPromotion[];
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

/** Result of applying/removing a promotion (coupon) code to a cart. */
export interface DiscountResult {
  ok: boolean;
  /** The updated cart (when the backend is wired). */
  cart?: OmniCart;
  /** Human-readable error (e.g. invalid/expired code) when `ok` is false. */
  error?: string;
}

/**
 * Apply a coupon/promo code to a cart using the OmniCart (Medusa v2) promotions
 * API, via the Worker proxy:
 *
 *   POST /api/omnicart/carts/:id/promotions   body: { promo_codes: [code] }
 *
 * The proxy forwards to `${OMNICART_BACKEND_URL}/store/carts/:id/promotions`
 * with the publishable key attached server-side. The backend re-validates the
 * code and re-prices the cart, so the returned cart's `promotions[]` and
 * `discount_total`/`total` are authoritative (anti-tamper).
 *
 * Ref: docs.medusajs.com/resources/storefront-development/cart/manage-promotions
 */
export async function applyDiscount(cartId: string, code: string): Promise<DiscountResult> {
  try {
    const res = await fetch(`/api/omnicart/carts/${encodeURIComponent(cartId)}/promotions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ promo_codes: [code] }),
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
 * Remove a previously applied promotion (coupon) code. In Medusa v2 the code is
 * passed in the request body (an array), NOT as a path parameter:
 *
 *   DELETE /api/omnicart/carts/:id/promotions   body: { promo_codes: [code] }
 */
export async function removeDiscount(cartId: string, code: string): Promise<DiscountResult> {
  try {
    const res = await fetch(`/api/omnicart/carts/${encodeURIComponent(cartId)}/promotions`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ promo_codes: [code] }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      cart?: OmniCart;
      message?: string;
      error?: string;
    };
    if (!res.ok) {
      return { ok: false, error: json.message || json.error || "Could not remove code." };
    }
    return { ok: true, cart: json.cart };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not remove code." };
  }
}
