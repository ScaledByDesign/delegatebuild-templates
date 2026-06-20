/**
 * Affiliate attribution capture — client-side, mirrors the Delegate native
 * checkout contract (`lib/checkout-builder/attribution-capture.ts`).
 *
 * THE CHAIN (must match Delegate core end-to-end)
 * ----------------------------------------------
 * 1. Affiliate click route `/r/[slug]/[code]` (Delegate core) drops a
 *    first-party `affiliate_ref` cookie = partner CODE and 302s to the store.
 * 2. The landing/store page may ALSO carry the code as `?ref=` / `?aff=`.
 * 3. This util reads the query param FIRST (last-click wins), then falls back
 *    to the `affiliate_ref` cookie, persists it back to the cookie, and returns
 *    the code so the checkout can stamp it onto the Stripe PaymentIntent
 *    metadata as `affiliate_ref` and forward it into the upsell session.
 * 4. The Delegate conversion webhook reads `affiliate_ref` from PI metadata →
 *    creates AffiliateConversion + AffiliateCommission (PENDING).
 *
 * Vocabulary is kept identical to core so there is ONE contract across the
 * whole funnel: cookie name `affiliate_ref`, query keys `ref`/`aff`, Stripe
 * metadata key `affiliate_ref`.
 */

/** Query-string keys that carry the affiliate partner code on the landing URL. */
export const AFFILIATE_REF_PARAM_KEYS = ["ref", "aff"] as const;

/** First-party cookie the affiliate click route writes (first-touch fallback). */
export const AFFILIATE_REF_COOKIE = "affiliate_ref";

/** Stripe PaymentIntent metadata key the conversion webhook reads. */
export const AFFILIATE_REF_METADATA_KEY = "affiliate_ref";

/** Persist horizon for the re-written cookie (30 days, matches typical clickTtl). */
const AFFILIATE_REF_MAX_AGE = 60 * 60 * 24 * 30;

function clean(value: string | null | undefined): string | undefined {
  if (typeof value !== "string") return undefined;
  // Querystrings/cookies are attacker-influenced — cap + trim defensively.
  const v = value.trim().slice(0, 256);
  return v.length > 0 ? v : undefined;
}

/** Read a cookie value by name (browser only; returns undefined server-side). */
function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.match(
    new RegExp("(?:^|; )" + name.replace(/([.$?*|{}()[\]\\/+^])/g, "\\$1") + "=([^;]*)"),
  );
  return match ? clean(decodeURIComponent(match[1])) : undefined;
}

/** Write the first-party `affiliate_ref` cookie (httpOnly:false equivalent). */
function writeCookie(name: string, value: string): void {
  if (typeof document === "undefined") return;
  document.cookie =
    `${name}=${encodeURIComponent(value)}; path=/; max-age=${AFFILIATE_REF_MAX_AGE}; samesite=lax`;
}

/**
 * Capture the affiliate partner code from the current landing URL or the
 * `affiliate_ref` cookie. Query param wins (last-click); on a hit the value is
 * persisted back to the cookie so a later same-session navigation without the
 * query param still attributes. Returns `undefined` for organic visits.
 *
 * Pure read of `window.location.search`; safe to call repeatedly on mount.
 */
export function captureAffiliateRef(search?: string): string | undefined {
  // Query param first (last-click wins).
  let fromQuery: string | undefined;
  if (typeof window !== "undefined" || typeof search === "string") {
    const qs =
      typeof search === "string"
        ? search
        : typeof window !== "undefined"
          ? window.location.search
          : "";
    const params = new URLSearchParams(qs);
    for (const key of AFFILIATE_REF_PARAM_KEYS) {
      const hit = clean(params.get(key));
      if (hit) {
        fromQuery = hit;
        break;
      }
    }
  }

  const code = fromQuery ?? readCookie(AFFILIATE_REF_COOKIE);
  if (code) writeCookie(AFFILIATE_REF_COOKIE, code);
  return code;
}

/**
 * Build the `{ affiliate_ref }` metadata fragment for the charge target — empty
 * object for organic visits so the PaymentIntent metadata stays clean.
 */
export function affiliateRefMetadata(
  code: string | undefined,
): Record<string, string> {
  return code ? { [AFFILIATE_REF_METADATA_KEY]: code } : {};
}
