/**
 * Shared checkout types for the OmniCart Express Checkout flow.
 *
 * OmniCart is the whitelabel commerce brand (powered internally by the Medusa
 * framework). These types model the slice of checkout state the UI owns.
 */
import type { OmniCart, OmniCartPromotion, OmniCartLineItem } from "@/lib/omnicart";

export type CheckoutStepId =
  | "cart"
  | "shipping"
  | "payment"
  | "upsell"
  | "confirmation";

// The post-purchase upsell sequence is driven by the OmniCart Flow Builder
// (see lib/flow-types.ts + lib/upsell-flow.ts). The "upsell" step renders the
// current flow node; the page walks the graph node-by-node until a terminal
// node, then shows confirmation. Offer content lives in the flow, not here.

// The upsell step is intentionally omitted from the visible progress indicator:
// a post-purchase one-click upsell appears *after* the payment is captured but
// *before* the final confirmation, and should feel like a bonus offer rather
// than another required checkout step.
export const CHECKOUT_STEPS: { id: CheckoutStepId; label: string }[] = [
  { id: "cart", label: "Cart" },
  { id: "shipping", label: "Shipping" },
  { id: "payment", label: "Payment" },
  { id: "confirmation", label: "Done" },
];

export interface ShippingAddress {
  first_name: string;
  last_name: string;
  email: string;
  address_1: string;
  city: string;
  province: string;
  postal_code: string;
  country_code: string;
  phone?: string;
}

export interface ShippingOption {
  id: string;
  name: string;
  amount: number;
}

export interface OrderSummary {
  id: string;
  email: string;
  /** Itemized totals (minor units). `total` is what was charged. */
  subtotal: number;
  shipping_total: number;
  tax_total: number;
  discount_total: number;
  total: number;
  currency_code: string;
  items: OmniCartLineItem[];
  /** Promotions/coupon codes applied to the order (empty when none). */
  promotions: OmniCartPromotion[];
}

export const EMPTY_ADDRESS: ShippingAddress = {
  first_name: "",
  last_name: "",
  email: "",
  address_1: "",
  city: "",
  province: "",
  postal_code: "",
  country_code: "US",
  phone: "",
};

/**
 * Demo cart used when no OmniCart backend is configured yet, so the generated
 * checkout page renders a realistic flow out of the box. Replace by wiring the
 * `omnicart` client to a live OmniCart (Medusa) backend.
 */
export const DEMO_CART: OmniCart = {
  id: "cart_demo",
  currency_code: "usd",
  items: [
    {
      id: "item_1",
      title: "OmniCart Signature Tee",
      quantity: 1,
      unit_price: 3200,
      thumbnail: null,
      variant: { id: "var_1", title: "M / Black" },
    },
    {
      id: "item_2",
      title: "OmniCart Canvas Tote",
      quantity: 2,
      unit_price: 1800,
      thumbnail: null,
      variant: { id: "var_2", title: "Natural" },
    },
  ],
  subtotal: 6800,
  shipping_total: 0,
  tax_total: 544,
  discount_total: 0,
  promotions: [],
  total: 7344,
};

export function cartSubtotal(items: OmniCartLineItem[]): number {
  return items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);
}

/**
 * Demo coupon table used when no OmniCart backend is configured, so the coupon
 * field is interactive out of the box. Replace by wiring `applyDiscount` to a
 * live OmniCart backend (the backend then becomes the source of truth).
 *   - percent:  fraction off the subtotal (0.10 = 10%)
 *   - amount:   fixed minor-unit amount off (e.g. 1000 = $10.00)
 */
export const DEMO_COUPONS: Record<string, { percent?: number; amount?: number }> = {
  SAVE10: { percent: 0.1 },
  WELCOME15: { percent: 0.15 },
  FLAT5: { amount: 500 },
};

/**
 * Resolve a demo coupon to a discount amount against a given subtotal.
 * Returns `null` for unknown codes. Percent discounts are capped at subtotal.
 */
export function resolveDemoCoupon(code: string, subtotal: number): number | null {
  const def = DEMO_COUPONS[code.trim().toUpperCase()];
  if (!def) return null;
  if (typeof def.percent === "number") {
    return Math.min(subtotal, Math.round(subtotal * def.percent));
  }
  return Math.min(subtotal, def.amount ?? 0);
}
