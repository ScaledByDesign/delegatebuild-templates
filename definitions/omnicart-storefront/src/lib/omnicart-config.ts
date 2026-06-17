/**
 * Centralized OmniCart (Medusa v2) connection config — SINGLE SOURCE OF TRUTH.
 *
 * No merchant-specific values are hardcoded here; everything resolves from the
 * environment so a generated storefront connects to ITS OWN OmniCart backend:
 *   • Browser: routes through the app's same-origin Worker proxy (`/api/omnicart`),
 *     which injects the publishable key server-side. Set `VITE_OMNICART_BACKEND_URL`
 *     to an absolute URL to connect the browser directly to a backend instead.
 *   • Node / build tooling: reads `OMNICART_*` / `VITE_OMNICART_*` env vars.
 *
 * Import these constants instead of re-deriving the URL/key in each module.
 */

const isBrowser = typeof window !== "undefined";

/** Read an env var in both the browser (import.meta.env) and Node (process.env). */
function readEnv(...keys: string[]): string | undefined {
  for (const key of keys) {
    if (typeof import.meta !== "undefined" && import.meta.env) {
      const v = (import.meta.env as Record<string, string | undefined>)[key];
      if (v) return v;
    }
    if (typeof process !== "undefined" && process.env && process.env[key]) {
      return process.env[key];
    }
  }
  return undefined;
}

/** Backend base URL. Browser defaults to the same-origin Worker proxy. */
export const OMNICART_BACKEND_URL: string = isBrowser
  ? readEnv("VITE_OMNICART_BACKEND_URL") || "/api/omnicart"
  : readEnv("OMNICART_BACKEND_URL", "VITE_OMNICART_BACKEND_URL") || "";

/**
 * Publishable key (browser-safe). Empty in the default proxy mode — the Worker
 * injects the key server-side — and set only when connecting the browser
 * directly to a backend via `VITE_OMNICART_PUBLISHABLE_KEY`.
 */
export const OMNICART_PUBLISHABLE_KEY: string =
  readEnv("VITE_OMNICART_PUBLISHABLE_KEY", "OMNICART_PUBLISHABLE_KEY") || "";

/** Default sales channel id for the storefront (empty unless configured). */
export const OMNICART_SALES_CHANNEL_ID: string =
  readEnv("VITE_OMNICART_SALES_CHANNEL_ID", "OMNICART_SALES_CHANNEL_ID", "MEDUSA_SALES_CHANNEL_ID") || "";

/** Default region id (empty unless configured). */
export const OMNICART_REGION_ID: string =
  readEnv("VITE_OMNICART_REGION_ID", "OMNICART_REGION_ID", "MEDUSA_DEFAULT_REGION_ID") || "";

/** Default inventory/stock location id (empty unless configured). */
export const OMNICART_INVENTORY_LOCATION_ID: string =
  readEnv("VITE_OMNICART_INVENTORY_LOCATION_ID", "OMNICART_INVENTORY_LOCATION_ID", "MEDUSA_INVENTORY_LOCATION_ID") || "";
