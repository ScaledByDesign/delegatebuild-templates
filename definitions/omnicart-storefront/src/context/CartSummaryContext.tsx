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

// Default to a safe no-op implementation so consumers (e.g. CartProvider) never
// crash when a CartSummaryProvider ancestor is missing — for example if a
// generated app reorders the providers. Without the provider the popover simply
// never opens, instead of white-screening the whole app.
const CartSummaryContext = createContext<CartSummaryContextType>({
  isOpen: false,
  data: null,
  openSummary: () => {},
  closeSummary: () => {},
});

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

export const useCartSummary = () => useContext(CartSummaryContext);
