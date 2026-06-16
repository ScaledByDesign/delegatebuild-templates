import React from 'react';
import { Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useWishlistItem } from '@/hooks/useWishlist';

interface WishlistButtonProps {
  variantId: string;
  productId: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'ghost' | 'outline';
  className?: string;
  showText?: boolean;
  disabled?: boolean;
}

export const WishlistButton: React.FC<WishlistButtonProps> = ({
  variantId,
  productId,
  size = 'md',
  variant = 'ghost',
  className,
  showText = false,
  disabled = false
}) => {
  const { isInWishlist, toggle, isLoading } = useWishlistItem(variantId);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggle(productId);
  };

  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-12 w-12'
  };

  const iconSizes = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6'
  };

  return (
    <Button
      variant={variant}
      size={showText ? 'sm' : 'icon'}
      onClick={handleClick}
      disabled={disabled || isLoading}
      className={cn(
        'transition-all duration-200',
        !showText && sizeClasses[size],
        isInWishlist && variant === 'ghost' && 'text-vnsh-red hover:text-red-700',
        isInWishlist && variant === 'outline' && 'border-vnsh-red text-vnsh-red hover:bg-vnsh-red hover:text-white',
        isInWishlist && variant === 'default' && 'bg-vnsh-red hover:bg-[#0f4a1c]',
        className
      )}
      title={isInWishlist ? 'Remove from wishlist' : 'Add to wishlist'}
    >
      <Heart 
        className={cn(
          iconSizes[size],
          'transition-all duration-200',
          isInWishlist && 'fill-current',
          showText && 'mr-2'
        )} 
      />
      {showText && (
        <span className="text-sm">
          {isInWishlist ? 'Remove from Wishlist' : 'Add to Wishlist'}
        </span>
      )}
    </Button>
  );
};

// Compact version for product cards
export const WishlistHeartButton: React.FC<{
  variantId: string;
  productId: string;
  className?: string;
}> = ({ variantId, productId, className }) => {
  return (
    <WishlistButton
      variantId={variantId}
      productId={productId}
      size="sm"
      variant="ghost"
      className={cn(
        'absolute top-2 right-2 bg-white/80 backdrop-blur-sm hover:bg-white shadow-sm',
        className
      )}
    />
  );
};

// Full button with text for product detail pages
export const WishlistActionButton: React.FC<{
  variantId: string;
  productId: string;
  className?: string;
}> = ({ variantId, productId, className }) => {
  return (
    <WishlistButton
      variantId={variantId}
      productId={productId}
      size="md"
      variant="outline"
      showText={true}
      className={cn(
        'border-gray-300 hover:border-vnsh-red hover:text-vnsh-red',
        className
      )}
    />
  );
};

export default WishlistButton;
