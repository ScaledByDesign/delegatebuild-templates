/**
 * Order Recovery Utility
 * 
 * This module provides functionality to recover failed orders when Stripe payment
 * succeeds but Medusa order creation fails. This can happen due to:
 * - Network issues during cart completion
 * - Mobile browser suspension/closure
 * - Async operation failures between payment and order creation
 * - Race conditions in the checkout flow
 * 
 * CRITICAL: This is a safety net for the critical bug where customers are charged
 * but orders are not created.
 */

import { sdk } from '../sdk';
import { mergeAttributionToCart } from '../data/cart';
import { normalizeStateCode } from './states';

const RECOVERY_KEY = '_pending_order_recovery';
const RECOVERY_EXPIRY_MS = 2 * 60 * 60 * 1000; // 2 hours - give user time to return

export interface OrderRecoveryData {
  cartId: string;
  paymentIntentId: string;
  paymentIntentStatus: string;
  paymentAmount: number;
  timestamp: number;
  expressCheckoutData?: {
    billingDetails?: any;
    shippingAddress?: any;
    shippingRate?: any;
    expressPaymentType?: string;
  };
  email?: string;
  attempts: number;
  lastAttemptTimestamp?: number;
  lastError?: string;
}

/**
 * Saves recovery data for a pending order.
 * Call this IMMEDIATELY after Stripe payment success, BEFORE any other async operations.
 */
export const saveOrderRecoveryData = (data: Omit<OrderRecoveryData, 'attempts' | 'timestamp'>): void => {
  try {
    const recoveryData: OrderRecoveryData = {
      ...data,
      timestamp: Date.now(),
      attempts: 0,
    };
    localStorage.setItem(RECOVERY_KEY, JSON.stringify(recoveryData));
    console.log('💾 Order recovery data saved:', {
      cartId: data.cartId,
      paymentIntentId: data.paymentIntentId?.substring(0, 20) + '...',
    });
  } catch (error) {
    console.error('Failed to save order recovery data:', error);
  }
};

/**
 * Retrieves pending order recovery data if it exists and is not expired.
 */
export const getOrderRecoveryData = (): OrderRecoveryData | null => {
  try {
    const stored = localStorage.getItem(RECOVERY_KEY);
    if (!stored) return null;

    const data: OrderRecoveryData = JSON.parse(stored);
    
    // Check if expired
    if (Date.now() - data.timestamp > RECOVERY_EXPIRY_MS) {
      console.log('⏰ Order recovery data expired, clearing...');
      clearOrderRecoveryData();
      return null;
    }

    return data;
  } catch (error) {
    console.error('Failed to get order recovery data:', error);
    return null;
  }
};

/**
 * Clears order recovery data (call after successful order creation).
 */
export const clearOrderRecoveryData = (): void => {
  try {
    localStorage.removeItem(RECOVERY_KEY);
    console.log('🧹 Order recovery data cleared');
  } catch (error) {
    console.error('Failed to clear order recovery data:', error);
  }
};

/**
 * Updates the recovery data with attempt information.
 */
