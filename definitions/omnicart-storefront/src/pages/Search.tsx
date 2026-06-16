import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search as SearchIcon, AlertCircle } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import ProductCard from '@/components/ProductCard';
import ProductSort, { SortOption } from '@/components/ProductSort';
import ProductFilter, { FilterOptions } from '@/components/ProductFilter';
import { sortProducts } from '@/lib/utils/productSort';
import {
  extractUniqueCategories,
  extractUniqueCollections,
  filterProducts,
  getMaxPrice,
} from '@/lib/utils/productFilter';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { getProducts, MedusaProduct, MedusaProductVariant } from '@/services/medusa/products';

interface SearchProduct {
  id: string;
  name: string;
  price: number;
  image: string;
  description: string;
  slug: string;
  defaultVariantId: string | null;
  category: string;
  inventory_quantity?: number;
  manage_inventory?: boolean;
  allow_backorder?: boolean;
  rating?: number;
  inStock?: boolean;
  collection?: string;
}

const isVariantAvailable = (variant?: MedusaProductVariant) => {
  if (!variant) return false;
  if (!variant.manage_inventory) return true;
  // Check actual inventory quantity - if undefined/null when managing inventory, treat as out of stock
  if (variant.inventory_quantity === undefined || variant.inventory_quantity === null) {
    return false;
  }
  // Only in stock if there's actual quantity
  return variant.inventory_quantity > 0;
};

const selectDisplayVariant = (variants: MedusaProductVariant[] = []) => {
  const availableVariant = variants.find(isVariantAvailable);
  return availableVariant ?? variants[0];
};

