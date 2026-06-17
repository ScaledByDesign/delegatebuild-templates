/**
 * OmniCart commerce client.
 *
 * OmniCart is the whitelabel commerce brand used across the storefront, powered
 * internally by Medusa v2. This module talks to the OmniCart (Medusa v2) Store
 * API through the OFFICIAL `@medusajs/js-sdk` and exposes it under OmniCart
 * naming, so the rest of the app never references the underlying framework.
 *
 * DUAL-MODE CONNECTION (configurable backend — Medusa Cloud OR self-hosted):
 *   • DEFAULT — same-origin Worker proxy. The SDK targets `${origin}/api/omnicart`,
 *     which the app's OWN Worker forwards to the configured backend server-side
 *     (attaching the publishable key). The browser holds no backend URL/key, CORS
 *     is centralized, and when no backend is wired the Worker returns 503 so the
 *     UI degrades to demo mode. Never routes through the Delegate platform (CORE).
 *   • OVERRIDE — direct to a merchant's own Medusa (self-hosted or Medusa Cloud).
 *     Set `VITE_OMNICART_BACKEND_URL` to an ABSOLUTE backend URL (and
 *     `VITE_OMNICART_PUBLISHABLE_KEY`, which Medusa designs to be browser-safe)
 *     to have the SDK connect straight to that backend. Requires `store_cors` on
 *     the Medusa backend to allow the storefront origin.
 *
 * Either way the backend is the Medusa store itself — NOT CORE — so a platform
 * outage can never break the cart lifecycle.
 */
import Medusa, { FetchError } from "@medusajs/js-sdk";
import type { HttpTypes } from "@medusajs/types";

// Resolve config from the RUNTIME window globals first (the platform injects
// `window.VITE_*` at deploy, which is how credentials arrive when a workspace is
// linked AFTER the app was built — build-time `import.meta.env` would be empty in
// that case), then fall back to build-time `import.meta.env` / `process.env`.
function readEnv(...keys: string[]): string {
  for (const key of keys) {
    if (typeof window !== "undefined") {
      const w = (window as unknown as Record<string, unknown>)[key];
      if (typeof w === "string" && w) return w;
    }
    if (typeof import.meta !== "undefined" && import.meta.env) {
      const v = (import.meta.env as Record<string, string | undefined>)[key];
      if (v) return v;
    }
    if (typeof process !== "undefined" && process.env && process.env[key]) {
      return process.env[key] as string;
    }
  }
  return "";
}

const CONFIGURED_BACKEND_URL = readEnv("VITE_OMNICART_BACKEND_URL", "OMNICART_BACKEND_URL");
const PUBLISHABLE_KEY = readEnv("VITE_OMNICART_PUBLISHABLE_KEY", "OMNICART_PUBLISHABLE_KEY");

/**
 * Resolve the SDK baseUrl for the browser. A CROSS-ORIGIN absolute URL cannot be
 * called directly from the browser unless the Medusa backend's `store_cors` allows
 * this origin; to avoid hard CORS failures by default, any cross-origin value is
 * collapsed back to the same-origin Worker proxy (`/api/omnicart`). Same-origin /
 * relative values are honored as-is.
 */
function resolveBaseUrl(): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost";
  const proxy = `${origin}/api/omnicart`;
  const configured = CONFIGURED_BACKEND_URL;
  if (!configured) return proxy;
  if (configured.startsWith("/")) return `${origin}${configured.replace(/\/$/, "")}`;
  try {
    const parsed = new URL(configured, origin);
    if (parsed.origin === origin) return parsed.toString().replace(/\/$/, "");
  } catch {
    return proxy;
  }
  if (typeof console !== "undefined") {
    console.warn(
      "OmniCart: cross-origin VITE_OMNICART_BACKEND_URL collapsed to the same-origin proxy (/api/omnicart) to avoid CORS. Configure the backend on the Worker (OMNICART_BACKEND_URL) for direct connections.",
    );
  }
  return proxy;
}

const RESOLVED_BASE_URL = resolveBaseUrl();
/** True when using the same-origin Worker proxy (no honored absolute override). */
const PROXY_MODE = RESOLVED_BASE_URL.endsWith("/api/omnicart");

let sdkInstance: Medusa | null = null;

