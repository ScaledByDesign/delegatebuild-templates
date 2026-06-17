/**
 * Order Recovery — local storage layer (NO network / SDK imports).
 *
 * These helpers persist and read the "pending order recovery" record in
 * localStorage. They are deliberately free of any Medusa SDK import so that
 * always-loaded modules (e.g. the cart provider, which only needs to CLEAR the
 * record) can use them without pulling the heavy checkout SDK into the
 * first-paint bundle. The SDK-driven recovery logic lives in `orderRecovery.ts`.
 */

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
 * Checks if there's a pending order that needs recovery.
 * Use this for UI display purposes.
 */
export const hasPendingOrderRecovery = (): boolean => {
  return getOrderRecoveryData() !== null;
};
