
/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useRef, useState } from "react";
import {
  addToCart,
  retrieveCart,
  removeLineItem,
  updateLineItem,
  getOrCreateCart
} from "@/lib/data/cart";
import { useToast } from "@/hooks/use-toast";
import { useCustomer } from "@/hooks/useCustomer";
import { useCartSummary } from "@/context/CartSummaryContext";
import {
  saveCartState,
  loadCartState,
  clearCartState,
  handleCartOnLogin,
  handleCartOnLogout,
  setupCartAutoSave,
  restoreCartFromSavedState
} from "@/lib/utils/cartPersistence";
import { removeCartId } from "@/lib/util/cookies";
import { clearOrderRecoveryData } from "@/lib/checkout/orderRecoveryStorage";
import { trackAddToCart } from "@/hooks/useTracking";

export interface CartItem {
  id: string;
  title: string;
  quantity: number;
  unit_price: number;
  total: number;
  variant?: {
    id: string;
    title: string;
  };
  product?: {
    id: string;
    title: string;
    handle: string;
    thumbnail?: string;
  };
  thumbnail?: string;
  metadata?: Record<string, unknown>;
  // Additional properties for compatibility
  image?: string;
  name?: string;
  description?: string;
  price?: number;
}

export interface Cart {
  id: string;
  email?: string;
  items: CartItem[];
  subtotal: number;
  total: number;
  tax_total: number;
  shipping_total: number;
  discount_total: number;
  region?: {
    id: string;
    name: string;
    currency_code: string;
  };
  shipping_address?: Record<string, unknown>;
  billing_address?: Record<string, unknown>;
  shipping_methods?: Record<string, unknown>[];
  payment_sessions?: Record<string, unknown>[];
  created_at: string;
  updated_at: string;
  gift_cards?: any[];
  [key: string]: any; // Add index signature for compatibility
}

