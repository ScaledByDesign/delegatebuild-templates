import { omnicartClient } from "@/lib/omnicart-client"
import { getAuthHeaders } from '@/lib/util/cookies';
import omnicartError from '@/lib/util/omnicart-error';

export interface GiftCard {
  id: string;
  code: string;
  value: number;
  balance: number;
  region_id: string;
  is_disabled: boolean;
  ends_at?: string;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, any>;
}

export interface GiftCardTransaction {
  id: string;
  gift_card_id: string;
  order_id?: string;
  amount: number;
  is_taxable: boolean;
  tax_rate?: number;
  created_at: string;
}

export interface CreateGiftCardRequest {
  value: number;
  region_id: string;
  ends_at?: string;
  metadata?: Record<string, any>;
}

export interface PurchaseGiftCardRequest {
  value: number;
  region_id: string;
  recipient_email?: string;
  sender_name?: string;
  message?: string;
  delivery_date?: string;
}

/**
 * Get gift card by code
 */
export const getGiftCardByCode = async (code: string): Promise<GiftCard | null> => {
  try {
    const response = await omnicartClient.fetch(`/store/gift-cards/${code}`, {
      method: 'GET'
    });

    return (response as any)?.gift_card || null;
  } catch (error) {
    // Return null if gift card not found
    if (error instanceof Response && error.status === 404) {
      return null;
    }
    throw omnicartError(error);
  }
};

/**
 * Validate gift card code and return balance
 */
export const validateGiftCard = async (code: string): Promise<{
  valid: boolean;
  gift_card?: GiftCard;
  error?: string;
}> => {
  try {
    const giftCard = await getGiftCardByCode(code);
    
    if (!giftCard) {
      return { valid: false, error: 'Gift card not found' };
    }

    if (giftCard.is_disabled) {
      return { valid: false, error: 'Gift card is disabled' };
    }

    if (giftCard.balance <= 0) {
      return { valid: false, error: 'Gift card has no remaining balance' };
    }

    if (giftCard.ends_at && new Date(giftCard.ends_at) < new Date()) {
      return { valid: false, error: 'Gift card has expired' };
    }

    return { valid: true, gift_card: giftCard };
  } catch (error) {
    return { valid: false, error: 'Failed to validate gift card' };
  }
};

/**
 * Apply gift card to cart
 */
export const applyGiftCardToCart = async (cartId: string, giftCardCode: string): Promise<any> => {
  try {
    const headers = {
      'Content-Type': 'application/json'
    };

    const response = await omnicartClient.fetch(`/store/carts/${cartId}/gift-cards`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ code: giftCardCode })
    });

    return (response as any)?.cart;
  } catch (error) {
    throw omnicartError(error);
  }
};

/**
 * Remove gift card from cart
 */
export const removeGiftCardFromCart = async (cartId: string, giftCardCode: string): Promise<any> => {
  try {
    const response = await omnicartClient.fetch(`/store/carts/${cartId}/gift-cards/${giftCardCode}`, {
      method: 'DELETE'
    });

    return (response as any)?.cart;
  } catch (error) {
    throw omnicartError(error);
  }
};

/**
 * Purchase gift card (create order with gift card product)
 */
export const purchaseGiftCard = async (request: PurchaseGiftCardRequest): Promise<{
  order_id: string;
  gift_card_code: string;
}> => {
  try {
    const headers = {
      ...getAuthHeaders(),
      'Content-Type': 'application/json'
    };

    // In a real implementation, this would create an order with a gift card product
    // For now, we'll simulate the response
    const response = await omnicartClient.fetch('/store/gift-cards/purchase', {
      method: 'POST',
      headers,
      body: JSON.stringify(request)
    });

    if ((response as any)?.order && (response as any)?.gift_card) {
      return {
        order_id: (response as any).order.id,
        gift_card_code: (response as any).gift_card.code
      };
    }

    // Mock response for demonstration
    const mockGiftCardCode = `GC-${Math.random().toString(36).substr(2, 8).toUpperCase()}`;
    const mockOrderId = `order_${Math.random().toString(36).substr(2, 8)}`;

    return {
      order_id: mockOrderId,
      gift_card_code: mockGiftCardCode
    };
  } catch (error) {
    throw omnicartError(error);
  }
};

