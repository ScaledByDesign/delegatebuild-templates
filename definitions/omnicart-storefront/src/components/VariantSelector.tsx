import React from 'react';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OptionValue {
  id: string;
  value: string;
  metadata?: Record<string, unknown>;
}

interface ProductOption {
  id: string;
  title: string;
  values: OptionValue[];
}

interface VariantSelectorProps {
  options: ProductOption[];
  selectedOptions: Record<string, string>;
  availableOptions: Record<string, string[]>;
  onOptionChange: (optionId: string, value: string) => void;
  className?: string;
}

const VariantSelector: React.FC<VariantSelectorProps> = ({
  options,
  selectedOptions,
  availableOptions,
  onOptionChange,
  className = ""
}) => {
  const getOptionStatus = (optionId: string, value: string) => {
    const isSelected = selectedOptions[optionId] === value;
    const isAvailable = availableOptions[optionId]?.includes(value) ?? false;
    
    return { isSelected, isAvailable };
  };

  const isOptionComplete = (optionId: string) => {
    return selectedOptions[optionId] !== undefined;
  };

  const getOptionButtonClasses = (isSelected: boolean, isAvailable: boolean) => {
    return cn(
      "relative uppercase tracking-wide transition-all duration-200",
      "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900",
      {
        // Selected state
        "text-white shadow": isSelected,
        // Available but not selected
        "bg-white text-gray-900 hover:bg-gray-50":
          !isSelected && isAvailable,
        // Unavailable
        "bg-white text-gray-400 cursor-not-allowed":
          !isAvailable,
      }
    );
  };

  const getOptionButtonStyles = (isSelected: boolean, isAvailable: boolean) => {
    return {
      fontSize: '13px',
      fontWeight: '300',
      padding: '8px 14px',
      minHeight: '36px',
      border: isSelected
        ? '1px solid #121212'
        : isAvailable
          ? '1px solid rgba(18, 18, 18, 0.55)'
          : '1px solid rgba(18, 18, 18, 0.2)',
      borderRadius: '40px',
      backgroundColor: isSelected ? '#121212' : '#ffffff',
    };
  };

  return (
    <div className={`space-y-8 ${className}`}>
      {options.map((option) => {
        const isComplete = isOptionComplete(option.id);

        return (
          <div key={option.id} className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold uppercase tracking-wide text-gray-900">
                {option.title}
              </span>
              {!selectedOptions[option.id] && (
                <span className="text-xs uppercase tracking-wide text-gray-400">
                  Select {option.title.toLowerCase()}
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-3">
              {option.values?.map((value) => {
                const { isSelected, isAvailable } = getOptionStatus(option.id, value.value);

                return (
                  <button
                    key={value.id}
                    onClick={() => isAvailable && onOptionChange(option.id, value.value)}
                    disabled={!isAvailable}
                    className={getOptionButtonClasses(isSelected, isAvailable)}
                    style={getOptionButtonStyles(isSelected, isAvailable)}
                    aria-pressed={isSelected}
                    aria-label={`Select ${option.title}: ${value.value}`}
                  >
                    <span className="block text-center uppercase tracking-wide">
                      {value.value}
                    </span>
                    {!isAvailable && (
                      <span className="pointer-events-none absolute inset-x-3 top-1/2 h-px -translate-y-1/2 rotate-[-12deg] bg-gray-400" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Validation message */}
            {!isComplete && (
              <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500">
                <AlertCircle size={14} />
                <span>Please select a {option.title.toLowerCase()}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default VariantSelector;

// Also exported as a named export so either import style resolves
// (`import VariantSelector from ...` or `import { VariantSelector } from ...`).
export { VariantSelector };
