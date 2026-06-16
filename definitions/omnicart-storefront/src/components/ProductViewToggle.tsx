import React from 'react';
import { Grid, List } from 'lucide-react';
import { TouchTarget } from '@/components/MobileOptimizations';
import { ProductViewMode } from '@/hooks/useProductViewMode';

interface ProductViewToggleProps {
  viewMode: ProductViewMode;
  onToggle: () => void;
  className?: string;
}

/**
 * Toggle button for switching between grid and compact product views
 * Displays grid icon for grid view and list icon for compact view
 */
const ProductViewToggle: React.FC<ProductViewToggleProps> = ({
  viewMode,
  onToggle,
  className = ''
}) => {
  return (
    <div className={`flex items-center gap-1 bg-gray-100 rounded-lg p-1 ${className}`}>
      <TouchTarget
        onClick={onToggle}
        className={`
          p-2 rounded-md transition-colors
          ${viewMode === 'grid' 
            ? 'bg-white text-vnsh-red shadow-sm' 
            : 'text-gray-600 hover:text-gray-900'
          }
        `}
        aria-label="Grid view"
      >
        <Grid size={18} />
      </TouchTarget>
      
      <TouchTarget
        onClick={onToggle}
        className={`
          p-2 rounded-md transition-colors
          ${viewMode === 'compact' 
            ? 'bg-white text-vnsh-red shadow-sm' 
            : 'text-gray-600 hover:text-gray-900'
          }
        `}
        aria-label="Compact view"
      >
        <List size={18} />
      </TouchTarget>
    </div>
  );
};

export default ProductViewToggle;

