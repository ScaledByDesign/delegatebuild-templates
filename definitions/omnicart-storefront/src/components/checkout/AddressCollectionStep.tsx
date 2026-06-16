import React from 'react';
import { AddressElement } from '@stripe/react-stripe-js';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import type { Cart } from '@medusajs/types';

interface AddressCollectionStepProps {
  cart: Cart | null;
  onAddressComplete: (address: any) => Promise<void>;
  onContinueToPayment: () => void;
  isUpdating: boolean;
}

export const AddressCollectionStep: React.FC<AddressCollectionStepProps> = ({
  cart,
  onAddressComplete,
  onContinueToPayment,
  isUpdating,
}) => {
  const [addressEntered, setAddressEntered] = React.useState(false);
  const [isValidating, setIsValidating] = React.useState(false);

  const handleAddressChange = async (event: any) => {
    if (event.complete) {
      setIsValidating(true);
      try {
        await onAddressComplete(event.value);
        setAddressEntered(true);
      } catch (error) {
        console.error('Failed to update address:', error);
      } finally {
        setIsValidating(false);
      }
    } else {
      setAddressEntered(false);
    }
  };

  const canContinue = addressEntered && cart?.shipping_address && !isUpdating && !isValidating;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Shipping Address</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Enter your shipping address to calculate tax and shipping costs.
        </p>
        
        <div className="border rounded-lg p-4 bg-card">
          <AddressElement
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
            }}
            onChange={handleAddressChange}
          />
        </div>
      </div>

      {/* Show cart summary after address is entered */}
      {addressEntered && cart && (
        <div className="border rounded-lg p-4 bg-muted/50">
          <h4 className="font-medium mb-3">Order Summary</h4>
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

      {/* Continue button */}
      <Button
        onClick={onContinueToPayment}
        disabled={!canContinue}
        className="w-full"
        size="lg"
      >
        {isUpdating || isValidating ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Calculating...
          </>
        ) : (
          'Continue to Payment'
        )}
      </Button>

      {!addressEntered && (
        <p className="text-xs text-center text-muted-foreground">
          Please complete your shipping address to continue
        </p>
      )}
    </div>
  );
};

