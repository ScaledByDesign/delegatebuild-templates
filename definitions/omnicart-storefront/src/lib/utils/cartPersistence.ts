import { getCartId, setCartId, removeCartId } from '../util/cookies';
import { CartItem, Cart } from '@/hooks/useCart';

export interface CartState {
  cartId: string;
  items: CartItem[];
  lastUpdated: number;
  customerId?: string;
}

const CART_STORAGE_KEY = 'vnsh_cart_state';
const CART_EXPIRY_DAYS = 30;

/**
 * Save cart state to localStorage
 */
export const saveCartState = (cartState: CartState): void => {
  try {
    const stateWithExpiry = {
      ...cartState,
      expiresAt: Date.now() + (CART_EXPIRY_DAYS * 24 * 60 * 60 * 1000)
    };
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(stateWithExpiry));
  } catch (error) {
    console.warn('Failed to save cart state to localStorage:', error);
  }
};

/**
 * Load cart state from localStorage
 */
export const loadCartState = (): CartState | null => {
  try {
    const stored = localStorage.getItem(CART_STORAGE_KEY);
    if (!stored) return null;

    const parsed = JSON.parse(stored);
    
    // Check if expired
    if (parsed.expiresAt && Date.now() > parsed.expiresAt) {
      clearCartState();
      return null;
    }

    return {
      cartId: parsed.cartId,
      items: parsed.items || [],
      lastUpdated: parsed.lastUpdated || Date.now(),
      customerId: parsed.customerId
    };
  } catch (error) {
    console.warn('Failed to load cart state from localStorage:', error);
    return null;
  }
};

/**
 * Clear cart state from localStorage
 */
export const clearCartState = (): void => {
  try {
    localStorage.removeItem(CART_STORAGE_KEY);
  } catch (error) {
    console.warn('Failed to clear cart state from localStorage:', error);
  }
};

/**
 * Sync cart state with server for logged-in users
 */
export const syncCartWithServer = async (
  localCart: Cart,
  customerId: string
): Promise<Cart> => {
  try {
    // This would typically make an API call to sync with the server
    // For now, we'll just update the local state with customer ID
    const updatedState: CartState = {
      cartId: localCart.id,
      items: localCart.items,
      lastUpdated: Date.now(),
      customerId
    };

    saveCartState(updatedState);
    return localCart;
  } catch (error) {
    console.error('Failed to sync cart with server:', error);
    throw error;
  }
};

/**
 * Merge guest cart with user cart on login
 */
export const mergeGuestCartWithUserCart = async (
  guestCart: Cart,
  userCart: Cart
): Promise<Cart> => {
  try {
    // Simple merge strategy: combine items from both carts
    const mergedItems = [...userCart.items];
    
    // Add guest cart items that don't already exist
    for (const guestItem of guestCart.items) {
      const existingItem = mergedItems.find(item => 
        item.variant?.id === guestItem.variant?.id
      );
      
      if (existingItem) {
        // Update quantity if item exists
        existingItem.quantity += guestItem.quantity;
      } else {
        // Add new item
        mergedItems.push(guestItem);
      }
    }

    // Return the user cart with merged items
    return {
      ...userCart,
      items: mergedItems
    };
  } catch (error) {
    console.error('Failed to merge guest cart with user cart:', error);
    throw error;
  }
};

/**
 * Handle cart persistence on login
 */
export const handleCartOnLogin = async (
  currentCart: Cart,
  customerId: string
): Promise<Cart> => {
  try {
    // Load any existing cart state
    const savedState = loadCartState();
    
    // If there's a saved cart for a different user, clear it
    if (savedState && savedState.customerId && savedState.customerId !== customerId) {
      clearCartState();
    }

    // Sync current cart with server
    const syncedCart = await syncCartWithServer(currentCart, customerId);
    
    return syncedCart;
  } catch (error) {
    console.error('Failed to handle cart on login:', error);
    return currentCart;
  }
};

/**
 * Handle cart persistence on logout
 */
export const handleCartOnLogout = (): void => {
  try {
    // Clear customer-specific cart state
    clearCartState();
    
    // Clear cart ID cookie
    removeCartId();
  } catch (error) {
    console.error('Failed to handle cart on logout:', error);
  }
};

/**
 * Auto-save cart state periodically
 */
export const setupCartAutoSave = (
  getCartState: () => Cart,
  customerId?: string,
  intervalMs: number = 30000 // 30 seconds
): (() => void) => {
  const interval = setInterval(() => {
    try {
      const cart = getCartState();
      if (cart && cart.id) {
        const state: CartState = {
          cartId: cart.id,
          items: cart.items,
          lastUpdated: Date.now(),
          customerId
        };
        saveCartState(state);
      }
    } catch (error) {
      console.warn('Failed to auto-save cart state:', error);
    }
  }, intervalMs);

  // Return cleanup function
  return () => clearInterval(interval);
};

/**
 * Restore cart from saved state
 */
export const restoreCartFromSavedState = async (
  customerId?: string
): Promise<string | null> => {
  try {
    const savedState = loadCartState();
    
    if (!savedState) return null;
    
    // If user is logged in, only restore if it's their cart
    if (customerId && savedState.customerId !== customerId) {
      return null;
    }
    
    // If user is not logged in, only restore guest carts
    if (!customerId && savedState.customerId) {
      return null;
    }

    return savedState.cartId;
  } catch (error) {
    console.error('Failed to restore cart from saved state:', error);
    return null;
  }
};
