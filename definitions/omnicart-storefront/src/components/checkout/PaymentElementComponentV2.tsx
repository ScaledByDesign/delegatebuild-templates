import React, { useCallback, useState } from 'react';
import { PaymentElement, AddressElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { StripePaymentElementChangeEvent, StripeAddressElementChangeEvent } from '@stripe/stripe-js';
import { updateShippingAddress, updateBillingAddress, updateCartEmail } from '@/lib/data/checkout';
import { Checkbox } from '@/components/ui/checkbox';

interface PaymentElementComponentProps {
  onSuccess: (paymentIntent?: any) => void; // Updated to accept paymentIntent
  onError: (error: string) => void;
  isProcessing?: boolean;
  collectShipping?: boolean; // Optional: collect shipping address separately
  cartId?: string; // Cart ID for syncing address with Medusa
  onAddressUpdated?: (cart: any) => void; // Callback when address is synced with Medusa
  clientSecret?: string | null; // Payment session client secret from parent
}

export const PaymentElementComponentV2: React.FC<PaymentElementComponentProps> = ({
  onSuccess,
  onError,
  isProcessing = false,
  collectShipping = false,
  cartId = '',
  onAddressUpdated,
  clientSecret = null,
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [smsOptIn, setSmsOptIn] = useState(false);

  const handlePaymentChange = useCallback((event: StripePaymentElementChangeEvent) => {
    console.log('Payment element changed:', event.value.type);
  }, []);

  const handleEmailChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmail(value);

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (value && !emailRegex.test(value)) {
      setEmailError('Please enter a valid email address');
    } else {
      setEmailError(null);

      // Sync valid email to Medusa
      if (value && emailRegex.test(value) && cartId) {
        updateCartEmail(cartId, value).catch((error) => {
          console.error('Failed to sync email to Medusa:', error);
        });
      }
    }
  }, [cartId]);

  const handleShippingChange = useCallback((event: StripeAddressElementChangeEvent) => {
    console.log('Shipping address changed:', { complete: event.complete, value: event.value });

    // Always sync when state changes (for tax recalculation)
    // Even if form is not complete, we want to update tax when state changes
    const hasState = event.value?.address?.state;
    const hasMinimalAddress = event.value?.address?.city && event.value?.address?.postal_code;

    if (hasState && hasMinimalAddress && cartId) {
      console.log('🔄 State changed, syncing for tax recalculation...');
      syncAddressWithMedusa(event.value);
    }
  }, [cartId]);

  const syncAddressWithMedusa = async (stripeAddress: any) => {
    try {
      console.log('🏠 Syncing address with Medusa for tax calculation...');
      console.log('📍 Raw Stripe Address Element value:', stripeAddress);

      // Address Element returns address fields nested under 'address' property
      // Structure: { name: "...", phone: "...", address: { line1, city, state, ... } }
      const addressData = stripeAddress.address || {};

      // Extract state code from Stripe address (e.g., "TX", "CA")
      const stripeStateCode = addressData.state?.toUpperCase?.() || '';

      // Stripe returns country as "US", "CA", etc. Convert to proper country_code
      const countryCode = addressData.country?.toLowerCase?.() || 'us';

      // Validate: Reject US territories (we only ship to continental US + DC)
      const US_TERRITORIES = ['PR', 'GU', 'VI', 'AS', 'MP', 'PW', 'FM', 'MH'];
      if (US_TERRITORIES.includes(stripeStateCode)) {
        const errorMsg = `We currently do not ship to ${stripeStateCode}. We only ship to the continental United States.`;
        console.warn(`⚠️ ${errorMsg}`);
        setErrorMessage(errorMsg);
        return; // Don't sync this address
      }

      // Convert Stripe state code to Medusa tax region format
      // Medusa tax regions use format: "us-tx" (country-state, lowercase)
      // Stripe sends: "TX" (uppercase state only)
      const provinceCode = stripeStateCode
        ? `${countryCode}-${stripeStateCode.toLowerCase()}`
        : '';

      console.log(`💰 Tax region mapping: Stripe "${stripeStateCode}" → Medusa "${provinceCode}"`);

      // Validate required fields before sending to Medusa
      if (!addressData.city || !addressData.postal_code || !provinceCode) {
        console.log('⏭️ Skipping sync - missing required fields (city, postal_code, or province)');
        return;
      }

      const medusaAddress = {
        first_name: stripeAddress.name?.split(' ')[0] || 'Guest',
        last_name: stripeAddress.name?.split(' ').slice(1).join(' ') || 'Customer',
        address_1: addressData.line1 || 'TBD',
        address_2: addressData.line2 || '',
        city: addressData.city,
        province: provinceCode,  // Use converted format for tax matching
        postal_code: addressData.postal_code,
        country_code: countryCode,
        phone: stripeAddress.phone || '',
      };

      console.log('📦 Sending address to Medusa:', medusaAddress);

      // Sync shipping address
      const response = await updateShippingAddress(cartId, medusaAddress);
      const updatedCart = (response as any)?.cart;

      console.log('✅ Shipping address synced with Medusa');

      // Log tax calculation results
      if (updatedCart) {
        const taxTotal = updatedCart.tax_total || 0;
        const subtotal = updatedCart.subtotal || 0;
        const taxRate = subtotal > 0 ? ((taxTotal / subtotal) * 100).toFixed(2) : '0.00';
        console.log(`💰 Tax calculated: $${taxTotal.toFixed(2)} (${taxRate}% of $${subtotal.toFixed(2)})`);
        console.log(`   Province: ${provinceCode}, Country: ${countryCode}`);

        if (taxTotal === 0 && provinceCode === 'us-tx') {
          console.warn('⚠️ Texas order with $0 tax - check tax region configuration!');
        }
      }

      // Also set as billing address (most customers use same address for both)
      // This will be updated with actual billing details after payment if different
      await updateBillingAddress(cartId, medusaAddress);
      console.log('✅ Billing address pre-filled (will update after payment if different)');

      if (onAddressUpdated) {
        onAddressUpdated(updatedCart);
      }
    } catch (error) {
      console.error('❌ Failed to sync address with Medusa:', error);
      // Don't stop payment for address sync failure - just log it
    }
  };

  const handleSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();

      // Clear any previous errors
      setErrorMessage(null);

      // Validate email before proceeding
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email || !emailRegex.test(email)) {
        const errorMsg = 'Please enter a valid email address';
        setErrorMessage(errorMsg);
        setEmailError(errorMsg);
        onError(errorMsg);
        return;
      }

      if (!stripe || !elements) {
        const errorMsg = 'Stripe not loaded. Please refresh the page and try again.';
        setErrorMessage(errorMsg);
        onError(errorMsg);
        return;
      }

      if (!cartId) {
        const errorMsg = 'Cart ID is missing. Please refresh and try again.';
        setErrorMessage(errorMsg);
        onError(errorMsg);
        return;
      }

      // Check if payment session exists (created after address was set)
      if (!clientSecret) {
        const errorMsg = 'Please complete your shipping address first.';
        setErrorMessage(errorMsg);
        onError(errorMsg);
        return;
      }

      setIsLoading(true);

      try {
        // Step 1: Submit the form to validate all fields
        const { error: submitError } = await elements.submit();
        if (submitError) {
          const errorMsg = submitError.message || 'Payment submission failed';
          setErrorMessage(errorMsg);
          onError(errorMsg);
          setIsLoading(false);
          return;
        }

        console.log('💳 Confirming payment with existing PaymentIntent...');
        console.log('   Client Secret:', clientSecret.substring(0, 30) + '...');

        // Step 2: Confirm the PaymentIntent that was created by Medusa
        // This uses the PaymentIntent from initiatePaymentSession (has correct amount)
        // Note: Don't pass clientSecret here - Elements already has it from initialization
        const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
          elements,
          confirmParams: {
            return_url: `${window.location.origin}/checkout-success`,
            payment_method_data: {
              billing_details: {
                email: email,
              },
            },
          },
          redirect: 'if_required',
        });

        if (confirmError) {
          const errorMsg = confirmError.message || 'Payment failed';
          console.error('❌ Payment confirmation failed:', confirmError);
          setErrorMessage(errorMsg);
          onError(errorMsg);
          setIsLoading(false);
          return;
        }

        if (!paymentIntent) {
          // This shouldn't happen with redirect: 'if_required'
          const errorMsg = 'Payment confirmation incomplete';
          setErrorMessage(errorMsg);
          onError(errorMsg);
          setIsLoading(false);
          return;
        }

        console.log('✅ Payment confirmed:', paymentIntent.id);
        console.log('   Status:', paymentIntent.status);
        console.log('   Amount:', `$${(paymentIntent.amount / 100).toFixed(2)}`);

        // Handle different payment statuses
        if (paymentIntent.status === 'succeeded') {
          console.log('✅ Payment succeeded!');
          setErrorMessage(null);
          onSuccess(paymentIntent);
        } else if (paymentIntent.status === 'processing') {
          console.log('⏳ Payment is processing...');
          setErrorMessage('Payment is being processed. Please wait...');
          onSuccess(paymentIntent); // Still call success - order will be completed by webhook
        } else if (paymentIntent.status === 'requires_action') {
          // This case is handled by redirect: 'if_required'
          console.log('🔐 Payment requires additional action (handled by redirect)');
          setErrorMessage('Please complete authentication...');
        } else {
          // Payment failed or requires payment method
          const errorMsg = 'Payment was not successful. Please check your payment details and try again.';
          setErrorMessage(errorMsg);
          onError(errorMsg);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'An unexpected error occurred. Please try again.';
        setErrorMessage(errorMsg);
        onError(errorMsg);
      } finally {
        setIsLoading(false);
      }
    },
    [stripe, elements, onSuccess, onError, email, cartId, clientSecret]
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Error Message Display */}
      {errorMessage && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3 flex-1">
              <h3 className="text-sm font-medium text-red-800">Payment Error</h3>
              <div className="mt-2 text-sm text-red-700">
                {errorMessage}
              </div>
              {!errorMessage.includes('terminal') && !errorMessage.includes('expired') && (
                <div className="mt-3 text-sm text-red-600">
                  <p className="font-medium">You can try again:</p>
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    <li>Check your card details are correct</li>
                    <li>Try a different payment method</li>
                    <li>Contact your bank if the issue persists</li>
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Email Address */}
      <div className="border border-gray-200 rounded-lg p-4">
        <h4 className="text-sm font-semibold mb-3 text-gray-700">Email Address</h4>
        <div className="space-y-2">
          <input
            type="email"
            value={email}
            onChange={handleEmailChange}
            placeholder="your.email@example.com"
            required
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-black ${
              emailError ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          {emailError && (
            <p className="text-sm text-red-600">{emailError}</p>
          )}
          <p className="text-xs text-gray-500">
            We'll send your order confirmation and receipt to this email address.
          </p>
        </div>
      </div>

      {/* Shipping Address (Optional) */}
      {collectShipping && (
        <div className="border border-gray-200 rounded-lg p-4">
          <h4 className="text-sm font-semibold mb-3 text-gray-700">Shipping Address</h4>
          <AddressElement
            onChange={handleShippingChange}
            options={{
              mode: 'shipping',
              allowedCountries: ['US'],
              fields: {
                phone: 'always',
              },
              validation: {
                phone: {
                  required: 'always',
                },
              },
              display: {
                name: 'split',
              },
              // Note: Stripe includes US territories (PR, GU, VI, AS, MP, PW) as states
              // We cannot exclude them via API, but we validate on submission
            }}
          />
        </div>
      )}

      {/* Payment Details with Billing Address */}
      <div className="border border-gray-200 rounded-lg p-4">
        <h4 className="text-sm font-semibold mb-3 text-gray-700">
          Payment Information
        </h4>
        <PaymentElement
          onChange={handlePaymentChange}
          options={{
            layout: 'accordion',
            fields: {
              billingDetails: {
                name: 'auto',
                email: 'never',  // We collect email ourselves
                phone: 'auto',
                address: 'auto',
              },
            },
          }}
        />
      </div>

      <button
        type="submit"
        disabled={isLoading || isProcessing || !stripe || !elements}
        className="w-full bg-[#4188d3] text-white py-3 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#197bbd] transition-colors"
      >
        {isLoading || isProcessing ? 'Processing...' : 'Complete Order'}
      </button>

      {/* SMS Marketing Opt-in Section */}
      <div
        className="bg-white"
        style={{
          border: '1px solid rgb(230, 230, 230)',
          borderRadius: '4px',
          padding: '12px',
          display: 'block',
          boxSizing: 'border-box'
        }}
      >
        <div className="flex items-start gap-3">
          <Checkbox
            id="sms-optin-express"
            checked={smsOptIn}
            onCheckedChange={(checked) => setSmsOptIn(checked as boolean)}
            className="mt-1"
          />
          <div className="flex-1">
            <label
              htmlFor="sms-optin-express"
              className="block cursor-pointer"
              style={{
                fontFamily: '"roboto condensed", sans-serif',
                fontSize: '14px',
                color: 'rgb(111, 111, 111)',
                overflowWrap: 'break-word',
                wordBreak: 'break-word'
              }}
            >
              <div style={{ fontWeight: '500', marginBottom: '4px' }}>
                Get 10% off your next order
              </div>
              <div style={{ color: 'rgb(111, 111, 111)', marginBottom: '8px' }}>
                Sign up to get texts from VNSH and we'll text you a coupon code
              </div>
              <div style={{ fontSize: '14px', color: 'rgb(111, 111, 111)', lineHeight: '1.3' }}>
                By checking this box, you agree to receive recurring automated promotional and personalized marketing text messages <b>(e.g. cart reminders)</b> from VNSH at the cell number used when signing up. Consent is not a condition of any purchase. <b>Reply HELP for help and STOP to cancel.</b> Msg frequency varies. Msg & data rates may apply. View{' '}
                <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ cursor: 'pointer' }}>Terms</a>
                {' '}&{' '}
                <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ cursor: 'pointer' }}>Privacy</a>.
              </div>
            </label>
          </div>
        </div>
      </div>
    </form>
  );
};