const Search = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [debouncedQuery, setDebouncedQuery] = useState(searchParams.get('q') || '');
  const [sortBy, setSortBy] = useState<SortOption>('featured');
  const [error, setError] = useState<string | null>(null);
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>({
    categories: [],
    collections: [],
    inStock: false,
  });

  // Debounce search query (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch all products from Medusa for search
  const { data: medusaResponse, isLoading, error: fetchError } = useQuery({
    queryKey: ['search-products'],
    queryFn: () => getProducts({ limit: 100 }), // Get more products for search
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Set error if fetch fails
  useEffect(() => {
    if (fetchError) {
      setError('Failed to load products. Please try again later.');
      console.error('Product fetch error:', fetchError);
    }
  }, [fetchError]);

  const transformProduct = useCallback((product: MedusaProduct): SearchProduct => {
    const displayVariant = selectDisplayVariant(product.variants);
    const priceAmount = displayVariant?.calculated_price?.calculated_amount
      ?? displayVariant?.prices?.[0]?.amount
      ?? 0;

    const manageInventory = displayVariant?.manage_inventory ?? false;
    const allowBackorder = displayVariant?.allow_backorder ?? false;
    const inventoryQuantity = manageInventory ? displayVariant?.inventory_quantity : undefined;
    const inStock = displayVariant
      ? (
        !manageInventory ||
        allowBackorder ||
        inventoryQuantity === undefined ||
        inventoryQuantity === null ||
        inventoryQuantity > 0
      )
      : false;

    return {
      id: product.id,
      name: product.title,
      price: priceAmount,
      image: product.images?.[0]?.url || product.thumbnail || "/placeholder.svg",
      description: product.description || "",
      slug: product.handle,
      defaultVariantId: displayVariant?.id || product.variants?.[0]?.id || null,
      category: product.collection?.handle || "products",
      collection: product.collection?.title,
      inventory_quantity: inStock ? (inventoryQuantity ?? 10) : 0,
      manage_inventory: manageInventory,
      allow_backorder: allowBackorder,
      rating: 4.5,
      inStock,
    };
  }, []);

  const allProducts: SearchProduct[] = useMemo(() => {
    if (!medusaResponse?.products) return [];
    return medusaResponse.products.map(transformProduct);
  }, [medusaResponse?.products, transformProduct]);

  const searchableProducts = useMemo(() => {
    const query = debouncedQuery.trim().toLowerCase();
    if (!query) return allProducts;

    return allProducts.filter(product => {
      const nameMatch = product.name.toLowerCase().includes(query);
      const descMatch = (product.description || '').toLowerCase().includes(query);
      const categoryMatch = (product.category || '').toLowerCase().includes(query);
      const collectionMatch = (product.collection || '').toLowerCase().includes(query);
      return nameMatch || descMatch || categoryMatch || collectionMatch;
    });
  }, [allProducts, debouncedQuery]);

  const filteredProducts = filterProducts(searchableProducts as any, filters);
  const sortedProducts = sortProducts(filteredProducts, sortBy);

  // Handle URL parameter changes
  useEffect(() => {
    const query = searchParams.get('q');
    if (query) {
      setSearchQuery(query);
    }
  }, [searchParams]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedQuery = searchQuery.trim();
    if (trimmedQuery) {
      setSearchParams({ q: trimmedQuery });
      setDebouncedQuery(trimmedQuery);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setSearchQuery(suggestion);
    setSearchParams({ q: suggestion });
    setDebouncedQuery(suggestion);
  };

  const availableCategories = extractUniqueCategories(searchableProducts as any);
  const availableCollections = extractUniqueCollections(searchableProducts as any);
  const resultLabel = debouncedQuery.trim()
    ? `Found ${sortedProducts.length} result${sortedProducts.length === 1 ? '' : 's'} for “${debouncedQuery.trim()}”`
    : `Showing ${sortedProducts.length} product${sortedProducts.length === 1 ? '' : 's'}`;
  const suggestions = ['holster', 'glock', 'iwb', 'owb', 'tactical', 'belt', 'laser', 'mag pouch'];

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar />
      
      <main className="flex-grow">
        <div className="max-w-7xl mx-auto px-4 py-10">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.3em] text-gray-500">Search</p>
              <h1 className="text-3xl font-bold text-[#121212]">Find your next carry</h1>
              <p className="text-gray-600 text-sm md:text-base">
                {debouncedQuery.trim()
                  ? `${resultLabel} • Adjust filters to refine.`
                  : 'Browse our catalog or start typing to narrow the results.'}
              </p>
            </div>
            <form onSubmit={handleSearch} className="w-full md:w-[420px]">
              <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search holsters, accessories, gear..."
                  value={searchQuery}
                  onChange={handleInputChange}
                  className="w-full h-12 pl-10 pr-12 text-sm md:text-base border-gray-300"
                />
                <Button
                  type="submit"
                  size="sm"
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-3"
                  variant="secondary"
                >
                  Go
                </Button>
              </div>
            </form>
          </div>

          {error && (
            <div className="max-w-6xl mx-auto mb-6">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-red-900">Error</h3>
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-8">
            <aside className="hidden lg:block w-64 flex-shrink-0">
              <div className="sticky top-24">
                <ProductFilter
                  filters={filters}
                  onFiltersChange={setFilters}
                  availableCategories={availableCategories}
                  availableCollections={availableCollections}
                />
              </div>
            </aside>

            <section className="flex-1">
              <div className="lg:hidden mb-4">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-between"
                  onClick={() => setIsMobileFiltersOpen((open) => !open)}
                >
                  Filters
                  <span className="text-xs text-gray-500">
                    {isMobileFiltersOpen ? 'Hide' : 'Show'}
                  </span>
                </Button>
                {isMobileFiltersOpen && (
                  <div className="mt-3 rounded-lg border border-gray-200 bg-white p-4">
                    <ProductFilter
                      filters={filters}
                      onFiltersChange={setFilters}
                      availableCategories={availableCategories}
                      availableCollections={availableCollections}
                    />
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
                <p className="text-gray-700 text-sm md:text-base">{resultLabel}</p>
                <ProductSort value={sortBy} onValueChange={setSortBy} />
              </div>

              {isLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[...Array(6)].map((_, index) => (
                    <div key={index} className="bg-gray-100 rounded-lg h-80 animate-pulse" />
                  ))}
                </div>
              ) : sortedProducts.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {sortedProducts.map((product) => (
                    <ProductCard key={product.id} product={product as any} />
                  ))}
                </div>
              ) : (
                <div className="border border-dashed border-gray-200 rounded-lg p-10 text-center">
                  <h3 className="text-xl font-semibold mb-2">No results found</h3>
                  <p className="text-gray-600 mb-4">
                    {debouncedQuery.trim()
                      ? `We couldn't find products matching “${debouncedQuery.trim()}”. Try another term or adjust filters.`
                      : 'Try searching for a product name, category, or collection.'}
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {suggestions.map((suggestion) => (
                      <Button
                        key={suggestion}
                        variant="outline"
                        size="sm"
                        onClick={() => handleSuggestionClick(suggestion)}
                        className="text-xs"
                      >
                        {suggestion}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Search;
