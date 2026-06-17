import React from 'react';
import { ShoppingCart, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AddToCartButtonProps {
  onClick: () => void;
  disabled?: boolean;
  isLoading?: boolean;
  isSoldOut?: boolean;
  price?: number;
  showPrice?: boolean;
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}

/**
 * Standardized Add to Cart Button Component
 *
 * Features:
 * - Consistent styling across all product pages
 * - Supports loading state with spinner
 * - Optional price display
 * - Responsive sizing
 * - Clear visual feedback (hover, disabled, loading states)
 *
 * Usage:
 * <AddToCartButton
 *   onClick={handleAddToCart}
 *   disabled={!isAvailable}
 *   isLoading={isAdding}
 *   price={totalPrice}
 *   showPrice={true}
 *   fullWidth={true}
 * />
 */
const AddToCartButton: React.FC<AddToCartButtonProps> = ({
  onClick,
  disabled = false,
  isLoading = false,
  isSoldOut = false,
  price,
  showPrice = false,
  size = 'md',
  fullWidth = false,
}) => {
  const sizeClasses = {
    sm: 'h-8 text-sm',
    md: 'h-10 text-base',
    lg: 'h-11 text-lg',
  };

  const widthClass = fullWidth ? 'w-full' : '';

  const buttonText = React.useMemo(() => {
    if (isSoldOut) return 'Sold Out';
    if (isLoading) return 'Adding…';
    if (showPrice && price !== undefined) {
      return `Add to Cart - $${price.toFixed(2)}`;
    }
    return 'Add to Cart';
  }, [isSoldOut, isLoading, showPrice, price]);

  return (
    <Button
      onClick={onClick}
      disabled={disabled || isLoading || isSoldOut}
      className={`
        ${widthClass}
        ${sizeClasses[size]}
        bg-vnsh-green hover:bg-[#0f4a1c]
        text-white font-medium
        rounded-md
        transition-colors duration-200
        flex items-center justify-center gap-2
        disabled:opacity-50 disabled:cursor-not-allowed
      `}
      aria-label={buttonText}
    >
      {isLoading ? (
        <Loader2 size={18} className="animate-spin" />
      ) : (
        <ShoppingCart size={18} />
      )}
      <span>{buttonText}</span>
    </Button>
  );
};

export default AddToCartButton;

// Also exported as a named export so either import style resolves
// (`import AddToCartButton from ...` or `import { AddToCartButton } from ...`).
export { AddToCartButton };
