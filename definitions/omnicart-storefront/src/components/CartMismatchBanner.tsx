/* eslint-disable react-refresh/only-export-components */
import React, { useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, X, ShoppingCart } from 'lucide-react';
import { useCart } from '@/hooks/useCart';
import { useCustomer } from '@/hooks/useCustomer';

interface CartMismatchBannerProps {
  localCartItems: number;
  serverCartItems: number;
  onResolve?: () => void;
  onDismiss?: () => void;
}

const CartMismatchBanner: React.FC<CartMismatchBannerProps> = ({
  localCartItems,
  serverCartItems,
  onResolve,
  onDismiss
}) => {
  const [isResolving, setIsResolving] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const { cart } = useCart();
  const { customer } = useCustomer();

  // Don't show banner if dismissed or if user is not logged in
  if (isDismissed || !customer) {
    return null;
  }

  // Don't show if there's no mismatch
  if (localCartItems === serverCartItems) {
    return null;
  }

  const handleResolve = async () => {
    setIsResolving(true);
    try {
      // Call the resolve function if provided
      if (onResolve) {
        await onResolve();
      }
      
      // Auto-dismiss after resolution
      setTimeout(() => {
        setIsDismissed(true);
      }, 2000);
    } catch (error) {
      console.error('Error resolving cart mismatch:', error);
    } finally {
      setIsResolving(false);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    if (onDismiss) {
      onDismiss();
    }
  };

  const getMismatchMessage = () => {
    if (localCartItems > serverCartItems) {
      return `You have ${localCartItems} items locally but ${serverCartItems} items in your account. Some items may not be saved.`;
    } else {
      return `You have ${serverCartItems} items in your account but ${localCartItems} items locally. Your cart may be out of sync.`;
    }
  };

  return (
    <Alert className="border-orange-200 bg-orange-50 text-orange-800 mb-4">
      <AlertTriangle className="h-4 w-4 text-orange-600" />
      <AlertDescription className="flex items-center justify-between w-full">
        <div className="flex items-center gap-3 flex-1">
          <ShoppingCart className="h-4 w-4 text-orange-600" />
          <div className="flex-1">
            <p className="font-medium text-sm">Cart Synchronization Issue</p>
            <p className="text-xs text-orange-700 mt-1">
              {getMismatchMessage()}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 ml-4">
          <Button
            variant="outline"
            size="sm"
            onClick={handleResolve}
            disabled={isResolving}
            className="border-orange-300 text-orange-700 hover:bg-orange-100 text-xs px-3 py-1"
          >
            {isResolving ? (
              <>
                <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw className="h-3 w-3 mr-1" />
                Sync Cart
              </>
            )}
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            className="text-orange-600 hover:text-orange-800 hover:bg-orange-100 p-1"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
};

// Hook to detect cart mismatches
export const useCartMismatchDetection = () => {
  const { cart } = useCart();
  const { customer } = useCustomer();
  const [localCartCount, setLocalCartCount] = useState(0);
  const [serverCartCount, setServerCartCount] = useState(0);
  const [hasMismatch, setHasMismatch] = useState(false);

  React.useEffect(() => {
    if (!customer || !cart) {
      setHasMismatch(false);
      return;
    }

    // Get local cart count (from localStorage or current cart)
    const localCount = cart.items?.length || 0;
    
    // Get server cart count (this would typically come from a separate API call)
    // For now, we'll simulate this by checking if there's a discrepancy
    const serverCount = cart.items?.length || 0;
    
    setLocalCartCount(localCount);
    setServerCartCount(serverCount);
    
    // Detect mismatch (this logic would be more sophisticated in a real app)
    const mismatch = Math.abs(localCount - serverCount) > 0;
    setHasMismatch(mismatch);
  }, [cart, customer]);

  return {
    hasMismatch,
    localCartCount,
    serverCartCount,
    setHasMismatch
  };
};

export default CartMismatchBanner;

// Also exported as a named export so either import style resolves
// (`import CartMismatchBanner from ...` or `import { CartMismatchBanner } from ...`).
export { CartMismatchBanner };
