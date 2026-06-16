import React, { useMemo } from 'react';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';

interface StripePaymentWrapperProps {
  clientSecret: string | null;
  children: React.ReactNode;
}

export const StripePaymentWrapper: React.FC<StripePaymentWrapperProps> = ({
  clientSecret,
  children,
}) => {
  const stripePromise = useMemo(
    () => loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY || ''),
    []
  );

  if (!clientSecret) {
    return <>{children}</>;
  }

  // CRITICAL: Use clientSecret as the key to force remount when it changes
  // Stripe Elements does NOT support changing clientSecret after mount
  // (Error: "Unsupported prop change: options.clientSecret is not a mutable property")
  // By using clientSecret as the key, React will unmount and remount Elements
  // whenever the clientSecret changes, which properly reinitializes Stripe Elements
  return (
    <Elements
      key={clientSecret}
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: {
          theme: 'stripe',
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
        loader: 'auto',
      }}
    >
      {children}
    </Elements>
  );
};
