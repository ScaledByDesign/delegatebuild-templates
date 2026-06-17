/**
 * Resolve a public env value at runtime, preferring the platform-injected
 * `window` globals (set when a workspace is linked AFTER the app was built, so
 * build-time `import.meta.env` would be empty), then build-time `import.meta.env`,
 * then `process.env`. Mirrors the resolver in `omnicart-config.ts`.
 */
function readRuntimeEnv(...keys: string[]): string | undefined {
  for (const key of keys) {
    if (typeof window !== 'undefined') {
      const w = (window as unknown as Record<string, unknown>)[key];
      if (typeof w === 'string' && w) return w;
    }
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      const v = (import.meta.env as Record<string, string | undefined>)[key];
      if (v) return v;
    }
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      return process.env[key];
    }
  }
  return undefined;
}

/**
 * Browser-safe Stripe publishable key, resolved from whichever name the host
 * injects: the VITE_* build aliases or the raw connector names
 * (`STRIPE_PUBLISHABLE_KEY` / `STRIPE_PUBLIC_KEY`).
 */
export function resolveStripePublishableKey(): string {
  return (
    readRuntimeEnv(
      'VITE_STRIPE_PUBLIC_KEY',
      'VITE_STRIPE_PUBLISHABLE_KEY',
      'STRIPE_PUBLISHABLE_KEY',
      'STRIPE_PUBLIC_KEY',
      'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
    ) || ''
  );
}
