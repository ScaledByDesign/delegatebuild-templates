/**
 * Client-side checkout/upsell session store.
 *
 * Route parity with the Delegate platform means the checkout, each upsell
 * offer, and the receipt are now SEPARATE routes (`/c/:code`,
 * `/upsell/:sessionId`, `/success`) instead of step state inside one component.
 * These names mirror the upw-sendpaylinks headless checkout exactly:
 *   /c/:code            → public checkout page (short code resolves the order)
 *   /upsell/:sessionId  → one upsell offer at a time (driven by the session)
 *   /success            → receipt / order confirmation
 * On the platform the server resolves the order + upsell session from the DB
 * on every page; in this template (which runs fully in-browser in demo mode,
 * or against the Worker proxy when wired) we persist the same handoff payload
 * in `sessionStorage` so a client-side `navigate()` between routes can rehydrate
 * the paid order and the live `FlowSession` without a backend round-trip.
 *
 * This mirrors `lib/upsell-flows/runtime`'s `retrieveSession` contract: given a
 * sessionId, return the order + flow session. When a real OmniCart upsell
 * runtime is wired, replace these reads with fetches to `/api/upsell/*` — the
 * route components don't care where the data comes from.
 */

import type { FlowSession } from "@/lib/flow-types";
import type { OrderSummary } from "@/lib/checkout-types";

const KEY_PREFIX = "omniexpress.session.";

/** The handoff payload persisted when checkout hands off to the upsell flow. */
export interface CheckoutHandoff {
  /** The checkout short code this session belongs to (mirror of `/c/:code`). */
  code: string;
  /** The paid base order (pre-upsell). */
  order: OrderSummary;
  /** The live upsell flow session cursor. */
  session: FlowSession;
}

function storage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

/** Persist the handoff under its session id so `/upsell/:sessionId` can read it. */
export function saveHandoff(handoff: CheckoutHandoff): void {
  const s = storage();
  if (!s) return;
  try {
    s.setItem(KEY_PREFIX + handoff.session.id, JSON.stringify(handoff));
  } catch {
    /* quota / disabled — upsell route falls back to the demo flow start */
  }
}

/** Read the handoff for a session id (mirror of runtime.retrieveSession). */
export function loadHandoff(sessionId: string): CheckoutHandoff | null {
  const s = storage();
  if (!s) return null;
  try {
    const raw = s.getItem(KEY_PREFIX + sessionId);
    return raw ? (JSON.parse(raw) as CheckoutHandoff) : null;
  } catch {
    return null;
  }
}

/** Update the persisted flow session as the customer walks the upsell graph. */
export function updateHandoffSession(sessionId: string, session: FlowSession): void {
  const existing = loadHandoff(sessionId);
  if (!existing) return;
  saveHandoff({ ...existing, session });
}

/** Drop a finished session (called from the success/receipt page). */
export function clearHandoff(sessionId: string): void {
  const s = storage();
  if (!s) return;
  try {
    s.removeItem(KEY_PREFIX + sessionId);
  } catch {
    /* ignore */
  }
}
