import React, { useState } from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getStarRating } from '@/services/omnicart/reviews';

interface StarRatingProps {
  rating: number;
  size?: 'sm' | 'md' | 'lg';
  interactive?: boolean;
  onChange?: (rating: number) => void;
  className?: string;
  showValue?: boolean;
  precision?: 'full' | 'half';
}

export const StarRating: React.FC<StarRatingProps> = ({
  rating,
  size = 'md',
  interactive = false,
  onChange,
  className,
  showValue = false,
  precision = 'half'
}) => {
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  
  const displayRating = hoverRating !== null ? hoverRating : rating;
  const { full, half, empty } = getStarRating(displayRating);

  const sizeClasses = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5'
  };

  const handleStarClick = (starIndex: number) => {
    if (interactive && onChange) {
      onChange(starIndex + 1);
    }
  };

  const handleStarHover = (starIndex: number) => {
    if (interactive) {
      setHoverRating(starIndex + 1);
    }
  };

  const handleMouseLeave = () => {
    if (interactive) {
      setHoverRating(null);
    }
  };

  const renderStars = () => {
    const stars = [];
    
    // Full stars
    for (let i = 0; i < full; i++) {
      stars.push(
        <Star
          key={`full-${i}`}
          className={cn(
            sizeClasses[size],
            'fill-yellow-400 text-yellow-400',
            interactive && 'cursor-pointer hover:scale-110 transition-transform'
          )}
          onClick={() => handleStarClick(i)}
          onMouseEnter={() => handleStarHover(i)}
        />
      );
    }
    
    // Half star
    if (half && precision === 'half') {
      stars.push(
        <div key="half" className="relative">
          <Star
            className={cn(
              sizeClasses[size],
              'text-gray-300',
              interactive && 'cursor-pointer hover:scale-110 transition-transform'
            )}
            onClick={() => handleStarClick(full)}
            onMouseEnter={() => handleStarHover(full)}
          />
          <div className="absolute inset-0 overflow-hidden w-1/2">
            <Star
              className={cn(
                sizeClasses[size],
                'fill-yellow-400 text-yellow-400'
              )}
            />
          </div>
        </div>
      );
    }
    
    // Empty stars
    const emptyCount = precision === 'half' ? empty : (5 - full);
    const startIndex = precision === 'half' ? (full + (half ? 1 : 0)) : full;
    
    for (let i = 0; i < emptyCount; i++) {
      stars.push(
        <Star
          key={`empty-${i}`}
          className={cn(
            sizeClasses[size],
            'text-gray-300',
            interactive && 'cursor-pointer hover:scale-110 transition-transform hover:text-yellow-400'
          )}
          onClick={() => handleStarClick(startIndex + i)}
          onMouseEnter={() => handleStarHover(startIndex + i)}
        />
      );
    }
    
    return stars;
  };

  return (
    <div 
      className={cn('flex items-center space-x-1', className)}
      onMouseLeave={handleMouseLeave}
    >
      <div className="flex items-center space-x-0.5">
        {renderStars()}
      </div>
      {showValue && (
        <span className={cn(
          'text-gray-600 font-medium',
          size === 'sm' && 'text-xs',
          size === 'md' && 'text-sm',
          size === 'lg' && 'text-base'
        )}>
          {rating.toFixed(1)}
        </span>
      )}
    </div>
  );
};

// Compact star rating for product cards
export const CompactStarRating: React.FC<{
  rating: number;
  reviewCount?: number;
  className?: string;
}> = ({ rating, reviewCount, className }) => {
  return (
    <div className={cn('flex items-center space-x-1', className)}>
      <StarRating rating={rating} size="sm" />
      <span className="text-xs text-gray-600">
        {rating.toFixed(1)}
        {reviewCount !== undefined && ` (${reviewCount})`}
      </span>
    </div>
  );
};

// Interactive star rating for review forms
export const InteractiveStarRating: React.FC<{
  rating: number;
  onChange: (rating: number) => void;
  className?: string;
  label?: string;
}> = ({ rating, onChange, className, label }) => {
  return (
    <div className={cn('space-y-2', className)}>
      {label && (
        <label className="text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      <div className="flex items-center space-x-2">
        <StarRating
          rating={rating}
          size="lg"
          interactive
          onChange={onChange}
          precision="full"
        />
        <span className="text-sm text-gray-600 min-w-[60px]">
          {rating > 0 ? `${rating} star${rating !== 1 ? 's' : ''}` : 'No rating'}
        </span>
      </div>
    </div>
  );
};

// Rating distribution bar for review summaries
export const RatingDistributionBar: React.FC<{
  rating: number;
  count: number;
  total: number;
  onClick?: () => void;
}> = ({ rating, count, total, onClick }) => {
  const percentage = total > 0 ? (count / total) * 100 : 0;
  
  return (
    <div 
      className={cn(
        'flex items-center space-x-2 py-1',
        onClick && 'cursor-pointer hover:bg-gray-50 px-2 -mx-2 rounded'
      )}
      onClick={onClick}
    >
      <div className="flex items-center space-x-1 w-12">
        <span className="text-sm text-gray-600">{rating}</span>
        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
      </div>
      
      <div className="flex-1 bg-gray-200 rounded-full h-2">
        <div
          className="bg-yellow-400 h-2 rounded-full transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
      
      <span className="text-sm text-gray-600 w-8 text-right">
        {count}
      </span>
    </div>
  );
};

export default StarRating;
