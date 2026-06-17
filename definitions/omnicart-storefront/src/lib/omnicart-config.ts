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

/**
 * Read an env var, preferring RUNTIME `window` globals injected by the platform
 * at deploy (this is how credentials arrive when a workspace is linked AFTER the
 * app was built — build-time `import.meta.env` would be empty in that case), then
 * falling back to build-time `import.meta.env` (browser) and `process.env` (Node).
 */
function readEnv(...keys: string[]): string | undefined {
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
      return process.env[key];
    }
  }
  return undefined;
}

/**
 * Resolve the backend base URL for browser code. A cross-origin absolute URL
 * (e.g. `https://vnsh.omnicart.cc`) CANNOT be called directly from the browser —
 * the OmniCart backend does not send `Access-Control-Allow-Origin`, so the
 * request is blocked by CORS. Browser traffic therefore always routes through
 * the same-origin Worker proxy (`/api/omnicart`), which forwards server-side and
 * injects the publishable key. A configured value is only honored when it is
 * already same-origin or a relative path.
 */
function resolveBrowserBackendUrl(): string {
  const configured = readEnv("VITE_OMNICART_BACKEND_URL", "OMNICART_BACKEND_URL");
  if (!configured) return "/api/omnicart";
  if (configured.startsWith("/")) return configured;
  try {
    const parsed = new URL(configured, window.location.origin);
    if (parsed.origin === window.location.origin) {
      return parsed.pathname.replace(/\/$/, "") || "/api/omnicart";
    }
  } catch {
    // Malformed URL — fall back to the proxy below.
  }
  return "/api/omnicart";
}

/**
 * Backend base URL. Browser always stays same-origin (the Worker proxy);
 * Node/build tooling uses the absolute backend URL directly.
 */
export const OMNICART_BACKEND_URL: string = isBrowser
  ? resolveBrowserBackendUrl()
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
  readEnv("VITE_OMNICART_SALES_CHANNEL_ID", "OMNICART_SALES_CHANNEL_ID") || "";

/** Default region id (empty unless configured). */
export const OMNICART_REGION_ID: string =
  readEnv("VITE_OMNICART_REGION_ID", "OMNICART_REGION_ID") || "";

/** Default inventory/stock location id (empty unless configured). */
export const OMNICART_INVENTORY_LOCATION_ID: string =
  readEnv("VITE_OMNICART_INVENTORY_LOCATION_ID", "OMNICART_INVENTORY_LOCATION_ID") || "";
