import React from 'react';
import { Link } from 'react-router-dom';
import { Star } from 'lucide-react';

interface VNSHProductCardProps {
  product: {
    id: string;
    handle: string;
    title: string;
    image?: string;
    price: number;
    compareAtPrice?: number;
    badge?: string;
    rating?: number;
    reviewCount?: number;
  };
}

const VNSHProductCard: React.FC<VNSHProductCardProps> = ({ product }) => {
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(price);
  };

  const renderStars = (rating: number = 4.6) => {
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            size={12}
            className={
              star <= Math.floor(rating)
                ? 'fill-orange-400 text-orange-400'
                : star <= rating
                ? 'fill-orange-200 text-orange-400'
                : 'text-gray-300'
            }
          />
        ))}
      </div>
    );
  };

  return (
    <Link
      to={`/products/${product.handle}`}
      className="group block bg-white border border-gray-200 hover:shadow-md transition-shadow duration-200"
    >
      <div className="relative aspect-square bg-gray-50 overflow-hidden">
        {product.image ? (
          <img
            src={product.image}
            alt={product.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-gray-100 flex items-center justify-center">
            <span className="text-gray-400 text-sm">No Image</span>
          </div>
        )}
        
        {/* NEW Badge */}
        {product.badge && (
          <div className="absolute top-3 left-3">
            <span className="bg-orange-500 text-white text-xs font-bold px-2 py-1 rounded">
              {product.badge.toUpperCase()}
            </span>
          </div>
        )}
      </div>

      <div className="p-4 space-y-2">
        {/* Product Title */}
        <h3 className="font-bold text-black text-sm uppercase leading-tight line-clamp-2">
          {product.title}
        </h3>

        {/* Price */}
        <div className="space-y-1">
          {product.compareAtPrice && product.compareAtPrice > product.price ? (
            <div className="flex items-center gap-2">
              <span className="text-vnsh-red font-bold text-sm">
                From {formatPrice(product.price)}
              </span>
              <span className="text-gray-400 line-through text-xs">
                {formatPrice(product.compareAtPrice)}
              </span>
            </div>
          ) : (
            <span className="text-vnsh-red font-bold text-sm">
              {product.price === 0 ? 'From $19.97' : formatPrice(product.price)}
            </span>
          )}
        </div>

        {/* Rating and Reviews */}
        <div className="flex items-center gap-2">
          {renderStars(product.rating)}
          <span className="text-gray-600 text-xs">
            {product.reviewCount || Math.floor(Math.random() * 500) + 50} Reviews
          </span>
        </div>
      </div>
    </Link>
  );
};

export default VNSHProductCard;