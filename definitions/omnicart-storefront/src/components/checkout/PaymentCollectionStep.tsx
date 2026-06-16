import React from 'react';
import { PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Button } from '@/components/ui/button';
import { Loader2, Lock } from 'lucide-react';
import type { Cart } from '@medusajs/types';
import { medusaClient } from '@/lib/medusa-client';

interface PaymentCollectionStepProps {
  cart: Cart | null;
  clientSecret: string;
  onSuccess: (orderId: string) => void;
  onError: (error: string) => void;
  onBackToAddress: () => void;
}

export const PaymentCollectionStep: React.FC<PaymentCollectionStepProps> = ({
  cart,
  clientSecret,
  onSuccess,
  onError,
  onBackToAddress,
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [paymentReady, setPaymentReady] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements || !cart?.id) {
      return;
    }

    setIsProcessing(true);

    try {
      // Build billing details from shipping address
      const shippingAddr = cart.shipping_address;
      const billingDetails = shippingAddr ? {
        name: `${shippingAddr.first_name || ''} ${shippingAddr.last_name || ''}`.trim(),
        email: cart.email || undefined,
        phone: shippingAddr.phone || undefined,
        address: {
          line1: shippingAddr.address_1 || '',
          line2: shippingAddr.address_2 || undefined,
          city: shippingAddr.city || '',
          state: shippingAddr.province?.replace(/^us-/i, '').toUpperCase() || '',
          postal_code: shippingAddr.postal_code || '',
          country: 'US',
        },
      } : undefined;

      // Confirm the payment with Stripe
      const { error: confirmError } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/order/confirmed`,
          payment_method_data: billingDetails ? {
            billing_details: billingDetails,
          } : undefined,
        },
        redirect: 'if_required',
      });

      if (confirmError) {
        onError(confirmError.message || 'Payment failed');
        setIsProcessing(false);
        return;
      }

      // Complete the cart in Medusa
      const responseData = await medusaClient.post<{ order: any }>(`/store/carts/${cart.id}/complete`);
      onSuccess(responseData.order.id);
    } catch (error) {
      console.error('Payment error:', error);
      onError(error instanceof Error ? error.message : 'Payment failed');
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Payment Details</h3>
          <button
            type="button"
            onClick={onBackToAddress}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Edit Address
          </button>
        </div>

        {/* Shipping Address Summary */}
        {cart?.shipping_address && (
          <div className="mb-4 p-3 bg-muted/50 rounded-lg text-sm">
            <p className="font-medium mb-1">Shipping to:</p>
            <p className="text-muted-foreground">
              {cart.shipping_address.first_name} {cart.shipping_address.last_name}
              <br />
              {cart.shipping_address.address_1}
              {cart.shipping_address.address_2 && (
                <>
                  <br />
                  {cart.shipping_address.address_2}
                </>
              )}
              <br />
              {cart.shipping_address.city}, {cart.shipping_address.province}{' '}
              {cart.shipping_address.postal_code}
            </p>
          </div>
        )}

        {/* Payment Element */}
        <div className="border rounded-lg p-4 bg-card">
          <PaymentElement
            options={{
              layout: 'tabs',
              fields: {
                billingDetails: {
                  // Shipping address already collected - hide billing fields
                  // Billing will be set same as shipping in confirmPayment
                  name: 'never',
                  email: 'never',
                  phone: 'never',
                  address: 'never',
                },
              },
            }}
            onReady={() => setPaymentReady(true)}
          />
        </div>
      </div>

      {/* Order Summary */}
      {cart && (
        <div className="border rounded-lg p-4 bg-muted/50">
          <h4 className="font-medium mb-3">Order Total</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>${((cart.subtotal || 0) / 100).toFixed(2)}</span>
            </div>
            {cart.shipping_total !== undefined && cart.shipping_total > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Shipping</span>
                <span>${(cart.shipping_total / 100).toFixed(2)}</span>
              </div>
            )}
            {cart.tax_total !== undefined && cart.tax_total > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tax</span>
                <span>${(cart.tax_total / 100).toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold text-base pt-2 border-t">
              <span>Total</span>
              <span>${((cart.total || 0) / 100).toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Submit Button */}
      <Button
        type="submit"
        disabled={!stripe || !paymentReady || isProcessing}
        className="w-full"
        size="lg"
      >
        {isProcessing ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <Lock className="mr-2 h-4 w-4" />
            Pay ${((cart?.total || 0) / 100).toFixed(2)}
          </>
        )}
      </Button>

      <p className="text-xs text-center text-muted-foreground">
        Your payment information is secure and encrypted
      </p>
    </form>
  );
};

