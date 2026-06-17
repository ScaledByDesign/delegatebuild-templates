import React, { useMemo } from 'react';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe, type StripeElementsOptions } from '@stripe/stripe-js';
import { resolveStripePublishableKey } from './stripe-key';

interface StripePaymentWrapperV2Props {
  children: React.ReactNode;
  clientSecret?: string | null;
}

/**
 * StripePaymentWrapperV2 - Two-Step Checkout with Medusa Integration
 *
 * This wrapper supports a two-step checkout flow that works with Medusa's payment session lifecycle:
 *
 * STEP 1: Address Collection (no clientSecret)
 * - Elements initialized in deferred mode
 * - User enters shipping address via AddressElement
 * - Tax and shipping calculated
 * - Cart total finalized
 * - Medusa automatically deletes any existing payment sessions when cart updates
 *
 * STEP 2: Payment Collection (with clientSecret)
 * - Create Medusa payment session with final cart total
 * - Extract client_secret from payment session
 * - Elements re-initializes with clientSecret
 * - User enters payment details via PaymentElement
 * - Confirm PaymentIntent using stripe.confirmPayment()
 * - Complete cart using Medusa's completeCart endpoint
 *
 * This two-step approach ensures payment sessions are only created AFTER the cart
 * is finalized, preventing Medusa from deleting them during cart updates.
 */
export const StripePaymentWrapperV2: React.FC<StripePaymentWrapperV2Props> = ({
  children,
  clientSecret,
}) => {
  const stripePromise = useMemo(() => loadStripe(resolveStripePublishableKey()), []);

  // If we have a clientSecret, use it to initialize Elements with the PaymentIntent
  // Otherwise, use deferred mode until payment session is created
  const options = useMemo<StripeElementsOptions>(() => {
    if (clientSecret) {
      return {
        clientSecret,
        appearance: {
          theme: 'stripe' as const,
          variables: {
            colorPrimary: '#176326',
            colorText: '#262626',
            colorBackground: '#ffffff',
            colorDanger: '#df1c41',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontLineHeight: '1.5',
            spacingUnit: '4px',
            borderRadius: '4px',
          },
        },
        loader: 'auto' as const,
      } as StripeElementsOptions;
    } else {
      // Deferred mode - used before payment session is created
      return {
        mode: 'payment' as const,
        amount: 1000, // Placeholder amount
        currency: 'usd',
        appearance: {
          theme: 'stripe' as const,
          variables: {
            colorPrimary: '#176326',
            colorText: '#262626',
            colorBackground: '#ffffff',
            colorDanger: '#df1c41',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontLineHeight: '1.5',
            spacingUnit: '4px',
            borderRadius: '4px',
          },
        },
        loader: 'auto' as const,
      } as StripeElementsOptions;
    }
  }, [clientSecret]);

  return (
    <Elements stripe={stripePromise} options={options}>
      {children}
    </Elements>
  );
};

