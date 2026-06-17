import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface FilterOption {
  label: string;
  value: string;
  count?: number;
}

interface VNSHCollectionFilterProps {
  className?: string;
}

const VNSHCollectionFilter: React.FC<VNSHCollectionFilterProps> = ({ className = '' }) => {
  const [availabilityOpen, setAvailabilityOpen] = React.useState(false);
  const [priceOpen, setPriceOpen] = React.useState(false);
  const [colorOpen, setColorOpen] = React.useState(false);
  const [sizeOpen, setSizeOpen] = React.useState(false);

  const availabilityOptions: FilterOption[] = [
    { label: 'In stock', value: 'in-stock', count: 8 },
    { label: 'Out of stock', value: 'out-of-stock', count: 3 },
  ];

  const priceOptions: FilterOption[] = [
    { label: 'Under $25', value: 'under-25' },
    { label: '$25 - $50', value: '25-50' },
    { label: '$50 - $100', value: '50-100' },
    { label: 'Over $100', value: 'over-100' },
  ];

  const colorOptions: FilterOption[] = [
    { label: 'Black', value: 'black' },
    { label: 'Brown', value: 'brown' },
    { label: 'Tan', value: 'tan' },
  ];

  const sizeOptions: FilterOption[] = [
    { label: 'Small', value: 'small' },
    { label: 'Medium', value: 'medium' },
    { label: 'Large', value: 'large' },
  ];

  const FilterSection = ({ 
    title, 
    options, 
    isOpen, 
    setIsOpen 
  }: { 
    title: string; 
    options: FilterOption[]; 
    isOpen: boolean; 
    setIsOpen: (open: boolean) => void;
  }) => (
    <div className="border-b border-gray-200 pb-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full text-left text-sm font-medium text-gray-700 hover:text-gray-900"
      >
        {title}
        {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      
      {isOpen && (
        <div className="mt-3 space-y-2">
          {options.map((option) => (
            <label key={option.value} className="flex items-center text-sm text-gray-600 hover:text-gray-900 cursor-pointer">
              <input
                type="checkbox"
                className="mr-3 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
              />
              <span className="flex-1">{option.label}</span>
              {option.count && (
                <span className="text-gray-400">({option.count})</span>
              )}
            </label>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className={`space-y-6 ${className}`}>
      <div>
        <h3 className="text-sm font-medium text-gray-900 mb-4">FILTER:</h3>
        
        <div className="space-y-6">
          <FilterSection
            title="Availability"
            options={availabilityOptions}
            isOpen={availabilityOpen}
            setIsOpen={setAvailabilityOpen}
          />
          
          <FilterSection
            title="Price"
            options={priceOptions}
            isOpen={priceOpen}
            setIsOpen={setPriceOpen}
          />
          
          <FilterSection
            title="Color"
            options={colorOptions}
            isOpen={colorOpen}
            setIsOpen={setColorOpen}
          />
          
          <FilterSection
            title="Size"
            options={sizeOptions}
            isOpen={sizeOpen}
            setIsOpen={setSizeOpen}
          />
        </div>
      </div>
    </div>
  );
};

export default VNSHCollectionFilter;

// Also exported as a named export so either import style resolves
// (`import VNSHCollectionFilter from ...` or `import { VNSHCollectionFilter } from ...`).
export { VNSHCollectionFilter };
