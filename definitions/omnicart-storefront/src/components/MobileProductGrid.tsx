import React, { useState, useRef, useEffect } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { TouchTarget, Swipeable } from '@/components/MobileOptimizations';
import { Heart, ShoppingCart, Eye, Share2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useRegion } from '@/hooks/useRegion';
import InventoryStatus, { getInventoryLevel } from '@/components/InventoryStatus';

interface Product {
  id: string;
  title: string;
  price: number;
  images: Array<{ url: string; alt?: string }>;
  variants?: Array<{
    id: string;
    inventory_quantity?: number;
    manage_inventory?: boolean;
    allow_backorder?: boolean;
  }>;
  handle: string;
}

interface MobileProductGridProps {
  products: Product[];
  onAddToCart?: (productId: string) => void;
  onToggleWishlist?: (productId: string) => void;
  onQuickView?: (productId: string) => void;
  onShare?: (productId: string) => void;
  wishlistItems?: string[];
  className?: string;
}

const MobileProductCard: React.FC<{
  product: Product;
  onAddToCart?: (productId: string) => void;
  onToggleWishlist?: (productId: string) => void;
  onQuickView?: (productId: string) => void;
  onShare?: (productId: string) => void;
  isWishlisted?: boolean;
}> = ({
  product,
  onAddToCart,
  onToggleWishlist,
  onQuickView,
  onShare,
  isWishlisted = false
}) => {
  const { formatPrice } = useRegion();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showActions, setShowActions] = useState(false);
  const isMobile = useIsMobile();

  const images = product.images || [];
  const primaryVariant = product.variants?.[0];

  const handleSwipeLeft = () => {
    if (currentImageIndex < images.length - 1) {
      setCurrentImageIndex(currentImageIndex + 1);
    }
  };

  const handleSwipeRight = () => {
    if (currentImageIndex > 0) {
      setCurrentImageIndex(currentImageIndex - 1);
    }
  };

  const handleLongPress = () => {
    if (isMobile) {
      setShowActions(true);
      // Haptic feedback if available
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    }
  };

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (showActions) {
      timer = setTimeout(() => setShowActions(false), 3000);
    }
    return () => clearTimeout(timer);
  }, [showActions]);

  return (
    <div className="relative bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      {/* Image Section */}
      <div className="relative aspect-square overflow-hidden">
        <Swipeable
          onSwipeLeft={handleSwipeLeft}
          onSwipeRight={handleSwipeRight}
          className="h-full"
        >
          <Link to={`/products/${product.handle}`}>
            <img
              src={images[currentImageIndex]?.url || '/placeholder-product.jpg'}
              alt={images[currentImageIndex]?.alt || product.title}
              className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
              onTouchStart={() => {
                const timer = setTimeout(handleLongPress, 500);
                const cleanup = () => clearTimeout(timer);
                document.addEventListener('touchend', cleanup, { once: true });
                document.addEventListener('touchmove', cleanup, { once: true });
              }}
            />
          </Link>
        </Swipeable>

        {/* Image indicators */}
        {images.length > 1 && (
          <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex space-x-1">
            {images.map((_, index) => (
              <div
                key={index}
                className={`w-2 h-2 rounded-full transition-colors ${
                  index === currentImageIndex ? 'bg-white' : 'bg-white/50'
                }`}
              />
            ))}
          </div>
        )}

        {/* Quick actions overlay */}
        {showActions && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <div className="flex space-x-4">
              {onToggleWishlist && (
                <TouchTarget
                  onClick={() => onToggleWishlist(product.id)}
                  className="bg-white/90 rounded-full p-2"
                >
                  <Heart
                    size={20}
                    className={isWishlisted ? 'text-red-500 fill-current' : 'text-gray-700'}
                  />
                </TouchTarget>
              )}
              {onQuickView && (
                <TouchTarget
                  onClick={() => onQuickView(product.id)}
                  className="bg-white/90 rounded-full p-2"
                >
                  <Eye size={20} className="text-gray-700" />
                </TouchTarget>
              )}
              {onShare && (
                <TouchTarget
                  onClick={() => onShare(product.id)}
                  className="bg-white/90 rounded-full p-2"
                >
                  <Share2 size={20} className="text-gray-700" />
                </TouchTarget>
              )}
            </div>
          </div>
        )}

        {/* Wishlist heart (always visible) */}
        {onToggleWishlist && !showActions && (
          <TouchTarget
            onClick={() => onToggleWishlist(product.id)}
            className="absolute top-2 right-2 bg-white/80 rounded-full p-1"
          >
            <Heart
              size={16}
              className={isWishlisted ? 'text-red-500 fill-current' : 'text-gray-600'}
            />
          </TouchTarget>
        )}
      </div>

      {/* Product Info */}
      <div className="p-3 space-y-2">
        <Link to={`/products/${product.handle}`}>
          <h3 className="font-medium text-sm text-gray-900 line-clamp-2 leading-tight">
            {product.title}
          </h3>
        </Link>

        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-lg font-bold text-vnsh-red">
              {formatPrice(product.price * 100)}
            </p>
            
            {/* Inventory Status */}
            {primaryVariant && (
              <InventoryStatus
                level={getInventoryLevel(
                  primaryVariant.inventory_quantity || 0,
                  5,
                  primaryVariant.allow_backorder || false
                )}
                quantity={primaryVariant.inventory_quantity}
                showQuantity={false}
                size="sm"
              />
            )}
          </div>

          {/* Add to Cart Button */}
          {onAddToCart && (
            <TouchTarget
              onClick={() => onAddToCart(product.id)}
              className="bg-vnsh-red text-white rounded-full p-2 shadow-md active:bg-red-700"
            >
              <ShoppingCart size={16} />
            </TouchTarget>
          )}
        </div>
      </div>
    </div>
  );
};

const MobileProductGrid: React.FC<MobileProductGridProps> = ({
  products,
  onAddToCart,
  onToggleWishlist,
  onQuickView,
  onShare,
  wishlistItems = [],
  className = ""
}) => {
  const isMobile = useIsMobile();

  const gridClasses = isMobile
    ? "grid grid-cols-2 gap-3 sm:gap-4"
    : "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 lg:gap-6";

  return (
    <div className={`${gridClasses} ${className}`}>
      {products.map((product) => (
        <MobileProductCard
          key={product.id}
          product={product}
          onAddToCart={onAddToCart}
          onToggleWishlist={onToggleWishlist}
          onQuickView={onQuickView}
          onShare={onShare}
          isWishlisted={wishlistItems.includes(product.id)}
        />
      ))}
    </div>
  );
};

export default MobileProductGrid;

// Also exported as a named export so either import style resolves
// (`import MobileProductGrid from ...` or `import { MobileProductGrid } from ...`).
export { MobileProductGrid };
