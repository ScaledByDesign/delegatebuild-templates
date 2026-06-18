import Medusa from "@medusajs/js-sdk"
import {
  OMNICART_BACKEND_URL,
  OMNICART_SDK_BASE_URL,
  OMNICART_PUBLISHABLE_KEY,
} from "./omnicart-config"

export { OMNICART_BACKEND_URL }

// The Medusa SDK calls `new URL(baseUrl)` internally, which rejects the
// same-origin RELATIVE proxy path ("/api/omnicart"). Use the ABSOLUTE form
// (<origin>/api/omnicart) so the SDK initializes — otherwise payment-session
// creation throws "Failed to construct 'URL': Invalid URL" on the checkout page.
export const sdk = new Medusa({
  baseUrl: OMNICART_SDK_BASE_URL,
  debug: import.meta.env?.MODE === "development",
  ...(OMNICART_PUBLISHABLE_KEY ? { publishableKey: OMNICART_PUBLISHABLE_KEY } : {}),
})

