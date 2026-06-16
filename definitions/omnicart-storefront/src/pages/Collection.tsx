import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { getProducts, MedusaProduct } from '@/services/medusa/products';
import { getCollectionByHandle } from '@/services/medusa/collections';
import ProductCard from '@/components/ProductCard';
import ProductSort, { SortOption } from '@/components/ProductSort';
import ProductFilter, { FilterOptions } from '@/components/ProductFilter';
import { sortProducts } from '@/lib/utils/productSort';
import { filterProducts, extractUniqueCategories, extractUniqueCollections, getMaxPrice } from '@/lib/utils/productFilter';
import { transformCdnUrl } from '@/lib/util/image-url';

// Product interface for UI compatibility
interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  image: string;
  category: string;
  slug: string;
  rating?: number;
  inventory_quantity?: number;
  manage_inventory?: boolean;
  allow_backorder?: boolean;
  defaultVariantId?: string | null;
}

// Transform Medusa product to UI product format
const transformMedusaProduct = (medusaProduct: MedusaProduct): Product => {
  const variants = medusaProduct.variants || [];
  const cheapestVariant = variants.reduce((best, variant) => {
    const variantPrice = variant.calculated_price?.calculated_amount ?? variant.prices?.[0]?.amount ?? Number.POSITIVE_INFINITY;
    const bestPrice = best?.calculated_price?.calculated_amount ?? best?.prices?.[0]?.amount ?? Number.POSITIVE_INFINITY;
    return variantPrice < bestPrice ? variant : best;
  }, variants[0]);

  const priceAmount = cheapestVariant?.calculated_price?.calculated_amount ?? cheapestVariant?.prices?.[0]?.amount ?? 0;
  const rawImage = medusaProduct.thumbnail || medusaProduct.images?.[0]?.url || '';
  const image = transformCdnUrl(rawImage);
  const firstVariant = cheapestVariant || medusaProduct.variants?.[0];

  return {
    id: medusaProduct.id,
    name: medusaProduct.title,
    description: medusaProduct.description || '',
    price: priceAmount || 0, // API sends prices in dollars, no conversion needed
    image,
    category: medusaProduct.collection?.handle || '',
    slug: medusaProduct.handle,
    rating: 4.5, // Default rating
    inventory_quantity: firstVariant?.inventory_quantity || 0,
    manage_inventory: firstVariant?.manage_inventory || false,
    allow_backorder: firstVariant?.allow_backorder || false,
    defaultVariantId: firstVariant?.id || null,
  };
};

const Collection = () => {
  const { category } = useParams<{ category: string }>();

  const normalizedCategory = React.useMemo(() => {
    if (!category) return undefined;
    if (category.toLowerCase() === 'products') return 'all';
    return category;
  }, [category]);
  const [title, setTitle] = useState('All Products');
  const [description, setDescription] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('featured');
  const [filters, setFilters] = useState<FilterOptions>({
    categories: [],
    collections: [],
    priceRange: [0, 1000],
    inStock: false,
  });



  // Fetch collection and products
  const { data: collectionData, isLoading, error } = useQuery({
    queryKey: ['collection', normalizedCategory],
    queryFn: async () => {
      if (!normalizedCategory || normalizedCategory === 'all') {
        const result = await getProducts();
        return {
          products: result.products.map(transformMedusaProduct),
          collection: null
        };
      }

      // Try to get products by collection handle
      const collection = await getCollectionByHandle(normalizedCategory || '');
      if (collection?.products) {
        return {
          products: collection.products.map((product: any) => transformMedusaProduct(product as MedusaProduct)),
          collection
        };
      }

      // Fallback to search by category
      const result = await getProducts({ q: normalizedCategory });
      return {
        products: result.products.map(transformMedusaProduct),
        collection: null
      };
    }
  });

  const products = collectionData?.products;
  const collection = collectionData?.collection;

  // Extract filter options from products
  const availableCategories = products ? extractUniqueCategories(products) : [];
  const availableCollections = products ? extractUniqueCollections(products) : [];
  const maxPrice = products ? getMaxPrice(products) : 1000;

  // Update price range when products change
  React.useEffect(() => {
    if (products && products.length > 0) {
      const newMaxPrice = getMaxPrice(products);
      setFilters(prev => ({
        ...prev,
        priceRange: [0, newMaxPrice]
      }));
    }
  }, [products]);

  // Filter and sort products
  const filteredProducts = products ? filterProducts(products, filters) : [];
  const sortedProducts = sortProducts(filteredProducts, sortBy);

  useEffect(() => {
    if (!normalizedCategory || normalizedCategory === 'all') {
      setTitle('All Products');
      setDescription('Browse our complete collection of premium holsters');
    } else if (collection) {
      setTitle(collection.title);
      setDescription(''); // Collections don't have descriptions in the current schema
    } else if (category) {
      // Format the category name for display
      const formattedCategory = category
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      setTitle(formattedCategory);
      setDescription('');
    }
  }, [category, collection]);

  // Use real products from Medusa
  const displayProducts = products || [];

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <main className="flex-grow container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">{title}</h1>
            {description && (
              <p className="text-gray-600 text-lg">{description}</p>
            )}
          </div>
          
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[...Array(8)].map((_, index) => (
                <div key={index} className="bg-gray-100 rounded-lg h-80 animate-pulse"></div>
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-500">Error loading products. Please try again later.</p>
            </div>
          ) : sortedProducts.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">No products found in this collection.</p>
            </div>
          ) : (
            <div className="flex gap-8">
              {/* Filter Sidebar */}
              <div className="hidden lg:block w-64 flex-shrink-0">
                <div className="sticky top-4">
                  <ProductFilter
                    filters={filters}
                    onFiltersChange={setFilters}
                    availableCategories={availableCategories}
                    availableCollections={availableCollections}
                    maxPrice={maxPrice}
                  />
                </div>
              </div>

              {/* Main Content */}
              <div className="flex-1">
                {/* Product Count and Sort Controls */}
                <div className="flex justify-between items-center mb-6">
                  <p className="text-gray-600">
                    {sortedProducts.length} product{sortedProducts.length !== 1 ? 's' : ''}
                    {filteredProducts.length !== products?.length && (
                      <span className="text-sm text-gray-500 ml-2">
                        (filtered from {products?.length})
                      </span>
                    )}
                  </p>
                  <ProductSort value={sortBy} onValueChange={setSortBy} />
                </div>

                {/* Product Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {sortedProducts.map(product => (
                    <ProductCard key={product.id} product={product as any} />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default Collection;
