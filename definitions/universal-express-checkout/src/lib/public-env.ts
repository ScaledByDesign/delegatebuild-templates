/**
 * Standardized public (browser-safe) env resolution.
 *
 * The platform injects connector values under different shapes depending on the
 * connector and on whether the workspace was linked before or after the build:
 * build-time `import.meta.env.VITE_*`, raw `window.<NAME>` globals, or the raw
 * connector name (e.g. `STRIPE_PUBLISHABLE_KEY`, `SUPABASE_URL`). Rather than
 * teach every client which exact name to read, this resolver normalizes across
 * the common `''` / `VITE_` / `NEXT_PUBLIC_` prefixes and checks every place a
 * value can live. New browser-safe connector keys resolve automatically as long
 * as callers ask for the logical name.
 */

type EnvBag = Record<string, string | undefined>;

const PREFIXES = ['', 'VITE_', 'NEXT_PUBLIC_'] as const;

/** All name variants to try for a logical key, prefix-normalized. */
function candidates(key: string): string[] {
  const bare = key.replace(/^(VITE_|NEXT_PUBLIC_)/, '');
  const names = new Set<string>();
  for (const prefix of PREFIXES) names.add(prefix + bare);
  names.add(key);
  return [...names];
}

/** Every source a public value can come from, in priority order. */
function bags(): EnvBag[] {
  const out: EnvBag[] = [];
  if (typeof window !== 'undefined') {
    const w = window as unknown as { __PUBLIC_ENV__?: EnvBag } & EnvBag;
    if (w.__PUBLIC_ENV__) out.push(w.__PUBLIC_ENV__);
    out.push(w as EnvBag);
  }
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    out.push(import.meta.env as unknown as EnvBag);
  }
  if (typeof process !== 'undefined' && process.env) {
    out.push(process.env as EnvBag);
  }
  return out;
}

/**
 * Resolve the first non-empty value for any of the given logical keys, trying
 * each key's prefix variants against every env source.
 */
export function readPublicEnv(...keys: string[]): string | undefined {
  const sources = bags();
  for (const key of keys) {
    for (const name of candidates(key)) {
      for (const source of sources) {
        const value = source[name];
        if (typeof value === 'string' && value) return value;
      }
    }
  }
  return undefined;
}

/**
 * Hydrate `window.__PUBLIC_ENV__` from the Worker's `/api/public-env`, which
 * dynamically returns whatever browser-safe connector values are bound to the
 * deployment. This backfills runtime readers when a workspace was linked after
 * the build (so the values were never baked into `import.meta.env`). Best-effort
 * and idempotent; a failure leaves existing resolution untouched.
 */
let hydrated: Promise<void> | null = null;
export function hydratePublicEnv(): Promise<void> {
  if (hydrated) return hydrated;
  hydrated = (async () => {
    try {
      const res = await fetch('/api/public-env', { headers: { accept: 'application/json' } });
      if (!res.ok) return;
      const data = (await res.json()) as EnvBag;
      if (typeof window !== 'undefined' && data && typeof data === 'object') {
        const w = window as unknown as { __PUBLIC_ENV__?: EnvBag };
        w.__PUBLIC_ENV__ = { ...(w.__PUBLIC_ENV__ || {}), ...data };
      }
    } catch {
      // Best-effort: never let env hydration break app startup.
    }
  })();
  return hydrated;
}
