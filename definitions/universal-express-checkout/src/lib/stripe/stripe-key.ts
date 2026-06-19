import { readPublicEnv } from '../public-env';

/**
 * Browser-safe Stripe publishable key, resolved from whichever name the host
 * injects (the shared resolver normalizes the VITE_/NEXT_PUBLIC_/raw variants).
 */
export function resolveStripePublishableKey(): string {
  return readPublicEnv('STRIPE_PUBLISHABLE_KEY', 'STRIPE_PUBLIC_KEY') || '';
}
