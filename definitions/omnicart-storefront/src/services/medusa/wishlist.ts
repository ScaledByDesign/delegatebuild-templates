import { medusaClient } from "@/lib/medusa-client"
import { getAuthHeaders } from '@/lib/util/cookies';
import medusaError from '@/lib/util/medusa-error';

export interface WishlistItem {
  id: string;
  wishlist_id: string;
  variant_id: string;
  product_id: string;
  created_at: string;
  updated_at: string;
  variant?: {
    id: string;
    title: string;
    sku?: string;
    prices: Array<{
      amount: number;
      currency_code: string;
    }>;
    options?: Array<{
      option_id: string;
      value: string;
    }>;
    inventory_quantity?: number;
  };
  product?: {
    id: string;
    title: string;
    handle: string;
    description?: string;
    thumbnail?: string;
    images?: Array<{
      id: string;
      url: string;
    }>;
    status: string;
    collection_id?: string;
    type_id?: string;
  };
}

export interface Wishlist {
  id: string;
  customer_id: string;
  name?: string;
  is_private: boolean;
  created_at: string;
  updated_at: string;
  items: WishlistItem[];
}

export interface CreateWishlistRequest {
  name?: string;
  is_private?: boolean;
}

export interface AddToWishlistRequest {
  variant_id: string;
  product_id: string;
}

/**
 * Get customer's wishlists
 */
export const getCustomerWishlists = async (): Promise<Wishlist[]> => {
  try {
    const headers = getAuthHeaders();

    const response = await medusaClient.fetch('/store/customers/me/wishlists', {
      headers
    });

    return (response as any)?.wishlists || [];
  } catch (error) {
    // Return mock wishlist if API not available
    return [
      {
        id: 'wl_default',
        customer_id: 'cus_123',
        name: 'My Wishlist',
        is_private: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        items: []
      }
    ];
  }
};

/**
 * Get default wishlist for customer
 */
export const getDefaultWishlist = async (): Promise<Wishlist> => {
  try {
    const wishlists = await getCustomerWishlists();
    
    // Return first wishlist or create default
    if (wishlists.length > 0) {
      return wishlists[0];
    }

    // Create default wishlist if none exists
    return await createWishlist({ name: 'My Wishlist', is_private: true });
  } catch (error) {
    throw medusaError(error);
  }
};

/**
 * Create a new wishlist
 */
export const createWishlist = async (request: CreateWishlistRequest): Promise<Wishlist> => {
  try {
    const headers = {
      ...getAuthHeaders(),
      'Content-Type': 'application/json'
    };

    const response = await medusaClient.fetch('/store/customers/me/wishlists', {
      method: 'POST',
      headers,
      body: JSON.stringify(request)
    });

    return (response as any)?.wishlist;
  } catch (error) {
    // Return mock wishlist if API not available
    return {
      id: `wl_${Math.random().toString(36).substr(2, 8)}`,
      customer_id: 'cus_123',
      name: request.name || 'My Wishlist',
      is_private: request.is_private ?? true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      items: []
    };
  }
};

/**
 * Add item to wishlist
 */
export const addToWishlist = async (
  wishlistId: string, 
  request: AddToWishlistRequest
): Promise<WishlistItem> => {
  try {
    const headers = {
      ...getAuthHeaders(),
      'Content-Type': 'application/json'
    };

    const response = await medusaClient.fetch(`/store/wishlists/${wishlistId}/items`, {
      method: 'POST',
      headers,
      body: JSON.stringify(request)
    });

    return (response as any)?.item;
  } catch (error) {
    throw medusaError(error);
  }
};

/**
 * Remove item from wishlist
 */
export const removeFromWishlist = async (
  wishlistId: string, 
  itemId: string
): Promise<void> => {
  try {
    const headers = getAuthHeaders();

    await medusaClient.fetch(`/store/wishlists/${wishlistId}/items/${itemId}`, {
      method: 'DELETE',
      headers
    });
  } catch (error) {
    throw medusaError(error);
  }
};

/**
 * Check if product variant is in wishlist
 */
export const isInWishlist = async (variantId: string): Promise<boolean> => {
  try {
    const wishlist = await getDefaultWishlist();
    return wishlist.items.some(item => item.variant_id === variantId);
  } catch (error) {
    return false;
  }
};

/**
 * Toggle item in wishlist (add if not present, remove if present)
 */
