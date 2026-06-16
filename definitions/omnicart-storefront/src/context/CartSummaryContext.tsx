/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useCallback } from 'react';

export interface CartSummaryItem {
  id: string;
  title: string;
  thumbnail?: string;
  variant?: string;
  quantity: number;
  price: number;
  total: number;
}

export interface CartSummaryData {
  item: CartSummaryItem;
  cartTotal: number;
  cartItemCount: number;
}

interface CartSummaryContextType {
  isOpen: boolean;
  data: CartSummaryData | null;
  openSummary: (data: CartSummaryData) => void;
  closeSummary: () => void;
}

const CartSummaryContext = createContext<CartSummaryContextType | undefined>(undefined);

export const CartSummaryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [data, setData] = useState<CartSummaryData | null>(null);

  const openSummary = useCallback((summaryData: CartSummaryData) => {
    setData(summaryData);
    setIsOpen(true);

    // Auto-close after 4 seconds
    const timer = setTimeout(() => {
      setIsOpen(false);
    }, 4000);

    return () => clearTimeout(timer);
  }, []);

  const closeSummary = useCallback(() => {
    setIsOpen(false);
  }, []);

  const value = {
    isOpen,
    data,
    openSummary,
    closeSummary,
  };

  return (
    <CartSummaryContext.Provider value={value}>
      {children}
    </CartSummaryContext.Provider>
  );
};

export const useCartSummary = () => {
  const context = useContext(CartSummaryContext);
  if (context === undefined) {
    throw new Error('useCartSummary must be used within CartSummaryProvider');
  }
  return context;
};