/**
 * Lazily build the Medusa SDK client. The SDK requires an ABSOLUTE baseUrl but
 * preserves a path prefix, so `${origin}/api/omnicart` routes cleanly through the
 * Worker proxy while an honored absolute override connects straight to the backend.
 */
function client(): Medusa {
  if (sdkInstance) return sdkInstance;
  sdkInstance = new Medusa({
    baseUrl: RESOLVED_BASE_URL,
    // In proxy mode the Worker injects the publishable key server-side; in
    // override mode the SDK sends the (browser-safe) key itself.
    ...(PUBLISHABLE_KEY ? { publishableKey: PUBLISHABLE_KEY } : {}),
  });
  return sdkInstance;
}

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

// ── SDK → OmniCart mappers ───────────────────────────────────────────────────
// The SDK returns rich, fully-typed Medusa v2 entities; the UI only needs the
// slim OmniCart shapes above. These map one to the other (no `any`, no casts).

/** Structural subset shared by cart + order line items. */
interface LineItemLike {
  id: string;
  title: string;
  quantity: number;
  unit_price: number;
  thumbnail?: string | null;
  variant_id?: string;
  variant_title?: string;
  product_title?: string;
}

function toLineItem(li: LineItemLike): OmniCartLineItem {
  return {
    id: li.id,
    title: li.title,
    quantity: li.quantity,
    unit_price: li.unit_price,
    thumbnail: li.thumbnail ?? null,
    variant: {
      id: li.variant_id ?? li.id,
      title: li.variant_title ?? li.product_title ?? li.title,
    },
  };
}

function toAddress(a: HttpTypes.StoreCartAddress): OmniCartAddress {
  return {
    first_name: a.first_name ?? undefined,
    last_name: a.last_name ?? undefined,
    phone: a.phone ?? undefined,
    address_1: a.address_1 ?? undefined,
    address_2: a.address_2 ?? undefined,
    company: a.company ?? undefined,
    postal_code: a.postal_code ?? undefined,
    city: a.city ?? undefined,
    province: a.province ?? undefined,
    country_code: a.country_code ?? undefined,
  };
}

function toPromotion(p: HttpTypes.StoreCartPromotion): OmniCartPromotion {
  return { id: p.id ?? "", code: p.code ?? undefined, is_automatic: p.is_automatic ?? undefined };
}

function toPaymentSession(s: HttpTypes.StorePaymentSession): OmniPaymentSession {
  return {
    id: s.id,
    provider_id: s.provider_id,
    status: s.status,
    data: s.data as Record<string, unknown> & { client_secret?: string },
  };
}

function toPaymentCollection(pc: HttpTypes.StorePaymentCollection): OmniCartPaymentCollection {
  return {
    id: pc.id,
    amount: pc.amount,
    currency_code: pc.currency_code,
    payment_sessions: (pc.payment_sessions ?? []).map(toPaymentSession),
  };
}

function toCart(c: HttpTypes.StoreCart): OmniCart {
  return {
    id: c.id,
    email: c.email ?? null,
    region_id: c.region_id ?? undefined,
    currency_code: c.currency_code,
    items: (c.items ?? []).map(toLineItem),
    subtotal: c.subtotal,
    shipping_total: c.shipping_total,
    tax_total: c.tax_total,
    discount_total: c.discount_total,
    total: c.total,
    promotions: (c.promotions ?? []).map(toPromotion),
    shipping_address: c.shipping_address ? toAddress(c.shipping_address) : null,
    payment_collection: c.payment_collection ? toPaymentCollection(c.payment_collection) : null,
  };
}

function toOrder(o: HttpTypes.StoreOrder): OmniOrder {
  return {
    id: o.id,
    display_id: o.display_id,
    email: o.email ?? undefined,
    currency_code: o.currency_code,
    items: (o.items ?? []).map(toLineItem),
    subtotal: o.subtotal,
    shipping_total: o.shipping_total,
    tax_total: o.tax_total,
    discount_total: o.discount_total,
    total: o.total,
    shipping_address: o.shipping_address ? toAddress(o.shipping_address) : null,
  };
}

// ── Result envelopes ─────────────────────────────────────────────────────────

/**
 * Generic result for a v2 lifecycle call. `ok` indicates success; `demo` is
 * set when the backend isn't configured (proxy mode + the Worker returned 503)
 * so the caller should use its demo fallback rather than show an error.
 */
