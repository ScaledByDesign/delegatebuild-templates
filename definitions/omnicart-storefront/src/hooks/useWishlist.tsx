/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useCustomer } from '@/hooks/useCustomer';
import {
  getDefaultWishlist,
  addToWishlist,
  removeFromWishlist,
  toggleWishlistItem,
  isInWishlist,
  moveToCart,
  type Wishlist,
  type WishlistItem,
  type AddToWishlistRequest
} from '@/services/medusa/wishlist';

interface WishlistContextType {
  wishlist: Wishlist | null;
  isLoading: boolean;
  error: Error | null;
  addItem: (variantId: string, productId: string) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  toggleItem: (variantId: string, productId: string) => Promise<void>;
  moveItemToCart: (itemId: string, cartId: string, quantity?: number) => Promise<void>;
  isItemInWishlist: (variantId: string) => boolean;
  getItemCount: () => number;
  refetch: () => void;
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

export const useWishlist = () => {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error('useWishlist must be used within a WishlistProvider');
  }
  return context;
};

interface WishlistProviderProps {
  children: React.ReactNode;
}

export const WishlistProvider: React.FC<WishlistProviderProps> = ({ children }) => {
  const { customer } = useCustomer();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Query for wishlist data
  const {
    data: wishlist,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['wishlist', customer?.id],
    queryFn: getDefaultWishlist,
    enabled: !!customer,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
  });

  // Mutation for adding items
  const addItemMutation = useMutation({
    mutationFn: async ({ variantId, productId }: { variantId: string; productId: string }) => {
      if (!wishlist) throw new Error('No wishlist available');
      return addToWishlist(wishlist.id, { variant_id: variantId, product_id: productId });
    },
    onSuccess: () => {
      toast({
        title: "Added to wishlist",
        description: "Item has been added to your wishlist.",
      });
      queryClient.invalidateQueries({ queryKey: ['wishlist'] });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Failed to add to wishlist",
        description: error.message,
      });
    },
  });

  // Mutation for removing items
  const removeItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      if (!wishlist) throw new Error('No wishlist available');
      return removeFromWishlist(wishlist.id, itemId);
    },
    onSuccess: () => {
      toast({
        title: "Removed from wishlist",
        description: "Item has been removed from your wishlist.",
      });
      queryClient.invalidateQueries({ queryKey: ['wishlist'] });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Failed to remove from wishlist",
        description: error.message,
      });
    },
  });

  // Mutation for toggling items
  const toggleItemMutation = useMutation({
    mutationFn: ({ variantId, productId }: { variantId: string; productId: string }) =>
      toggleWishlistItem(variantId, productId),
    onSuccess: (result) => {
      toast({
        title: result.added ? "Added to wishlist" : "Removed from wishlist",
        description: result.added 
          ? "Item has been added to your wishlist."
          : "Item has been removed from your wishlist.",
      });
      queryClient.invalidateQueries({ queryKey: ['wishlist'] });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  // Mutation for moving to cart
  const moveToCartMutation = useMutation({
    mutationFn: ({ itemId, cartId, quantity }: { itemId: string; cartId: string; quantity?: number }) => {
      if (!wishlist) throw new Error('No wishlist available');
      return moveToCart(wishlist.id, itemId, cartId, quantity);
    },
    onSuccess: () => {
      toast({
        title: "Moved to cart",
        description: "Item has been moved from wishlist to cart.",
      });
      queryClient.invalidateQueries({ queryKey: ['wishlist'] });
      queryClient.invalidateQueries({ queryKey: ['cart'] });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Failed to move to cart",
        description: error.message,
      });
    },
  });

  // Helper functions
  const addItem = async (variantId: string, productId: string) => {
    if (!customer) {
      toast({
        variant: "destructive",
        title: "Login required",
        description: "Please log in to add items to your wishlist.",
      });
      return;
    }
    await addItemMutation.mutateAsync({ variantId, productId });
  };

  const removeItem = async (itemId: string) => {
    await removeItemMutation.mutateAsync(itemId);
  };

  const toggleItem = async (variantId: string, productId: string) => {
    if (!customer) {
      toast({
        variant: "destructive",
        title: "Login required",
        description: "Please log in to manage your wishlist.",
      });
      return;
    }
    await toggleItemMutation.mutateAsync({ variantId, productId });
  };

  const moveItemToCart = async (itemId: string, cartId: string, quantity = 1) => {
    await moveToCartMutation.mutateAsync({ itemId, cartId, quantity });
  };

  const isItemInWishlist = (variantId: string): boolean => {
    if (!wishlist) return false;
    return wishlist.items.some(item => item.variant_id === variantId);
  };

  const getItemCount = (): number => {
    return wishlist?.items.length || 0;
  };

  const value: WishlistContextType = {
    wishlist,
    isLoading,
    error,
    addItem,
    removeItem,
    toggleItem,
    moveItemToCart,
    isItemInWishlist,
    getItemCount,
    refetch,
  };

  return (
    <WishlistContext.Provider value={value}>
      {children}
    </WishlistContext.Provider>
  );
};

// Hook for checking if a specific item is in wishlist (optimized for product cards)
export const useWishlistItem = (variantId: string) => {
  const { isItemInWishlist, toggleItem, isLoading } = useWishlist();
  
  return {
    isInWishlist: isItemInWishlist(variantId),
    toggle: (productId: string) => toggleItem(variantId, productId),
    isLoading
  };
};

// Hook for wishlist count (for navigation badge)
export const useWishlistCount = () => {
  const { getItemCount, isLoading } = useWishlist();
  
  return {
    count: getItemCount(),
    isLoading
  };
};
