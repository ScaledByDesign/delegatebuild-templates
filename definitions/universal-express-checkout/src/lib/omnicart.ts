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

/** A postal address on the cart (shipping or billing). Mirrors the v2 shape. */
export interface OmniCartAddress {
  first_name?: string;
  last_name?: string;
  phone?: string;
  address_1?: string;
  address_2?: string;
  company?: string;
  postal_code?: string;
  city?: string;
  province?: string;
  country_code?: string;
}

/** A shipping method applied to the cart (OmniCart/Medusa v2). */
export interface OmniCartShippingMethod {
  id?: string;
  shipping_option_id?: string;
  name?: string;
  amount?: number;
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
  shipping_address?: OmniCartAddress | null;
  billing_address?: OmniCartAddress | null;
  shipping_methods?: OmniCartShippingMethod[];
  /** Set once a payment collection has been created for the cart. */
  payment_collection?: OmniCartPaymentCollection | null;
  payment_session?: { provider_id: string; data: Record<string, unknown> } | null;
}

/**
 * A shipping option returned by the OmniCart (Medusa v2) fulfillment module for
 * a given cart. `price_type` is `"flat"` (amount is final) or `"calculated"`
 * (amount must be resolved via the calculate endpoint per provider).
 */
export interface OmniShippingOption {
  id: string;
  name: string;
  amount?: number;
  price_type?: "flat" | "calculated";
}

/** A payment provider available for the cart's region (e.g. `pp_stripe_*`). */
export interface OmniPaymentProvider {
  id: string;
  is_enabled?: boolean;
}

/** A single payment session within a payment collection. */
export interface OmniPaymentSession {
  id: string;
  provider_id: string;
  status?: string;
  /** Provider data — e.g. Stripe's `client_secret` for confirming on-page. */
  data?: Record<string, unknown> & { client_secret?: string };
}

/** A payment collection bound to a cart; holds the initialized sessions. */
export interface OmniCartPaymentCollection {
  id: string;
  amount?: number;
  currency_code?: string;
  payment_sessions?: OmniPaymentSession[];
}

