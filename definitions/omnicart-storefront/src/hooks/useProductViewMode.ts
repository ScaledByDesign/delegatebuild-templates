import { useState, useEffect } from 'react';

export type ProductViewMode = 'grid' | 'compact';

const STORAGE_KEY = 'vnsh-product-view-mode';
const DEFAULT_VIEW_MODE: ProductViewMode = 'grid';

/**
 * Custom hook for managing product view mode (grid vs compact)
 * Persists the selected view mode to localStorage
 */
export function useProductViewMode() {
  const [viewMode, setViewMode] = useState<ProductViewMode>(() => {
    // Initialize from localStorage if available
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'grid' || stored === 'compact') {
        return stored;
      }
    }
    return DEFAULT_VIEW_MODE;
  });

  // Persist to localStorage whenever viewMode changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, viewMode);
    }
  }, [viewMode]);

  const toggleViewMode = () => {
    setViewMode(prev => prev === 'grid' ? 'compact' : 'grid');
  };

  return {
    viewMode,
    setViewMode,
    toggleViewMode,
    isGridView: viewMode === 'grid',
    isCompactView: viewMode === 'compact',
  };
}

