import React, { useCallback } from 'react';
import { ExpressCheckoutElement, useStripe, useElements } from '@stripe/react-stripe-js';
import type {
  StripeExpressCheckoutElementConfirmEvent,
  StripeExpressCheckoutElementClickEvent,
  StripeExpressCheckoutElementShippingAddressChangeEvent,
  StripeExpressCheckoutElementShippingRateChangeEvent,
} from '@stripe/stripe-js';
import { saveOrderRecoveryData } from '@/lib/checkout/orderRecovery';

interface ExpressCheckoutProps {
  amount: number;
  /** Cart subtotal (item_total) used for determining free shipping eligibility */
  subtotal?: number;
  onSuccess: (paymentIntent?: any) => void;
  onError: (error: string) => void;
  onProcessing?: (paymentIntent?: any) => void;
  cartId?: string;
  /**
   * Callback to fetch shipping rates when customer changes address in Apple Pay/Google Pay sheet
   * Returns shipping rates AND line items from Medusa with calculated prices and taxes
   */
  onShippingAddressChange?: (address: any) => Promise<{
    shippingRates: any[];
    lineItems?: Array<{ name: string; amount: number }>;
  } | null>;
  /**
   * Callback when customer changes shipping rate in Apple Pay/Google Pay sheet
   * Updates cart with selected shipping method, recalculates taxes, and returns updated lineItems
   */
  onShippingRateChange?: (shippingRateId: string) => Promise<{
    lineItems?: Array<{ name: string; amount: number }>;
  } | null>;
  /**
   * Initial shipping rates to display when Express Checkout sheet opens
   * Should come from Medusa's calculated_price based on current cart item_total
   */
  initialShippingRates?: Array<{
    id: string;
    displayName: string;
    amount: number;
    deliveryEstimate?: {
      minimum?: { unit: 'business_day' | 'day' | 'hour' | 'month' | 'week'; value: number };
      maximum?: { unit: 'business_day' | 'day' | 'hour' | 'month' | 'week'; value: number };
    };
  }>;
  /**
   * Hook invoked before the confirmation to persist shipping address to Medusa
   */
  onBeforeConfirm?: (address: any) => Promise<void>;
}

// Free shipping threshold - orders $50+ get free shipping
const FREE_SHIPPING_THRESHOLD = 50;
// Standard shipping rate for orders under threshold (in cents for Stripe)
const STANDARD_SHIPPING_RATE_CENTS = 995; // $9.95

/**
 * Calculate shipping rate based on cart subtotal
 * Orders $50+ get free shipping, orders under $50 pay $9.95
 */
const calculateShippingRate = (subtotal: number = 0) => {
  const isFreeShipping = subtotal >= FREE_SHIPPING_THRESHOLD;

  return {
    id: isFreeShipping ? 'free-shipping' : 'standard-shipping',
    displayName: isFreeShipping ? 'Free Shipping' : 'Standard Shipping ($9.95)',
    amount: isFreeShipping ? 0 : STANDARD_SHIPPING_RATE_CENTS,
    deliveryEstimate: {
      minimum: { unit: 'business_day' as const, value: 3 },
      maximum: { unit: 'business_day' as const, value: 7 },
    },
  };
};

