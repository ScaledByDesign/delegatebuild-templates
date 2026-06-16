import { medusaClient } from "../medusa-client"
import { getAuthHeaders } from "../util/cookies"

// Ensure publishable key is sent with store requests (matches checkout.ts pattern)
const OMNICART_PUBLISHABLE_KEY =
  (typeof window !== "undefined" &&
    (import.meta as any)?.env?.VITE_OMNICART_PUBLISHABLE_KEY) ||
  (typeof process !== "undefined"
    ? process.env.VITE_OMNICART_PUBLISHABLE_KEY
    : undefined) ||
  "pk_bfeb37dbcbc6e9cd7d9dc3e44a2dc89160c74de9c8cd1d4fb38c88d30cda1d20"

const getStoreHeaders = () => ({
  ...getAuthHeaders(),
  "x-publishable-api-key": OMNICART_PUBLISHABLE_KEY,
})

/**
 * Notify the OmniCart backend that a customer is viewing a product page.
 *
 * Posts to `POST /store/products/:id/track-view`, which emits the
 * `product.viewed` event onto the Medusa event bus.  The
 * `attentive-product-viewed` subscriber on the backend picks it up and
 * sends a server-side "Product Viewed" custom event to Attentive's
 * `/v1/events/custom` endpoint — matching how Added to Cart, Started
 * Checkout, and Order Placed are already delivered.
 *
 * Fire-and-forget: failures here must never break the PDP.  Errors are
 * logged to console but swallowed; analytics is a side-effect, not a
 * blocker for the user-facing render.
 *
 * Anonymous visitors (no customer_id) still hit the endpoint, but the
 * backend subscriber will bail since Attentive needs an identifier to
 * route the event.  The route returns 200 either way.
 */
export const trackProductViewServerSide = async (
  productId: string,
  customerId?: string
): Promise<void> => {
  if (!productId) return

  try {
    await medusaClient.fetch(`/store/products/${productId}/track-view`, {
      method: "POST",
      body: JSON.stringify({
        ...(customerId ? { customer_id: customerId } : {}),
      }),
      headers: {
        ...getStoreHeaders(),
        "Content-Type": "application/json",
      },
    })
  } catch (error) {
    // Swallow — analytics must not break the PDP.
    console.warn("[trackProductViewServerSide] Non-fatal error:", error)
  }
}