export interface BackendResult<T> {
  ok: boolean;
  data?: T;
  /** True when no backend is wired (proxy 503 demo signal). */
  demo?: boolean;
  error?: string;
}

/** Result of applying/removing a promotion (coupon) code to a cart. */
export interface DiscountResult {
  ok: boolean;
  /** The updated cart (when the backend is wired). */
  cart?: OmniCart;
  /** True when no backend is wired (demo fallback). */
  demo?: boolean;
  /** Human-readable error (e.g. invalid/expired code) when `ok` is false. */
  error?: string;
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
 * Map a thrown SDK error to the demo signal or a normalized message. In proxy
 * mode a 503 means "no backend wired" (the Worker's demo signal); otherwise it
 * is a genuine backend error.
 */
function isDemoError(e: unknown): boolean {
  return PROXY_MODE && e instanceof FetchError && e.status === 503;
}

function errorMessage(e: unknown, fallback: string): string {
  if (e instanceof FetchError) return e.message || fallback;
  return e instanceof Error ? e.message : fallback;
}

// ── OmniCart (Medusa v2) cart lifecycle (official js-sdk) ─────────────────────

/** Create a new cart in a region. */
export async function createCart(regionId?: string): Promise<BackendResult<OmniCart>> {
  try {
    const { cart } = await client().store.cart.create(regionId ? { region_id: regionId } : {});
    return { ok: true, data: toCart(cart) };
  } catch (e) {
    if (isDemoError(e)) return { ok: false, demo: true };
    return { ok: false, error: errorMessage(e, "Could not create cart.") };
  }
}

/** Retrieve a cart by id. */
export async function retrieveCart(cartId: string): Promise<BackendResult<OmniCart>> {
  try {
    const { cart } = await client().store.cart.retrieve(cartId);
    return { ok: true, data: toCart(cart) };
  } catch (e) {
    if (isDemoError(e)) return { ok: false, demo: true };
    return { ok: false, error: errorMessage(e, "Could not load cart.") };
  }
}

/** Add a variant to the cart. */
export async function addLineItem(
  cartId: string,
  variantId: string,
  quantity: number,
): Promise<BackendResult<OmniCart>> {
  try {
    const { cart } = await client().store.cart.createLineItem(cartId, {
      variant_id: variantId,
      quantity,
    });
    return { ok: true, data: toCart(cart) };
  } catch (e) {
    if (isDemoError(e)) return { ok: false, demo: true };
    return { ok: false, error: errorMessage(e, "Could not add item.") };
  }
}

/** Update a line item's quantity. */
export async function updateLineItem(
  cartId: string,
  lineId: string,
  quantity: number,
): Promise<BackendResult<OmniCart>> {
  try {
    const { cart } = await client().store.cart.updateLineItem(cartId, lineId, { quantity });
    return { ok: true, data: toCart(cart) };
  } catch (e) {
    if (isDemoError(e)) return { ok: false, demo: true };
    return { ok: false, error: errorMessage(e, "Could not update item.") };
  }
}

/** Remove a line item. The v2 delete response returns the updated cart as `parent`. */
export async function removeLineItem(
  cartId: string,
  lineId: string,
): Promise<BackendResult<OmniCart>> {
  try {
    const res = await client().store.cart.deleteLineItem(cartId, lineId);
    return { ok: true, data: res.parent ? toCart(res.parent) : undefined };
  } catch (e) {
    if (isDemoError(e)) return { ok: false, demo: true };
    return { ok: false, error: errorMessage(e, "Could not remove item.") };
  }
}

/** Set the customer email + shipping/billing address on the cart. */
export async function updateCartContact(
  cartId: string,
  data: { email?: string; shipping_address?: OmniCartAddress; billing_address?: OmniCartAddress },
): Promise<BackendResult<OmniCart>> {
  try {
    const { cart } = await client().store.cart.update(cartId, data);
    return { ok: true, data: toCart(cart) };
  } catch (e) {
    if (isDemoError(e)) return { ok: false, demo: true };
    return { ok: false, error: errorMessage(e, "Could not save your details.") };
  }
}

/** List shipping options available for the cart. */
export async function listShippingOptions(
  cartId: string,
): Promise<BackendResult<OmniShippingOption[]>> {
  try {
    const { shipping_options } = await client().store.fulfillment.listCartOptions({ cart_id: cartId });
    const options: OmniShippingOption[] = (shipping_options ?? []).map((o) => ({
      id: o.id,
      name: o.name,
      amount: o.amount,
      price_type: o.price_type === "calculated" ? "calculated" : "flat",
    }));
    return { ok: true, data: options };
  } catch (e) {
    if (isDemoError(e)) return { ok: false, demo: true };
    return { ok: false, error: errorMessage(e, "Could not load shipping options.") };
  }
}

/** Add the chosen shipping method to the cart. */
export async function addShippingMethod(
  cartId: string,
  optionId: string,
  data: Record<string, unknown> = {},
): Promise<BackendResult<OmniCart>> {
  try {
    const { cart } = await client().store.cart.addShippingMethod(cartId, {
      option_id: optionId,
      data,
    });
    return { ok: true, data: toCart(cart) };
  } catch (e) {
    if (isDemoError(e)) return { ok: false, demo: true };
    return { ok: false, error: errorMessage(e, "Could not set shipping method.") };
  }
}

/** List payment providers for a region. */
export async function listPaymentProviders(
  regionId: string,
): Promise<BackendResult<OmniPaymentProvider[]>> {
  try {
    const { payment_providers } = await client().store.payment.listPaymentProviders({
      region_id: regionId,
    });
    const providers: OmniPaymentProvider[] = (payment_providers ?? []).map((p) => ({
      id: p.id,
      is_enabled: true,
    }));
    return { ok: true, data: providers };
  } catch (e) {
    if (isDemoError(e)) return { ok: false, demo: true };
    return { ok: false, error: errorMessage(e, "Could not load payment methods.") };
  }
}

/**
 * Initialize a card payment session for the cart and return the payment
 * collection (with any provider `client_secret` for on-page confirmation).
 *
 * In Medusa v2 the js-sdk folds "create payment collection" and "initialize
 * session" into a single `initiatePaymentSession(cart, { provider_id })` call,
 * so we retrieve the cart, initiate the session, and map the result.
 */
export async function initiateOmniPaymentSession(
  cartId: string,
  providerId: string,
): Promise<BackendResult<OmniCartPaymentCollection>> {
  try {
    const { cart } = await client().store.cart.retrieve(cartId);
    const { payment_collection } = await client().store.payment.initiatePaymentSession(cart, {
      provider_id: providerId,
    });
    return { ok: true, data: toPaymentCollection(payment_collection) };
  } catch (e) {
    if (isDemoError(e)) return { ok: false, demo: true };
    return { ok: false, error: errorMessage(e, "Could not initialize payment.") };
  }
}

/** Complete the cart and place the order. */
export async function completeCart(cartId: string): Promise<CompleteResult> {
  try {
    const res = await client().store.cart.complete(cartId);
    if (res.type === "order") return { ok: true, order: toOrder(res.order) };
    return { ok: false, error: res.error?.message || "We could not complete your order." };
  } catch (e) {
    if (isDemoError(e)) return { ok: false, demo: true };
    return { ok: false, error: errorMessage(e, "We could not complete your order.") };
  }
}

/**
 * Apply a coupon/promo code to a cart using the OmniCart (Medusa v2) promotions
 * API. The backend re-validates the code and re-prices the cart, so the returned
 * cart's `promotions[]` and `discount_total`/`total` are authoritative
 * (anti-tamper).
 *
 * Ref: docs.medusajs.com/resources/storefront-development/cart/manage-promotions
 */
export async function applyDiscount(cartId: string, code: string): Promise<DiscountResult> {
  try {
    const { cart } = await client().store.cart.addPromotions(cartId, { promo_codes: [code] });
    return { ok: true, cart: toCart(cart) };
  } catch (e) {
    if (isDemoError(e)) return { ok: false, demo: true };
    return { ok: false, error: errorMessage(e, "That code isn’t valid.") };
  }
}

/** Remove a previously applied promotion (coupon) code. */
export async function removeDiscount(cartId: string, code: string): Promise<DiscountResult> {
  try {
    const { cart } = await client().store.cart.removePromotions(cartId, { promo_codes: [code] });
    return { ok: true, cart: toCart(cart) };
  } catch (e) {
    if (isDemoError(e)) return { ok: false, demo: true };
    return { ok: false, error: errorMessage(e, "Could not remove code.") };
  }
}
