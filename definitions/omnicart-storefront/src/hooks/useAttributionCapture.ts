/**
 * Attribution capture hook for Rumble click ID and UTM parameters.
 * Persists to localStorage under `vnsh_attribution` with a 30-day TTL.
 *
 * AFFILIATE ATTRIBUTION
 * ---------------------
 * Also captures the affiliate partner CODE from `?ref=`/`?aff=` (query wins,
 * last-click) or the first-party `affiliate_ref` cookie dropped by the Delegate
 * click route (`/r/[slug]/[code]`). The code is stored as `affiliate_ref` in
 * the attribution payload, which `createCart`/`mergeAttributionToCart` write
 * into the OmniCart cart metadata. The OmniCart backend then back-stamps the
 * Stripe PaymentIntent with `affiliate_ref` (via `completeStoreCharge`), so the
 * Delegate conversion webhook can credit the partner. Vocabulary is identical
 * to Delegate core: cookie `affiliate_ref`, query keys `ref`/`aff`, Stripe
 * metadata key `affiliate_ref`.
 */

import { useEffect } from 'react'

const STORAGE_KEY = 'vnsh_attribution'
const TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

/** Affiliate referral query keys (query wins over cookie; last-click). */
const AFFILIATE_REF_PARAM_KEYS = ['ref', 'aff'] as const
/** First-party cookie the Delegate affiliate click route writes. */
const AFFILIATE_REF_COOKIE = 'affiliate_ref'

/** Read a cookie value by name (browser only). */
function readAffiliateRefCookie(): string | undefined {
  if (typeof document === 'undefined') return undefined
  const match = document.cookie.match(
    new RegExp('(?:^|; )' + AFFILIATE_REF_COOKIE + '=([^;]*)'),
  )
  if (!match) return undefined
  const v = decodeURIComponent(match[1]).trim().slice(0, 256)
  return v.length > 0 ? v : undefined
}

/**
 * Capture the affiliate partner code from the current URL (`?ref`/`?aff`) or
 * the `affiliate_ref` cookie. Query wins (last-click). Persists a hit back to
 * the cookie so a later same-session navigation still attributes. Returns
 * undefined for organic visits.
 */
function captureAffiliateRef(params: URLSearchParams): string | undefined {
  let fromQuery: string | undefined
  for (const key of AFFILIATE_REF_PARAM_KEYS) {
    const raw = params.get(key)
    if (raw) {
      const v = raw.trim().slice(0, 256)
      if (v.length > 0) {
        fromQuery = v
        break
      }
    }
  }
  const code = fromQuery ?? readAffiliateRefCookie()
  if (code && typeof document !== 'undefined') {
    document.cookie =
      `${AFFILIATE_REF_COOKIE}=${encodeURIComponent(code)}; path=/; max-age=${
        30 * 24 * 60 * 60
      }; samesite=lax`
  }
  return code
}

const TRACKED_PARAMS = [
  '_raclid',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'fbclid',
  'gclid',
  'ttclid',
] as const

type TrackedParam = typeof TRACKED_PARAMS[number]

export interface StoredAttribution {
  _raclid?: string
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_term?: string
  utm_content?: string
  fbclid?: string
  gclid?: string
  ttclid?: string
  /** Affiliate partner CODE (from `?ref`/`?aff` or the `affiliate_ref` cookie).
   *  Written into cart metadata → back-stamped onto the Stripe PI as
   *  `affiliate_ref` by the OmniCart backend. Absent for organic buys. */
  affiliate_ref?: string
  landing_url: string
  first_seen_at: string
  last_seen_at: string
}

/**
 * Reads attribution from localStorage. Returns null if not present,
 * expired (with no new params in the current URL), or corrupted.
 */
export function getStoredAttribution(): StoredAttribution | null {
  if (typeof window === 'undefined') return null

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null

    const parsed: StoredAttribution = JSON.parse(raw)

    // Validate required shape
    if (!parsed.first_seen_at || !parsed.last_seen_at || !parsed.landing_url) {
      window.localStorage.removeItem(STORAGE_KEY)
      return null
    }

    return parsed
  } catch {
    // Corrupted — clear and recover
    try {
      window.localStorage.removeItem(STORAGE_KEY)
    } catch (_ignore) {
      // removeItem failure is non-fatal
    }
    return null
  }
}

/**
 * Mount in App/AppContent to capture attribution params on every page load.
 * Pure side-effect — no return value.
 */
export function useAttributionCapture(): void {
  useEffect(() => {
    if (typeof window === 'undefined') return

    const now = new Date().toISOString()
    const params = new URLSearchParams(window.location.search)

    // Collect any tracked params from the current URL
    const incoming: Partial<Record<TrackedParam, string>> = {}
    for (const key of TRACKED_PARAMS) {
      const val = params.get(key)
      if (val) {
        incoming[key] = val
      }
    }

    // Affiliate code is captured separately (different keys + cookie fallback).
    const affiliateRef = captureAffiliateRef(params)

    const hasIncoming = Object.keys(incoming).length > 0 || Boolean(affiliateRef)

    // Read existing stored attribution (handle parse errors)
    let existing: StoredAttribution | null = null
    try {
      existing = getStoredAttribution()
    } catch {
      existing = null
    }

    // TTL check: if existing data is older than 30 days AND no new params, clear and bail
    if (existing && !hasIncoming) {
      const firstSeen = new Date(existing.first_seen_at).getTime()
      if (Number.isNaN(firstSeen) || Date.now() - firstSeen > TTL_MS) {
        try {
          window.localStorage.removeItem(STORAGE_KEY)
        } catch (_ignore) {
          // removeItem failure is non-fatal
        }
      }
      // Either cleared or still valid — nothing to write, no incoming params
      return
    }

    // Nothing to do if no existing data and no incoming params
    if (!hasIncoming && !existing) return

    // Merge: new values override, but preserve first-touch landing_url / first_seen_at
    const updated: StoredAttribution = {
      // Spread existing attribution params first
      ...(existing
        ? {
            _raclid: existing._raclid,
            utm_source: existing.utm_source,
            utm_medium: existing.utm_medium,
            utm_campaign: existing.utm_campaign,
            utm_term: existing.utm_term,
            utm_content: existing.utm_content,
            fbclid: existing.fbclid,
            gclid: existing.gclid,
            ttclid: existing.ttclid,
            affiliate_ref: existing.affiliate_ref,
          }
        : {}),
      // Incoming params override existing
      ...incoming,
      // Affiliate code: last-click wins, else preserve the existing first-touch.
      ...(affiliateRef ? { affiliate_ref: affiliateRef } : {}),
      // Preserve first-touch landing URL and timestamp; use current for new entries
      landing_url: existing?.landing_url ?? window.location.href,
      first_seen_at: existing?.first_seen_at ?? now,
      last_seen_at: now,
    }

    // Strip keys with undefined values to keep storage clean
    const clean = Object.fromEntries(
      Object.entries(updated).filter(([, v]) => v !== undefined)
    ) as StoredAttribution

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(clean))
      if (import.meta.env.DEV) {
        console.debug('[useAttributionCapture] Attribution saved:', clean)
      }
    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn('[useAttributionCapture] Failed to write localStorage:', err)
      }
    }
  }, [])
}
