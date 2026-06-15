/**
 * Shared checkout types for the OmniCart Express Checkout flow.
 *
 * OmniCart is the whitelabel commerce brand (powered internally by the Medusa
 * framework). These types model the slice of checkout state the UI owns.
 */
import type { OmniCart, OmniCartLineItem } from "@/lib/omnicart";

export type CheckoutStepId =
  | "cart"
  | "shipping"
  | "payment"
  | "upsell"
  | "confirmation";

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

/**
 * A post-purchase one-click upsell offer.
 *
 * After the customer's payment method is captured, OmniCart can present a
 * one-click offer that charges the *same* saved payment method for an extra
 * item — no re-entering card details. Accepting appends the item to the order.
 */
export interface UpsellOffer {
  id: string;
  variant_id: string;
  title: string;
  pitch: string;
  /** Original price in minor units (e.g. cents). */
  original_price: number;
  /** One-click offer price in minor units (the discounted upsell price). */
  offer_price: number;
}

/**
 * Demo post-purchase upsell offer, shown when no OmniCart backend is wired yet.
 * Replace by fetching a real upsell offer for the completed order/cart from the
 * `omnicart` client.
 */
export const DEMO_UPSELL: UpsellOffer = {
  id: "upsell_warranty_bundle",
  variant_id: "var_upsell_1",
  title: "OmniCart Care+ Protection Plan",
  pitch:
    "Add 2-year accidental damage coverage to your order. One-time offer at checkout — added to this order with one click using the card you just used.",
  original_price: 2900,
  offer_price: 1900,
};

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
  total: number;
  currency_code: string;
  items: OmniCartLineItem[];
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
  total: 7344,
};

export function cartSubtotal(items: OmniCartLineItem[]): number {
  return items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);
}