export const ExpressCheckout: React.FC<ExpressCheckoutProps> = ({
  amount,
  subtotal = 0,
  onSuccess,
  onError,
  onProcessing,
  cartId,
  onShippingAddressChange,
  onShippingRateChange,
  initialShippingRates,
  onBeforeConfirm,
}) => {
  const stripe = useStripe();
  const elements = useElements();

  // Calculate the default shipping rate based on subtotal
  // This is used when no initialShippingRates are provided from Medusa
  const defaultShippingRate = React.useMemo(() => {
    return calculateShippingRate(subtotal);
  }, [subtotal]);

  // Handle click - resolve shipping options before sheet opens
  const handleClick = useCallback(
    ({ resolve }: StripeExpressCheckoutElementClickEvent) => {
      const isFreeShipping = subtotal >= FREE_SHIPPING_THRESHOLD;
      console.log(`🍎 Express Checkout clicked, subtotal: $${subtotal.toFixed(2)}, free shipping: ${isFreeShipping}`);

      // Use initialShippingRates from Medusa if available, otherwise calculate from subtotal
      const shippingRates = initialShippingRates?.length
        ? initialShippingRates
        : [defaultShippingRate];

      console.log('🚚 Initial shipping rates:', shippingRates);

      // Resolve with all required data collection for Apple Pay / Google Pay
      resolve({
        emailRequired: true,           // ← Required to capture customer email
        shippingAddressRequired: true,
        phoneNumberRequired: true,
        shippingRates,
      });
    },
    [subtotal, initialShippingRates, defaultShippingRate]
  );

  // Handle shipping address change - recalculate when user changes address in Apple Pay
  const handleShippingAddressChange = useCallback(
    async ({ resolve, reject, address }: StripeExpressCheckoutElementShippingAddressChangeEvent) => {
      console.log('🍎 Shipping address changed in Express Checkout:', address);

      try {
        // If custom handler provided, use it to get shipping rates from Medusa
        if (onShippingAddressChange) {
          const result = await onShippingAddressChange(address);
          if (result?.shippingRates?.length) {
            console.log('✅ Got shipping rates from Medusa:', result.shippingRates);
            if (result.lineItems) {
              console.log('📊 Updating Express Checkout total with line items:', result.lineItems);
            }
            // Pass both shipping rates AND line items to update the displayed total
            resolve({
              shippingRates: result.shippingRates,
              ...(result.lineItems && { lineItems: result.lineItems as any }),
            });
            return;
          }
        }

        // Fallback: calculate shipping rate based on subtotal
        const fallbackRate = calculateShippingRate(subtotal);
        console.log(`📦 Using fallback shipping rate (subtotal: $${subtotal.toFixed(2)}):`, fallbackRate);
        resolve({
          shippingRates: [fallbackRate],
        });
      } catch (error) {
        console.error('❌ Error getting shipping rates:', error);
        // Still resolve with calculated rate rather than rejecting
        const fallbackRate = calculateShippingRate(subtotal);
        resolve({
          shippingRates: [fallbackRate],
        });
      }
    },
    [onShippingAddressChange, subtotal]
  );

  // Handle shipping rate change
  const handleShippingRateChange = useCallback(
    async ({ resolve, shippingRate }: StripeExpressCheckoutElementShippingRateChangeEvent) => {
      console.log('🍎 Shipping rate selected:', shippingRate);

      try {
        // If custom handler provided, use it to update cart and get lineItems
        if (onShippingRateChange) {
          const result = await onShippingRateChange(shippingRate.id);
          if (result?.lineItems) {
            console.log('📊 Updating Express Checkout total with new shipping lineItems:', result.lineItems);
            resolve({ lineItems: result.lineItems as any });
            return;
          }
        }

        // Fallback: just resolve without updating lineItems
        resolve();
      } catch (error) {
        console.error('❌ Error updating shipping rate:', error);
        // Still resolve to avoid blocking the payment sheet
        resolve();
      }
    },
    [onShippingRateChange]
  );

  const handleConfirm = useCallback(
    async (event: StripeExpressCheckoutElementConfirmEvent) => {
      if (!stripe || !elements) {
        onError('Stripe not loaded');
        return;
      }

      console.log('🍎 Express Checkout confirm event:', {
        expressPaymentType: event.expressPaymentType,
        billingDetails: event.billingDetails,
        shippingAddress: event.shippingAddress,
        shippingRate: event.shippingRate,
      });

      // CRITICAL: Validate address before payment
      const shippingLine1 = event.shippingAddress?.address?.line1?.trim();
      const shippingName = event.shippingAddress?.name?.trim();
      if (!shippingLine1) {
        console.error('🚨 CRITICAL: No street address!');
        event.paymentFailed({reason:'invalid_shipping_address'});
        onError('Shipping address is incomplete.');
        return;
      }
      if (!shippingName) {
        console.error('🚨 CRITICAL: No name!');
        event.paymentFailed({reason:'invalid_shipping_address'});
        onError('Shipping name is required.');
        return;
      }

      if (onBeforeConfirm && event.shippingAddress) {
        try {
          await onBeforeConfirm(event.shippingAddress);
        } catch (addressError) {
          const message =
            addressError instanceof Error ? addressError.message : 'Failed to persist shipping address';
          console.error('❌ Express Checkout shipping address confirmation failed:', addressError);
          event.paymentFailed({
            reason: 'invalid_shipping_address',
          });
          onError(message);
          return;
        }
      }

      try {
        const { error, paymentIntent } = await stripe.confirmPayment({
          elements,
          confirmParams: {
            return_url: window.location.origin + '/checkout-success',
            shipping: event.shippingAddress ? {
              name: event.shippingAddress.name || '',
              address: {
                line1: event.shippingAddress.address?.line1 || '',
                line2: event.shippingAddress.address?.line2 || '',
                city: event.shippingAddress.address?.city || '',
                state: event.shippingAddress.address?.state || '',
                postal_code: event.shippingAddress.address?.postal_code || '',
                country: event.shippingAddress.address?.country || 'US',
              },
              // FIX: Phone is in billingDetails, not shippingAddress (per Stripe types)
              phone: event.billingDetails?.phone || '',
            } : undefined,
          },
          redirect: 'if_required',
        });

        if (error) {
          console.error('❌ Express Checkout payment error:', error);
          onError(error.message || 'Payment failed');
        } else if (paymentIntent?.status === 'succeeded') {
          console.log('✅ Payment succeeded via Express Checkout, PaymentIntent:', paymentIntent.id);
          console.log('📍 Shipping address from PaymentIntent:', paymentIntent.shipping);
          console.log('💳 Billing details from event:', event.billingDetails);

          // CRITICAL: Save recovery data IMMEDIATELY before any other async operations
          // This ensures we can recover the order if anything fails after payment capture
          if (cartId) {
            saveOrderRecoveryData({
              cartId,
              paymentIntentId: paymentIntent.id,
              paymentIntentStatus: paymentIntent.status,
              paymentAmount: paymentIntent.amount,
              expressCheckoutData: {
                billingDetails: event.billingDetails,
                shippingAddress: event.shippingAddress,
                shippingRate: event.shippingRate,
                expressPaymentType: event.expressPaymentType,
              },
              email: event.billingDetails?.email,
            });
          }

          // Attach express checkout data to paymentIntent for use in handlePaymentSuccess
          const enrichedPaymentIntent = {
            ...paymentIntent,
            // Add express checkout billing/shipping (the Stripe PaymentIntent
            // type carries no billing_details; it comes from the wallet event).
            billing_details: event.billingDetails,
            expressCheckoutData: {
              billingDetails: event.billingDetails,
              shippingAddress: event.shippingAddress,
              shippingRate: event.shippingRate,
              expressPaymentType: event.expressPaymentType,
            },
          };

          onSuccess(enrichedPaymentIntent);
        } else if (paymentIntent?.status === 'processing') {
          // CRITICAL FIX: Do NOT call onSuccess for 'processing' status!
          // The payment hasn't actually completed yet. We need to wait for webhook confirmation.
          console.log('⏳ Payment processing - saving recovery data and showing pending state...');

          // Save recovery data so we can complete the order when payment confirms
          if (cartId) {
            saveOrderRecoveryData({
              cartId,
              paymentIntentId: paymentIntent.id,
              paymentIntentStatus: paymentIntent.status,
              paymentAmount: paymentIntent.amount,
              expressCheckoutData: {
                billingDetails: event.billingDetails,
                shippingAddress: event.shippingAddress,
                shippingRate: event.shippingRate,
                expressPaymentType: event.expressPaymentType,
              },
              email: event.billingDetails?.email,
            });
          }

          // Call the processing callback instead of success
          // The order should be completed by webhook when payment actually succeeds
          if (onProcessing) {
            onProcessing(paymentIntent);
          } else {
            // Fallback: show a message that payment is being processed
            console.warn('⚠️ No onProcessing handler provided - payment is in processing state');
            onError('Payment is being processed. You will receive a confirmation email once complete.');
          }
        } else if (paymentIntent?.status === 'requires_action') {
          console.log('🔐 Payment requires additional action (3D Secure)');
          // Stripe will handle the redirect automatically
        } else {
          console.error('❌ Unexpected payment status:', paymentIntent?.status);
          onError(`Unexpected payment status: ${paymentIntent?.status}`);
        }
      } catch (error) {
        console.error('❌ Express Checkout error:', error);
        onError(error instanceof Error ? error.message : 'Payment error');
      }
    },
    [stripe, elements, onSuccess, onError, onProcessing, cartId, onBeforeConfirm]
  );

  return (
    <div className="border border-gray-200 rounded-lg p-4" data-attn-ignore="true">
      <ExpressCheckoutElement
        onClick={handleClick}
        onConfirm={handleConfirm}
        onShippingAddressChange={handleShippingAddressChange}
        onShippingRateChange={handleShippingRateChange}
        options={{
          buttonHeight: 48,
          buttonType: {
            applePay: 'buy',
            googlePay: 'buy',
          },
          paymentMethods: {
            applePay: 'always',
            googlePay: 'always',
          },
        }}
      />
    </div>
  );
};
