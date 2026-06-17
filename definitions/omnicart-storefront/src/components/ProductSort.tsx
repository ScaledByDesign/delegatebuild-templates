import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowUpDown } from 'lucide-react';

export type SortOption = 
  | 'featured'
  | 'price_asc'
  | 'price_desc'
  | 'name_asc'
  | 'name_desc'
  | 'created_at_asc'
  | 'created_at_desc';

interface ProductSortProps {
  value: SortOption;
  onValueChange: (value: SortOption) => void;
  className?: string;
}

const sortOptions = [
  { value: 'featured' as SortOption, label: 'Featured' },
  { value: 'price_asc' as SortOption, label: 'Price: Low to High' },
  { value: 'price_desc' as SortOption, label: 'Price: High to Low' },
  { value: 'name_asc' as SortOption, label: 'Name: A to Z' },
  { value: 'name_desc' as SortOption, label: 'Name: Z to A' },
  { value: 'created_at_desc' as SortOption, label: 'Newest First' },
  { value: 'created_at_asc' as SortOption, label: 'Oldest First' },
];

const ProductSort: React.FC<ProductSortProps> = ({
  value,
  onValueChange,
  className = ""
}) => {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <ArrowUpDown size={16} className="text-gray-500" />
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Sort by" />
        </SelectTrigger>
        <SelectContent>
          {sortOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default ProductSort;

// Also exported as a named export so either import style resolves
// (`import ProductSort from ...` or `import { ProductSort } from ...`).
export { ProductSort };
