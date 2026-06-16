import { SortOption } from '@/components/ProductSort';

export interface SortableProduct {
  id: string;
  name: string;
  price: number;
  image?: string;
  category?: string;
  slug?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: any;
}

export const sortProducts = (products: SortableProduct[], sortBy: SortOption): SortableProduct[] => {
  const sortedProducts = [...products];

  switch (sortBy) {
    case 'price_asc':
      return sortedProducts.sort((a, b) => a.price - b.price);
    
    case 'price_desc':
      return sortedProducts.sort((a, b) => b.price - a.price);
    
    case 'name_asc':
      return sortedProducts.sort((a, b) => a.name.localeCompare(b.name));
    
    case 'name_desc':
      return sortedProducts.sort((a, b) => b.name.localeCompare(a.name));
    
    case 'created_at_desc':
      return sortedProducts.sort((a, b) => {
        const dateA = new Date(a.created_at || 0).getTime();
        const dateB = new Date(b.created_at || 0).getTime();
        return dateB - dateA;
      });
    
    case 'created_at_asc':
      return sortedProducts.sort((a, b) => {
        const dateA = new Date(a.created_at || 0).getTime();
        const dateB = new Date(b.created_at || 0).getTime();
        return dateA - dateB;
      });
    
    case 'featured':
    default:
      // For featured, we could implement a custom sorting logic
      // For now, return products as-is (assuming they come pre-sorted by relevance)
      return sortedProducts;
  }
};

export const getSortDisplayName = (sortBy: SortOption): string => {
  const sortOptions = {
    'featured': 'Featured',
    'price_asc': 'Price: Low to High',
    'price_desc': 'Price: High to Low',
    'name_asc': 'Name: A to Z',
    'name_desc': 'Name: Z to A',
    'created_at_desc': 'Newest First',
    'created_at_asc': 'Oldest First',
  };

  return sortOptions[sortBy] || 'Featured';
};