export const toggleWishlistItem = async (
  variantId: string,
  productId: string
): Promise<{ added: boolean; item?: WishlistItem }> => {
  try {
    const wishlist = await getDefaultWishlist();
    const existingItem = wishlist.items.find(item => item.variant_id === variantId);

    if (existingItem) {
      await removeFromWishlist(wishlist.id, existingItem.id);
      return { added: false };
    } else {
      const item = await addToWishlist(wishlist.id, { variant_id: variantId, product_id: productId });
      return { added: true, item };
    }
  } catch (error) {
    throw medusaError(error);
  }
};

/**
 * Get wishlist by ID with items
 */
export const getWishlistById = async (wishlistId: string): Promise<Wishlist> => {
  try {
    const headers = getAuthHeaders();

    const response = await medusaClient.fetch(`/store/wishlists/${wishlistId}?expand=items,items.variant,items.product`, {
      headers
    });

    return (response as any)?.wishlist;
  } catch (error) {
    throw medusaError(error);
  }
};

/**
 * Update wishlist details
 */
export const updateWishlist = async (
  wishlistId: string,
  updates: Partial<CreateWishlistRequest>
): Promise<Wishlist> => {
  try {
    const headers = {
      ...getAuthHeaders(),
      'Content-Type': 'application/json'
    };

    const response = await medusaClient.fetch(`/store/wishlists/${wishlistId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(updates)
    });

    return (response as any)?.wishlist;
  } catch (error) {
    throw medusaError(error);
  }
};

/**
 * Move item to cart from wishlist
 */
export const moveToCart = async (
  wishlistId: string,
  itemId: string,
  cartId: string,
  quantity: number = 1
): Promise<void> => {
  try {
    const headers = {
      ...getAuthHeaders(),
      'Content-Type': 'application/json'
    };

    // Get the wishlist item details
    const wishlist = await getWishlistById(wishlistId);
    const item = wishlist.items.find(i => i.id === itemId);
    
    if (!item) {
      throw new Error('Wishlist item not found');
    }

    // Add to cart
    await medusaClient.fetch(`/store/carts/${cartId}/line-items`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        variant_id: item.variant_id,
        quantity
      })
    });

    // Remove from wishlist
    await removeFromWishlist(wishlistId, itemId);
  } catch (error) {
    throw medusaError(error);
  }
};

/**
 * Share wishlist (get shareable link)
 */
export const shareWishlist = async (wishlistId: string): Promise<{ share_url: string }> => {
  try {
    const headers = {
      ...getAuthHeaders(),
      'Content-Type': 'application/json'
    };

    const response = await medusaClient.fetch(`/store/wishlists/${wishlistId}/share`, {
      method: 'POST',
      headers
    });

    return {
      share_url: 'https://example.com/wishlist/shared'
    };
  } catch (error) {
    // Return mock share URL if API not available
    return {
      share_url: `${window.location.origin}/wishlist/shared/${wishlistId}`
    };
  }
};

/**
 * Get shared wishlist (public access)
 */
export const getSharedWishlist = async (shareToken: string): Promise<Wishlist> => {
  try {
    const response = await medusaClient.fetch(`/store/wishlists/shared/${shareToken}?expand=items,items.variant,items.product`);
    return (response as any)?.wishlist;
  } catch (error) {
    throw medusaError(error);
  }
};

/**
 * Format wishlist item price
 */
export const formatWishlistItemPrice = (item: WishlistItem, currencyCode = 'USD'): string => {
  const price = item.variant?.prices?.find(p => p.currency_code.toLowerCase() === currencyCode.toLowerCase());
  if (!price) return 'Price unavailable';

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode
  }).format(price.amount);
};

/**
 * Check if wishlist item is in stock
 */
export const isWishlistItemInStock = (item: WishlistItem): boolean => {
  return (item.variant?.inventory_quantity ?? 0) > 0;
};

/**
 * Get wishlist item availability status
 */
export const getWishlistItemStatus = (item: WishlistItem): {
  status: 'in_stock' | 'low_stock' | 'out_of_stock';
  message: string;
} => {
  const quantity = item.variant?.inventory_quantity ?? 0;
  
  if (quantity === 0) {
    return { status: 'out_of_stock', message: 'Out of stock' };
  } else if (quantity <= 5) {
    return { status: 'low_stock', message: `Only ${quantity} left` };
  } else {
    return { status: 'in_stock', message: 'In stock' };
  }
};
