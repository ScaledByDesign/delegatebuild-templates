import Medusa from "@medusajs/js-sdk"
import { OMNICART_BACKEND_URL, OMNICART_PUBLISHABLE_KEY } from "./omnicart-config"

export { OMNICART_BACKEND_URL }

export const sdk = new Medusa({
  baseUrl: OMNICART_BACKEND_URL,
  debug: import.meta.env?.MODE === "development",
  ...(OMNICART_PUBLISHABLE_KEY ? { publishableKey: OMNICART_PUBLISHABLE_KEY } : {}),
})

