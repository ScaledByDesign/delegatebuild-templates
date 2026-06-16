/**
 * Attribution capture hook for Rumble click ID and UTM parameters.
 * Persists to localStorage under `vnsh_attribution` with a 30-day TTL.
 */

import { useEffect } from 'react'

const STORAGE_KEY = 'vnsh_attribution'
const TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

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

    const hasIncoming = Object.keys(incoming).length > 0

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
          }
        : {}),
      // Incoming params override existing
      ...incoming,
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