/** A completed order returned by the cart-completion endpoint. */
export interface OmniOrder {
  id: string;
  display_id?: number;
  email?: string;
  currency_code?: string;
  items?: OmniCartLineItem[];
  subtotal?: number;
  shipping_total?: number;
  tax_total?: number;
  discount_total?: number;
  total?: number;
  created_at?: string;
  shipping_address?: OmniCartAddress | null;
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

// ── OmniCart (Medusa v2) cart lifecycle ──────────────────────────────────────
//
// The functions below wrap the v2 Store API cart lifecycle used by the express
// checkout. Every call goes through the Worker proxy (`/api/omnicart/*` →
// `${OMNICART_BACKEND_URL}/store/*`), which attaches the publishable key
// server-side. The backend is always the source of truth for pricing and
// inventory (anti-tamper).
//
// When no backend is configured, the proxy short-circuits with
// `503 { demo: true }` so the page can fall back to its in-template demo state.
// Every helper surfaces that as `{ ok: false, demo: true }` (never an error
// toast) so the caller can branch cleanly.
//
// Endpoint map (all relative to the proxy base `/api/omnicart`, i.e. `/store`):
//   POST   /carts                                   { region_id }            -> { cart }
//   GET    /carts/:id                                                        -> { cart }
//   POST   /carts/:id/line-items                     { variant_id, quantity } -> { cart }
//   POST   /carts/:id/line-items/:line_id            { quantity }             -> { cart }
//   DELETE /carts/:id/line-items/:line_id                                     -> { parent }
//   POST   /carts/:id                                { email, *_address }     -> { cart }
//   GET    /shipping-options?cart_id=:id                                      -> { shipping_options }
//   POST   /carts/:id/shipping-methods               { option_id, data }      -> { cart }
//   GET    /payment-providers?region_id=:rid                                  -> { payment_providers }
//   POST   /payment-collections                      { cart_id }              -> { payment_collection }
//   POST   /payment-collections/:id/payment-sessions { provider_id }          -> { payment_collection }
//   POST   /carts/:id/complete                                                -> { type, order? , cart?, error? }
// Ref: docs.medusajs.com/resources/storefront-development/guides/express-checkout

/**
 * Generic result for a v2 lifecycle call. `ok` indicates success; `demo` is
 * set when the backend isn't configured (the proxy returned `503 { demo:true }`)
 * so the caller should use its demo fallback rather than show an error.
 */
export interface BackendResult<T> {
  ok: boolean;
  data?: T;
  /** True when no backend is wired (proxy 503 demo signal). */
  demo?: boolean;
  error?: string;
}

const OMNI_BASE = "/api/omnicart";
const seg = (s: string) => encodeURIComponent(s);

/**
 * Core request helper for the v2 lifecycle. Performs the fetch, decodes the
 * `503 { demo: true }` signal, and normalizes errors. `pick` maps the decoded
 * JSON body to the value the caller wants (e.g. `(j) => j.cart`).
 */
async function omniRequest<T>(
  path: string,
  init: RequestInit,
  pick: (json: Record<string, unknown>) => T | undefined,
  fallbackError: string,
): Promise<BackendResult<T>> {
  try {
    const res = await fetch(`${OMNI_BASE}${path}`, {
      ...init,
      headers: { "content-type": "application/json", ...(init.headers || {}) },
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown> & {
      demo?: boolean;
      message?: string;
      error?: string | { message?: string };
    };
    // No backend wired: the proxy returns 503 { demo: true }. Signal the caller
    // to use its demo fallback instead of surfacing an error.
    if (res.status === 503 && json.demo) return { ok: false, demo: true };
    if (!res.ok) {
      const errMsg =
        typeof json.error === "object" ? json.error?.message : (json.error as string | undefined);
      return { ok: false, error: json.message || errMsg || fallbackError };
    }
    return { ok: true, data: pick(json) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : fallbackError };
  }
}

/** Create a new cart in a region. POST /carts { region_id } -> { cart }. */
export function createCart(regionId?: string): Promise<BackendResult<OmniCart>> {
  return omniRequest<OmniCart>(
    `/carts`,
    { method: "POST", body: JSON.stringify(regionId ? { region_id: regionId } : {}) },
    (j) => j.cart as OmniCart | undefined,
    "Could not create cart.",
  );
}

/** Retrieve a cart by id. GET /carts/:id -> { cart }. */
export function retrieveCart(cartId: string): Promise<BackendResult<OmniCart>> {
  return omniRequest<OmniCart>(
    `/carts/${seg(cartId)}`,
    { method: "GET" },
    (j) => j.cart as OmniCart | undefined,
    "Could not load cart.",
  );
}

/** Add a variant to the cart. POST /carts/:id/line-items -> { cart }. */
export function addLineItem(
  cartId: string,
  variantId: string,
  quantity: number,
): Promise<BackendResult<OmniCart>> {
  return omniRequest<OmniCart>(
    `/carts/${seg(cartId)}/line-items`,
    { method: "POST", body: JSON.stringify({ variant_id: variantId, quantity }) },
    (j) => j.cart as OmniCart | undefined,
    "Could not add item.",
  );
}

/** Update a line item's quantity. POST /carts/:id/line-items/:line_id -> { cart }. */
export function updateLineItem(
  cartId: string,
  lineId: string,
  quantity: number,
): Promise<BackendResult<OmniCart>> {
  return omniRequest<OmniCart>(
    `/carts/${seg(cartId)}/line-items/${seg(lineId)}`,
    { method: "POST", body: JSON.stringify({ quantity }) },
    (j) => j.cart as OmniCart | undefined,
    "Could not update item.",
  );
}

/**
 * Remove a line item. DELETE /carts/:id/line-items/:line_id. NOTE: in v2 the
 * delete response returns the updated cart under the `parent` field, not `cart`.
 */
export function removeLineItem(
  cartId: string,
  lineId: string,
): Promise<BackendResult<OmniCart>> {
  return omniRequest<OmniCart>(
    `/carts/${seg(cartId)}/line-items/${seg(lineId)}`,
    { method: "DELETE" },
    (j) => (j.parent as OmniCart | undefined) ?? (j.cart as OmniCart | undefined),
    "Could not remove item.",
  );
}

/**
 * Set the customer email + shipping/billing address on the cart.
 * POST /carts/:id { email?, shipping_address?, billing_address? } -> { cart }.
 */
export function updateCartContact(
  cartId: string,
  data: { email?: string; shipping_address?: OmniCartAddress; billing_address?: OmniCartAddress },
): Promise<BackendResult<OmniCart>> {
  return omniRequest<OmniCart>(
    `/carts/${seg(cartId)}`,
    { method: "POST", body: JSON.stringify(data) },
    (j) => j.cart as OmniCart | undefined,
    "Could not save your details.",
  );
}

/**
 * List shipping options available for the cart.
 * GET /shipping-options?cart_id=:id -> { shipping_options }.
 */
export function listShippingOptions(
  cartId: string,
): Promise<BackendResult<OmniShippingOption[]>> {
  return omniRequest<OmniShippingOption[]>(
    `/shipping-options?cart_id=${seg(cartId)}`,
    { method: "GET" },
    (j) => (j.shipping_options as OmniShippingOption[] | undefined) ?? [],
    "Could not load shipping options.",
  );
}

/**
 * Add the chosen shipping method to the cart.
 * POST /carts/:id/shipping-methods { option_id, data } -> { cart }.
 * `data` carries fulfillment-provider-specific payload (usually empty).
 */
export function addShippingMethod(
  cartId: string,
  optionId: string,
  data: Record<string, unknown> = {},
): Promise<BackendResult<OmniCart>> {
  return omniRequest<OmniCart>(
    `/carts/${seg(cartId)}/shipping-methods`,
    { method: "POST", body: JSON.stringify({ option_id: optionId, data }) },
    (j) => j.cart as OmniCart | undefined,
    "Could not set shipping method.",
  );
}

/**
 * List payment providers for a region.
 * GET /payment-providers?region_id=:rid -> { payment_providers }.
 */
export function listPaymentProviders(
  regionId: string,
): Promise<BackendResult<OmniPaymentProvider[]>> {
  return omniRequest<OmniPaymentProvider[]>(
    `/payment-providers?region_id=${seg(regionId)}`,
    { method: "GET" },
    (j) => (j.payment_providers as OmniPaymentProvider[] | undefined) ?? [],
    "Could not load payment methods.",
  );
}

/**
 * Create a payment collection for the cart.
 * POST /payment-collections { cart_id } -> { payment_collection }.
 */
export function createPaymentCollection(
  cartId: string,
): Promise<BackendResult<OmniCartPaymentCollection>> {
  return omniRequest<OmniCartPaymentCollection>(
    `/payment-collections`,
    { method: "POST", body: JSON.stringify({ cart_id: cartId }) },
    (j) => j.payment_collection as OmniCartPaymentCollection | undefined,
    "Could not start payment.",
  );
}

/**
 * Initialize a payment session within a payment collection.
 * POST /payment-collections/:id/payment-sessions { provider_id }
 *   -> { payment_collection } (with the initialized session, incl. any
 *      provider `client_secret` under session.data for on-page confirmation).
 */
export function initPaymentSession(
  paymentCollectionId: string,
  providerId: string,
): Promise<BackendResult<OmniCartPaymentCollection>> {
  return omniRequest<OmniCartPaymentCollection>(
    `/payment-collections/${seg(paymentCollectionId)}/payment-sessions`,
    { method: "POST", body: JSON.stringify({ provider_id: providerId }) },
    (j) => j.payment_collection as OmniCartPaymentCollection | undefined,
    "Could not initialize payment.",
  );
}

/** Result of completing a cart: either a placed order, or a cart-level error. */
export interface CompleteResult {
  ok: boolean;
  /** The placed order when completion succeeds. */
  order?: OmniOrder;
  /** True when no backend is wired (demo fallback). */
  demo?: boolean;
  /** Cart-level error (e.g. payment not authorized, out of stock). */
  error?: string;
}

/**
 * Complete the cart and place the order.
 * POST /carts/:id/complete -> on success `{ type: "order", order }`; on a
 * recoverable failure `{ type: "cart", error, cart }`.
 */
export async function completeCart(cartId: string): Promise<CompleteResult> {
  try {
    const res = await fetch(`${OMNI_BASE}/carts/${seg(cartId)}/complete`, {
      method: "POST",
      headers: { "content-type": "application/json" },
    });
    const json = (await res.json().catch(() => ({}))) as {
      type?: "order" | "cart";
      order?: OmniOrder;
      error?: string | { message?: string };
      message?: string;
      demo?: boolean;
    };
    if (res.status === 503 && json.demo) return { ok: false, demo: true };
    if (json.type === "order" && json.order) return { ok: true, order: json.order };
    const errMsg =
      typeof json.error === "object" ? json.error?.message : (json.error as string | undefined);
    return { ok: false, error: json.message || errMsg || "We could not complete your order." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "We could not complete your order." };
  }
}
