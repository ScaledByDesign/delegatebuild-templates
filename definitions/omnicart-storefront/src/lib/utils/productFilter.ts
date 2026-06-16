import { FilterOptions } from '@/components/ProductFilter';

export interface FilterableProduct {
  id: string;
  name: string;
  price: number;
  category: string;
  collection?: string;
  inStock?: boolean;
  [key: string]: any;
}

export const filterProducts = (products: FilterableProduct[], filters: FilterOptions): FilterableProduct[] => {
  return products.filter(product => {
    // Category filter
    if (filters.categories.length > 0 && !filters.categories.includes(product.category)) {
      return false;
    }

    // Collection filter
    if (filters.collections.length > 0 && product.collection && !filters.collections.includes(product.collection)) {
      return false;
    }

    // Price range filter (optional)
    if (filters.priceRange) {
      const [min, max] = filters.priceRange;
      if (product.price < min || product.price > max) {
        return false;
      }
    }

    // Stock filter
    if (filters.inStock && !product.inStock) {
      return false;
    }

    return true;
  });
};

export const extractUniqueCategories = (products: FilterableProduct[]): string[] => {
  const categories = products.map(product => product.category).filter(Boolean);
  return [...new Set(categories)].sort();
};

export const extractUniqueCollections = (products: FilterableProduct[]): string[] => {
  const collections = products.map(product => product.collection).filter(Boolean);
  return [...new Set(collections)].sort();
};

export const getMaxPrice = (products: FilterableProduct[]): number => {
  if (products.length === 0) return 1000;
  return Math.max(...products.map(product => product.price));
};

export const getMinPrice = (products: FilterableProduct[]): number => {
  if (products.length === 0) return 0;
  return Math.min(...products.map(product => product.price));
};