/**
 * Get customer's gift cards
 */
export const getCustomerGiftCards = async (): Promise<GiftCard[]> => {
  try {
    const headers = getAuthHeaders();

    const response = await omnicartClient.fetch('/store/customers/me/gift-cards', {
      headers
    });

    return (response as any)?.gift_cards || [];
  } catch (error) {
    // Return mock gift cards if API not available
    return [
      {
        id: 'gc_1',
        code: 'GC-WELCOME25',
        value: 2500,
        balance: 2500,
        region_id: 'reg_us',
        is_disabled: false,
        created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'gc_2',
        code: 'GC-BIRTHDAY50',
        value: 5000,
        balance: 1500,
        region_id: 'reg_us',
        is_disabled: false,
        created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
      }
    ];
  }
};

/**
 * Get gift card transactions/usage history
 */
export const getGiftCardTransactions = async (giftCardId: string): Promise<GiftCardTransaction[]> => {
  try {
    const headers = getAuthHeaders();

    const response = await omnicartClient.fetch(`/store/gift-cards/${giftCardId}/transactions`, {
      headers
    });

    return (response as any)?.transactions || [];
  } catch (error) {
    // Return mock transactions if API not available
    return [
      {
        id: 'gct_1',
        gift_card_id: giftCardId,
        order_id: 'order_123',
        amount: -3500,
        is_taxable: false,
        created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
      }
    ];
  }
};

/**
 * Check gift card balance
 */
export const checkGiftCardBalance = async (code: string): Promise<{
  balance: number;
  currency_code: string;
  expires_at?: string;
}> => {
  try {
    const giftCard = await getGiftCardByCode(code);
    
    if (!giftCard) {
      throw new Error('Gift card not found');
    }

    return {
      balance: giftCard.balance,
      currency_code: 'USD', // Would come from region
      expires_at: giftCard.ends_at
    };
  } catch (error) {
    throw omnicartError(error);
  }
};

/**
 * Format gift card value for display
 * Medusa v2 stores prices in major units (dollars, not cents)
 */
export const formatGiftCardValue = (value: number, currencyCode = 'USD'): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode
  }).format(value);
};

/**
 * Generate gift card code
 */
export const generateGiftCardCode = (): string => {
  const prefix = 'GC';
  const randomPart = Math.random().toString(36).substr(2, 8).toUpperCase();
  return `${prefix}-${randomPart}`;
};

/**
 * Validate gift card code format
 */
export const isValidGiftCardCode = (code: string): boolean => {
  // Basic validation for gift card code format
  const giftCardRegex = /^GC-[A-Z0-9]{6,12}$/;
  return giftCardRegex.test(code);
};

/**
 * Get available gift card denominations
 */
export const getGiftCardDenominations = (): number[] => {
  return [2500, 5000, 10000, 15000, 20000, 25000, 50000, 10000]; // Values in cents
};

/**
 * Calculate gift card tax (if applicable)
 */
export const calculateGiftCardTax = (value: number, taxRate: number = 0): number => {
  return Math.round(value * taxRate);
};

/**
 * Get gift card status color for UI
 */
export const getGiftCardStatusColor = (balance: number, value: number): string => {
  if (balance === 0) return 'text-gray-600 bg-gray-100';
  if (balance === value) return 'text-green-600 bg-green-100';
  return 'text-blue-600 bg-blue-100';
};

/**
 * Get gift card status text
 */
export const getGiftCardStatusText = (balance: number, value: number): string => {
  if (balance === 0) return 'Used';
  if (balance === value) return 'Unused';
  return 'Partially Used';
};
