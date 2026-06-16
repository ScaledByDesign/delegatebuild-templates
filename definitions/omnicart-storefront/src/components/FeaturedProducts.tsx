
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Star, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { getProducts, MedusaProduct } from '@/services/medusa/products';
import { useCart } from '@/hooks/useCart';

// Product interface
interface Product {
  id: string;
  name: string;
  price: number;
  rating: number;
  image: string;
  category: string;
  slug: string;
  defaultVariantId?: string | null;
}

// Product card component with scroll to top functionality
const ProductCard = ({ product }: { product: Product }) => {
  const navigate = useNavigate();
  const { addItem } = useCart();
  const [isAdding, setIsAdding] = useState(false);
  
  const handleProductClick = (e: React.MouseEvent<HTMLAnchorElement>, slug: string) => {
    e.preventDefault();
    // Navigate programmatically
    navigate(`/products/${slug}`);
    // Scroll to top of the page
    window.scrollTo(0, 0);
  };

  const handleAddToCart = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault(); // Prevent navigation when clicking the button
    e.stopPropagation(); // Stop event bubbling
    if (!product.defaultVariantId) {
      return; // No purchasable variant available
    }
    try {
      setIsAdding(true);
      await addItem(product.defaultVariantId);
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="bg-white rounded-lg overflow-hidden shadow card-hover">
      <Link 
        to={`/products/${product.slug}`}
        onClick={(e) => handleProductClick(e, product.slug)}
      >
        <div className="relative h-64 overflow-hidden bg-gray-100">
          <img 
            src={product.image} 
            alt={product.name} 
            className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
          />
        </div>
      </Link>
      <div className="p-4">
        <Link 
          to={`/products/${product.slug}`}
          onClick={(e) => handleProductClick(e, product.slug)}
        >
          <h3 className="font-medium text-lg mb-1 hover:text-vnsh-red transition-colors">{product.name}</h3>
        </Link>
        <div className="flex items-center mb-2">
          <div className="flex text-yellow-400">
            {[...Array(5)].map((_, i) => (
              <Star 
                key={i} 
                size={16} 
                fill={i < product.rating ? "currentColor" : "none"} 
                className={i < product.rating ? "" : "text-gray-300"}
              />
            ))}
          </div>
          <span className="text-sm text-gray-500 ml-2">{product.rating.toFixed(1)}</span>
        </div>
        <div className="flex justify-between items-center mt-3">
          <span className="font-bold text-lg">${product.price.toFixed(2)}</span>
          <Button
            size="sm"
            className="bg-vnsh-dark hover:bg-vnsh-gray text-white add-to-cart-button"
            onClick={handleAddToCart}
            disabled={isAdding || !product.defaultVariantId}
          >
            <ShoppingCart size={16} className="mr-1" />
            {isAdding ? "Adding..." : "Add"}
          </Button>
        </div>
      </div>
    </div>
  );
};

// Transform Medusa product to local Product interface
const transformMedusaProduct = (medusaProduct: MedusaProduct): Product => {
  const variants = medusaProduct.variants || [];
  const cheapestVariant = variants.reduce((cheapest, variant) => {
    const variantPrice = variant.calculated_price?.calculated_amount ?? variant.prices?.[0]?.amount ?? Number.POSITIVE_INFINITY;
    const cheapestPrice = cheapest?.calculated_price?.calculated_amount ?? cheapest?.prices?.[0]?.amount ?? Number.POSITIVE_INFINITY;
    return variantPrice < cheapestPrice ? variant : cheapest;
  }, variants[0]);

  // Medusa v2 stores prices in major units (dollars, not cents)
  const priceAmount = cheapestVariant?.calculated_price?.calculated_amount ?? cheapestVariant?.prices?.[0]?.amount ?? 0;
  return {
    id: medusaProduct.id,
    name: medusaProduct.title,
    price: priceAmount || 0,
    rating: 4.8, // Default rating - could be stored in metadata
    image: medusaProduct.images?.[0]?.url || medusaProduct.thumbnail || "/placeholder.svg",
    category: medusaProduct.collection?.handle || "holsters",
    slug: medusaProduct.handle,
    defaultVariantId: cheapestVariant?.id || null,
  };
};

// Featured products component
const FeaturedProducts = () => {
  // Fetch featured products from Medusa
  const { data: medusaResponse, isLoading, error } = useQuery({
    queryKey: ['featured-products'],
    queryFn: () => getProducts({ limit: 4 }),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Transform Medusa products to local format
  const products: Product[] = medusaResponse?.products?.map(transformMedusaProduct) || [];

  if (isLoading) {
    return (
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-3xl font-bold">Best Sellers</h2>
            <Link to="/collections/all" className="text-vnsh-red hover:underline font-medium">
              View All
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white rounded-lg overflow-hidden shadow">
                <div className="h-64 bg-gray-200 animate-pulse"></div>
                <div className="p-4 space-y-2">
                  <div className="h-4 bg-gray-200 animate-pulse rounded"></div>
                  <div className="h-4 bg-gray-200 animate-pulse rounded w-3/4"></div>
                  <div className="h-4 bg-gray-200 animate-pulse rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (error || products.length === 0) {
    return (
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-3xl font-bold">Best Sellers</h2>
            <Link to="/collections/all" className="text-vnsh-red hover:underline font-medium">
              View All
            </Link>
          </div>
          <div className="text-center py-8">
            <p className="text-gray-500">No featured products available at the moment.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-16">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-3xl font-bold">Best Sellers</h2>
          <Link to="/collections/all" className="text-vnsh-red hover:underline font-medium">
            View All
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {products.map(product => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturedProducts;
