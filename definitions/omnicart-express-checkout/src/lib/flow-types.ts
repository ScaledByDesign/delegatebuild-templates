/**
 * OmniCart Upsell Flow types — Flow Builder button contract.
 *
 * OmniCart's post-purchase upsells are NOT a single hardcoded offer. They are
 * driven by the OmniCart **Flow Builder**: a merchant designs a directed graph
 * of offer "buttons" (nodes), each with its own accept/decline branches. After
 * the initial order is paid, the storefront walks that graph one node at a
 * time — Accept charges the *same* saved payment method (one-click) and follows
 * `success_next_button_id`; Decline follows `decline_next_button_id`. The walk
 * ends at a terminal node, then the confirmation screen renders.
 *
 * These types are the client-side mirror of the Delegate Flow Builder model
 * (`UpsellButton` / `UpsellSession`) and the runtime click contract
 * (`GET /api/upsell/click`). Keep them in sync with the backend; the server is
 * always the authority for pricing and graph-walking (anti-tamper).
 */

/** A multi-accept option on a node (e.g. 3 / 6 / 9 bottles). When the customer
 *  picks one, its `id` is sent as `variantId` and the server overrides the
 *  node price with this option's price BEFORE charging. */
export interface FlowAcceptOption {
  id: string;
  label: string;
  /** Price in minor units (cents). Server re-resolves the real charge. */
  price: number;
  compareAtPrice?: number | null;
  ctaText?: string | null;
}

/**
 * A single offer node in the upsell flow (mirror of `UpsellButton`).
 *
 * The branch fields wire the graph: on Accept the runtime walks to
 * `success_next_button_id`; on Decline to `decline_next_button_id`. A node
 * flagged `is_terminal_success` / `is_terminal_decline` ends the flow on that
 * branch (→ confirmation). `external_page_url`, when set, means the next node
 * is hosted on a merchant page and the runtime 302-redirects there instead.
 */
export interface FlowNode {
  id: string;
  /** Internal label / headline. */
  label: string;
  /** Primary accept CTA text. */
  button_text: string;
  /** Marketing pitch / value prop shown on the offer card. */
  pitch?: string | null;
  /** Single-offer price in minor units (used when `accept_options` is empty). */
  display_price: number | null;
  currency_code: string;
  /** Strike-through reference price in minor units (optional). */
  compare_at_price?: number | null;
  /** Multi-accept variants. When present, the card shows a selector and the
   *  chosen option's id is sent as `variantId`. */
  accept_options?: FlowAcceptOption[] | null;
  /** Decline CTA text (falls back to a sensible default). */
  decline_text?: string | null;
  /** Next node on Accept. Null + not terminal = end of flow. */
  success_next_button_id?: string | null;
  /** Next node on Decline. Null + not terminal = end of flow. */
  decline_next_button_id?: string | null;
  is_terminal_success?: boolean;
  is_terminal_decline?: boolean;
  /** Server-enforced countdown in seconds. Client countdown is decoration;
   *  the server auto-declines a late Accept. */
  timer?: number | null;
  /** Merchant-hosted next page (Pattern A). Runtime redirects here on advance. */
  external_page_url?: string | null;
}

/** One recorded step in the session journey (mirror of `JourneyStep`). */
export interface JourneyStep {
  button_id: string;
  button_text: string;
  action: "success" | "decline";
  /** Revenue added by this step in minor units. */
  revenue: number;
  timestamp: string;
}

export type FlowSessionStatus = "active" | "completed" | "abandoned";

/**
 * Runtime upsell session (mirror of `UpsellSession`). The storefront holds
 * this between offers; `current_button_id` is the node to render next, and
 * `version` is the optimistic lock the server round-trips to block
 * double-charges on rapid Accept clicks.
 */
export interface FlowSession {
  id: string;
  flow_id: string;
  status: FlowSessionStatus;
  /** Node to render now. Null = no more offers → confirmation. */
  current_button_id: string | null;
  journey: JourneyStep[];
  /** Cumulative session revenue (original order + accepted upsells). */
  total_revenue: number;
  /** Upsell-only cumulative (excludes the original order). */
  upsell_total: number;
  currency_code: string;
  version: number;
}

/**
 * Result of an Accept/Decline click (mirror of the runtime `StepResult` shape,
 * trimmed to what the client renders). The client uses `next_node` to render
 * the next offer; when `is_terminal` (or `next_node` is null) it advances to
 * confirmation. A `payment_error` surfaces a card-decline message.
 */
export interface FlowStepResult {
  session: FlowSession;
  next_node: FlowNode | null;
  is_terminal: boolean;
  /** Set when the Accept actually charged the stored payment method. */
  charge?: {
    transaction_id: string;
    amount_charged: number;
    currency: string;
  } | null;
  /** Set when the server auto-declined an Accept because the timer expired. */
  timer_expired?: boolean;
  payment_error?: {
    code:
      | "card_declined"
      | "authentication_required"
      | "not_configured"
      | "invalid_token"
      | "upstream_error";
    message: string;
  } | null;
}

/**
 * Demo upsell flow — a realistic 2-offer sequence (upsell → downsell) shown
 * when no OmniCart Flow Builder flow is wired yet, so the generated checkout
 * renders a complete multi-upsell journey out of the box.
 *
 * Graph:
 *   up_protection (Accept → up_accessory · Decline → down_protection)
 *   down_protection (Accept → up_accessory · Decline → up_accessory)   [downsell]
 *   up_accessory (multi-accept 1/2/3 packs; Accept|Decline → end)      [terminal]
 *
 * Replace by fetching the merchant's real flow from the OmniCart backend.
 */
export const DEMO_FLOW_ID = "flow_demo_post_purchase";

export const DEMO_FLOW_NODES: Record<string, FlowNode> = {
  up_protection: {
    id: "up_protection",
    label: "OmniCart Care+ Protection Plan",
    button_text: "Yes, add protection — one click",
    pitch:
      "Add 2-year accidental damage coverage to your order. One-time offer — added with one click using the card you just used.",
    display_price: 1900,
    compare_at_price: 2900,
    currency_code: "usd",
    decline_text: "No thanks",
    success_next_button_id: "up_accessory",
    decline_next_button_id: "down_protection",
    timer: 600,
  },
  down_protection: {
    id: "down_protection",
    label: "Last chance: 1-year coverage",
    button_text: "Add 1-year coverage",
    pitch:
      "Not ready for 2 years? Get 1 year of accidental damage coverage at our lowest price — still one click, same card.",
    display_price: 1200,
    compare_at_price: 1900,
    currency_code: "usd",
    decline_text: "No thanks",
    success_next_button_id: "up_accessory",
    decline_next_button_id: "up_accessory",
    timer: 600,
  },
  up_accessory: {
    id: "up_accessory",
    label: "Complete your setup",
    button_text: "Add to my order",
    pitch:
      "Stock up on OmniCart Signature accessories and save more per pack — added with one click.",
    display_price: null,
    currency_code: "usd",
    decline_text: "No thanks, finish my order",
    accept_options: [
      { id: "pack_1", label: "1 pack", price: 1800, compareAtPrice: 2400 },
      { id: "pack_2", label: "2 packs", price: 3200, compareAtPrice: 4800, ctaText: "Best value" },
      { id: "pack_3", label: "3 packs", price: 4200, compareAtPrice: 7200 },
    ],
    is_terminal_success: true,
    is_terminal_decline: true,
    timer: 600,
  },
};

/** Entry node id for the demo flow (mirror of `UpsellFlow.entryButtonId`). */
export const DEMO_FLOW_ENTRY_BUTTON_ID = "up_protection";