type CartContextType = {
  cart: Cart | null;
  isLoading: boolean;
  addItem: (variantId: string, quantity?: number) => Promise<void>;
  removeItem: (lineId: string) => Promise<void>;
  updateItemQuantity: (lineId: string, quantity: number) => Promise<void>;
  clearCart: () => void;
  refreshCart: () => Promise<void>;
  setCart: (cart: Cart | null) => void;
};

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider = ({ children }: { children: React.ReactNode }) => {
  const [cart, setCart] = useState<Cart | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { customer } = useCustomer();
  const { openSummary } = useCartSummary();

  useEffect(() => {
    const initCart = async () => {
      try {
        // Always try to get or create a cart (this will use session cart if available)
        const cartData = await getOrCreateCart();
        setCart(cartData);

        // Save initial cart state
        if (cartData) {
          saveCartState({
            cartId: cartData.id,
            items: cartData.items || [],
            lastUpdated: Date.now(),
            customerId: customer?.id
          });
        }
      } catch (error) {
        console.error("Error initializing cart:", error);
      } finally {
        setIsLoading(false);
      }
    };

    initCart();
  }, [customer?.id]);

  // Auto-save cart state
  useEffect(() => {
    if (!cart) return;

    const cleanup = setupCartAutoSave(
      () => cart,
      customer?.id,
      30000 // Save every 30 seconds
    );

    return cleanup;
  }, [cart, customer?.id]);

  // Handle customer login/logout
  const lastCustomerId = useRef<string | null>(null);

  useEffect(() => {
    if (!cart) return;

    const handleCustomerChange = async () => {
      const customerId = customer?.id;

      if (customerId) {
        if (lastCustomerId.current === customerId) {
          return;
        }

        try {
          const syncedCart = await handleCartOnLogin(cart, customerId);
          setCart(syncedCart as Cart);
          lastCustomerId.current = customerId;
        } catch (error) {
          console.error("Error syncing cart on login:", error);
        }
      } else if (lastCustomerId.current) {
        handleCartOnLogout();
        lastCustomerId.current = null;
      }
    };

    handleCustomerChange();
  }, [customer?.id, cart?.id, cart]);

  const addItem = async (variantId: string, quantity = 1) => {
    setIsLoading(true);

    try {
      const updatedCart = await addToCart(variantId, quantity);
      setCart(updatedCart);

      // Save cart state
      saveCartState({
        cartId: updatedCart.id,
        items: updatedCart.items || [],
        lastUpdated: Date.now(),
        customerId: customer?.id
      });

      // Find the newly added item (exclude mystery gift line items)
      const visibleItems = updatedCart.items?.filter(
        (item: any) => !item.metadata?.is_mystery_gift
      ) || [];
      if (visibleItems.length > 0) {
        const lastAddedItem = visibleItems[visibleItems.length - 1];
        const totalCartQuantity = visibleItems.reduce((sum, item) => sum + item.quantity, 0);

        // Track add to cart event for analytics (GTM, Facebook Pixel, CustomerLabs, Attentive)
        trackAddToCart({
          id: lastAddedItem.product?.id || lastAddedItem.id,
          title: lastAddedItem.title,
          price: lastAddedItem.unit_price,
          quantity: lastAddedItem.quantity,
          variant_id: lastAddedItem.variant?.id || variantId,
          // Only include optional fields if they have values (Attentive best practice: avoid empty strings)
          image_url: lastAddedItem.thumbnail || lastAddedItem.product?.thumbnail || undefined,
          category: undefined, // Category not available in cart item data
        });

        // Show cart summary popover instead of toast
        openSummary({
          item: {
            id: lastAddedItem.id,
            title: lastAddedItem.title,
            thumbnail: lastAddedItem.thumbnail,
            variant: lastAddedItem.variant?.title,
            quantity: lastAddedItem.quantity,
            price: lastAddedItem.unit_price,
            total: lastAddedItem.total,
          },
          cartTotal: updatedCart.total, // API sends prices in dollars
          cartItemCount: totalCartQuantity,
        });
      }
    } catch (error: any) {
      console.error("Error adding item to cart:", error);
      const message = error?.message || "Failed to add item to cart";
      toast({
        variant: "destructive",
        title: "Error",
        description: message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const removeItem = async (lineId: string) => {
    setIsLoading(true);

    try {
      if (!cart?.id) {
        throw new Error("No cart found");
      }

      const updatedCart = await removeLineItem(cart.id, lineId);
      const nextCart = updatedCart ?? (await retrieveCart(cart.id));

      if (nextCart) {
        setCart(nextCart);

        // Save cart state when we have a valid cart payload
        saveCartState({
          cartId: nextCart.id,
          items: nextCart.items || [],
          lastUpdated: Date.now(),
          customerId: customer?.id
        });
      } else {
        setCart(null);
        clearCartState();
      }

      toast({
        title: "Removed from cart",
        description: "Item has been removed from your cart",
      });
    } catch (error) {
      console.error("Error removing item from cart:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to remove item from cart",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const updateItemQuantity = async (lineId: string, quantity: number) => {
    setIsLoading(true);

    try {
      if (!cart?.id) {
        throw new Error("No cart found");
      }

      const updatedCart = await updateLineItem(cart.id, lineId, quantity);
      setCart(updatedCart);

      // Save cart state
      saveCartState({
        cartId: updatedCart.id,
        items: updatedCart.items || [],
        lastUpdated: Date.now(),
        customerId: customer?.id
      });

      toast({
        title: "Cart updated",
        description: "Item quantity has been updated",
      });
    } catch (error) {
      console.error("Error updating cart:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update cart",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const clearCart = () => {
    // Clear the cart state
    setCart(null);

    // Clear all persisted cart data so a fresh cart is created
    clearCartState();

    // Clear order recovery data (pending payment data)
    clearOrderRecoveryData();

    // Remove the cart ID cookie (_medusa_cart_id)
    removeCartId();

    // Clear session storage used for cart recreation loop prevention
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('_cart_recreate_time');
    }

    console.log('🧹 Cart fully cleared: state, localStorage, cookie, and recovery data');
  };

  const refreshCart = async () => {
    try {
      setIsLoading(true);
      const cartData = await retrieveCart();
      setCart(cartData);
    } catch (error) {
      console.error("Error refreshing cart:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <CartContext.Provider
      value={{
        cart,
        isLoading,
        addItem,
        removeItem,
        updateItemQuantity,
        clearCart,
        refreshCart,
        setCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
};