export const updateRecoveryAttempt = (error?: string): void => {
  try {
    const data = getOrderRecoveryData();
    if (!data) return;

    data.attempts += 1;
    data.lastAttemptTimestamp = Date.now();
    data.lastError = error;
    
    localStorage.setItem(RECOVERY_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to update recovery attempt:', e);
  }
};

/**
 * Attempts to complete a cart with retry logic.
 * Returns the order result or throws after all retries exhausted.
 */
export const completeCartWithRetry = async (
  cartId: string,
  maxRetries: number = 3,
  initialDelayMs: number = 1000
): Promise<any> => {
  let lastError: Error | null = null;

  // Merge attribution (Rumble _raclid + UTMs) into cart metadata before completion.
  // Cart metadata may not include attribution if the cart was created before the
  // user landed via an attributed URL. Helper never throws — safe to await.
  await mergeAttributionToCart(cartId);

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 Cart completion attempt ${attempt}/${maxRetries}...`);

      const result = await sdk.store.cart.complete(cartId);

      if ('type' in result && result.type === 'order') {
        console.log(`✅ Order created successfully on attempt ${attempt}:`, result.order.id);
        return result;
      }

      // If we get a 'cart' type back, the cart wasn't ready for completion
      throw new Error('Order creation returned cart instead of order - cart may not be ready');
    } catch (error: any) {
      lastError = error;
      console.error(`❌ Cart completion attempt ${attempt} failed:`, error.message);

      // Check if this is a non-retryable error
      const isNonRetryable = 
        error.message?.includes('already completed') ||
        error.message?.includes('not found') ||
        error.message?.includes('payment not authorized');

      if (isNonRetryable) {
        console.log('🚫 Non-retryable error detected, stopping retry attempts');
        throw error;
      }

      if (attempt < maxRetries) {
        const delay = initialDelayMs * Math.pow(2, attempt - 1); // Exponential backoff
        console.log(`⏳ Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error('Cart completion failed after all retry attempts');
};

/**
 * Attempts to recover a pending order from saved recovery data.
 * This should be called on checkout page load to handle cases where
 * the user's browser closed or the page was interrupted.
 *
 * @param currentCartId - The current cart ID (if any) to compare against recovery data
 * @returns Object with success status and order/error details
 */
export const attemptOrderRecovery = async (currentCartId?: string): Promise<{
  recovered: boolean;
  orderId?: string;
  error?: string;
  recoveryData?: OrderRecoveryData;
  skipped?: boolean;
}> => {
  const recoveryData = getOrderRecoveryData();

  if (!recoveryData) {
    return { recovered: false };
  }

  console.log('🔍 Found pending order recovery data:', {
    cartId: recoveryData.cartId,
    currentCartId: currentCartId,
    paymentIntentId: recoveryData.paymentIntentId?.substring(0, 20) + '...',
    attempts: recoveryData.attempts,
    ageMinutes: Math.round((Date.now() - recoveryData.timestamp) / 60000),
  });

  // If we have a current cart and it's different from the recovery cart,
  // the user has started a new checkout. Clear the old recovery data.
  if (currentCartId && currentCartId !== recoveryData.cartId) {
    console.log('🔄 Current cart differs from recovery cart. User started new checkout.');
    console.log(`   Recovery cart: ${recoveryData.cartId}`);
    console.log(`   Current cart:  ${currentCartId}`);
    clearOrderRecoveryData();
    return { recovered: false, skipped: true };
  }

  // Don't retry too many times
  if (recoveryData.attempts >= 5) {
    console.warn('⚠️ Max recovery attempts reached, manual intervention required');
    return {
      recovered: false,
      error: 'Maximum recovery attempts reached. Please contact support.',
      recoveryData,
    };
  }

  try {
    // First, check if the cart still exists and is not already completed
    const { cart } = await sdk.store.cart.retrieve(recoveryData.cartId);

    if (!cart) {
      console.log('🔍 Cart not found, may have been completed or expired');
      clearOrderRecoveryData();
      return { recovered: false, error: 'Cart not found' };
    }

    if ((cart as any).completed_at) {
      console.log('✅ Cart was already completed, clearing recovery data');
      clearOrderRecoveryData();
      return { recovered: true, orderId: (cart as any).order_id };
    }

    // Update attempt counter
    updateRecoveryAttempt();

    // Sync shipping address from recovery data before completing.
    // When iOS interrupts the page after Apple Pay confirmation but before
    // handlePaymentSuccess finishes, the cart can still have the
    // "Address pending - Express Checkout" placeholder written during the
    // onShippingAddressChange phase. The real address is in recovery data —
    // apply it now so the order ships to the correct address.
    const recoveryShipping = recoveryData.expressCheckoutData?.shippingAddress;
    const cartAddress1 = (cart as any).shipping_address?.address_1 || '';
    const hasPlaceholderAddress =
      !cartAddress1 ||
      cartAddress1.toLowerCase().includes('pending') ||
      cartAddress1 === 'Address not provided' ||
      /\S+@\S+\.\S+/.test(cartAddress1);

    if (recoveryShipping?.address?.line1?.trim() && hasPlaceholderAddress) {
      console.log('📍 Recovery: syncing shipping address before cart completion...');
      try {
        const nameParts = (recoveryShipping.name || '').trim().split(/\s+/);
        const firstName = nameParts[0] || 'Customer';
        const lastName = nameParts.slice(1).join(' ') || '';
        const countryCode = (recoveryShipping.address.country || 'US').toLowerCase();
        const normalizedState = normalizeStateCode(recoveryShipping.address.state);
        const province = normalizedState ? `${countryCode}-${normalizedState}` : '';
        const phone = recoveryData.expressCheckoutData?.billingDetails?.phone || recoveryShipping.phone || '';

        await sdk.store.cart.update(recoveryData.cartId, {
          shipping_address: {
            first_name: firstName,
            last_name: lastName,
            address_1: recoveryShipping.address.line1,
            address_2: recoveryShipping.address.line2 || '',
            city: recoveryShipping.address.city || '',
            province,
            postal_code: recoveryShipping.address.postal_code || '',
            country_code: countryCode,
            phone,
          },
        });
        console.log('✅ Recovery: shipping address synced:', recoveryShipping.address.line1);
      } catch (addressError: any) {
        // Don't block recovery — completing the order takes priority.
        // CX can correct the address post-order if needed.
        console.warn('⚠️ Recovery: failed to sync shipping address, proceeding anyway:', addressError.message);
      }
    }

    // Attempt to complete the cart
    const result = await completeCartWithRetry(recoveryData.cartId, 2, 500);

    if ('type' in result && result.type === 'order') {
      console.log('✅ Order recovered successfully:', result.order.id);
      clearOrderRecoveryData();
      return { recovered: true, orderId: result.order.id };
    }

    return { recovered: false, error: 'Order completion did not return an order' };
  } catch (error: any) {
    console.error('❌ Order recovery failed:', error.message);
    updateRecoveryAttempt(error.message);
    return {
      recovered: false,
      error: error.message,
      recoveryData,
    };
  }
};

/**
 * Checks if there's a pending order that needs recovery.
 * Use this for UI display purposes.
 */
export const hasPendingOrderRecovery = (): boolean => {
  return getOrderRecoveryData() !== null;
};

