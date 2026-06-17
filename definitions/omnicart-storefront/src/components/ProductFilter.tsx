import React, { useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

export interface FilterOptions {
  categories: string[];
  collections: string[];
  priceRange?: [number, number];
  inStock: boolean;
}

interface ProductFilterProps {
  filters: FilterOptions;
  onFiltersChange: (filters: FilterOptions) => void;
  availableCategories: string[];
  availableCollections: string[];
  maxPrice?: number;
  className?: string;
}

const ProductFilter: React.FC<ProductFilterProps> = ({
  filters,
  onFiltersChange,
  availableCategories,
  availableCollections,
  className = ""
}) => {
  const [isCategoriesOpen, setIsCategoriesOpen] = useState(false);
  const [isCollectionsOpen, setIsCollectionsOpen] = useState(false);
  const [isStockOpen, setIsStockOpen] = useState(false);

  const formatLabel = (value: string) =>
    value
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());

  const updateFilters = (updates: Partial<FilterOptions>) => {
    onFiltersChange({ ...filters, ...updates });
  };

  const toggleCategory = (category: string) => {
    const newCategories = filters.categories.includes(category)
      ? filters.categories.filter(c => c !== category)
      : [...filters.categories, category];
    updateFilters({ categories: newCategories });
  };

  const toggleCollection = (collection: string) => {
    const newCollections = filters.collections.includes(collection)
      ? filters.collections.filter(c => c !== collection)
      : [...filters.collections, collection];
    updateFilters({ collections: newCollections });
  };

  const getSelectedCount = (type: 'categories' | 'collections' | 'stock') => {
    if (type === 'categories') return filters.categories.length;
    if (type === 'collections') return filters.collections.length;
    if (type === 'stock') return filters.inStock ? 1 : 0;
    return 0;
  };

  return (
    <div className={className}>
      {/* Filter Heading - matching original VNSH style */}
      <h2
        className="text-sm font-light uppercase mb-4"
        style={{
          fontSize: '14px',
          fontWeight: 300,
          letterSpacing: '0.4px',
          color: 'rgba(18, 18, 18, 0.85)'
        }}
      >
        FILTER:
      </h2>

      <div className="space-y-0">
        {/* Categories Filter */}
        {availableCategories.length > 0 && (
          <details
            className="mb-[15px]"
            open={isCategoriesOpen}
            onToggle={(e) => setIsCategoriesOpen((e.target as HTMLDetailsElement).open)}
          >
            <summary
              className="cursor-pointer list-none pr-[17.5px] mb-0"
              style={{
                fontSize: '14px',
                fontWeight: 300,
                fontFamily: 'URWDIN-Regular',
                color: 'rgba(18, 18, 18, 0.75)',
                letterSpacing: '0.4px',
                lineHeight: '21px'
              }}
            >
              <span>
                Categories
                {getSelectedCount('categories') > 0 && ` (${getSelectedCount('categories')} selected)`}
              </span>
            </summary>
            <div className="mt-3 space-y-2 pl-0">
              {availableCategories.map((category) => (
                <label
                  key={category}
                  className="flex items-center cursor-pointer group"
                  style={{
                    fontSize: '14px',
                    color: 'rgba(18, 18, 18, 0.75)'
                  }}
                >
                  <Checkbox
                    id={`category-${category}`}
                    checked={filters.categories.includes(category)}
                    onCheckedChange={() => toggleCategory(category)}
                    className="mr-3"
                  />
                  <span className="flex-1 group-hover:text-gray-900 transition-colors">
                    {formatLabel(category)}
                  </span>
                </label>
              ))}
            </div>
          </details>
        )}

        {/* Collections Filter */}
        {availableCollections.length > 0 && (
          <details
            className="mb-[15px]"
            open={isCollectionsOpen}
            onToggle={(e) => setIsCollectionsOpen((e.target as HTMLDetailsElement).open)}
          >
            <summary
              className="cursor-pointer list-none pr-[17.5px] mb-0"
              style={{
                fontSize: '14px',
                fontWeight: 300,
                fontFamily: 'URWDIN-Regular',
                color: 'rgba(18, 18, 18, 0.75)',
                letterSpacing: '0.4px',
                lineHeight: '21px'
              }}
            >
              <span>
                Collections
                {getSelectedCount('collections') > 0 && ` (${getSelectedCount('collections')} selected)`}
              </span>
            </summary>
            <div className="mt-3 space-y-2 pl-0">
              {availableCollections.map((collection) => (
                <label
                  key={collection}
                  className="flex items-center cursor-pointer group"
                  style={{
                    fontSize: '14px',
                    color: 'rgba(18, 18, 18, 0.75)'
                  }}
                >
                  <Checkbox
                    id={`collection-${collection}`}
                    checked={filters.collections.includes(collection)}
                    onCheckedChange={() => toggleCollection(collection)}
                    className="mr-3"
                  />
                  <span className="flex-1 group-hover:text-gray-900 transition-colors">
                    {formatLabel(collection)}
                  </span>
                </label>
              ))}
            </div>
          </details>
        )}

        {/* Stock Filter */}
        <details
          className="mb-[15px]"
          open={isStockOpen}
          onToggle={(e) => setIsStockOpen((e.target as HTMLDetailsElement).open)}
        >
          <summary
            className="cursor-pointer list-none pr-[17.5px] mb-0"
            style={{
              fontSize: '14px',
              fontWeight: 300,
              fontFamily: 'URWDIN-Regular',
              color: 'rgba(18, 18, 18, 0.75)',
              letterSpacing: '0.4px',
              lineHeight: '21px'
            }}
          >
            <span>
              Availability
              {getSelectedCount('stock') > 0 && ` (${getSelectedCount('stock')} selected)`}
            </span>
          </summary>
          <div className="mt-3 space-y-2 pl-0">
            <label
              className="flex items-center cursor-pointer group"
              style={{
                fontSize: '14px',
                color: 'rgba(18, 18, 18, 0.75)'
              }}
            >
              <Checkbox
                id="in-stock"
                checked={filters.inStock}
                onCheckedChange={(checked) => updateFilters({ inStock: !!checked })}
                className="mr-3"
              />
              <span className="flex-1 group-hover:text-gray-900 transition-colors">
                In Stock Only
              </span>
            </label>
          </div>
        </details>
      </div>
    </div>
  );
};

export default ProductFilter;
