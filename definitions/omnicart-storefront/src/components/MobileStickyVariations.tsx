import React, { useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import AddToCartButton from '@/components/AddToCartButton';

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

interface MobileStickyVariationsProps {
  productName: string;
  price: number;
  productImage: string;
  options: ProductOption[];
  selectedOptions: Record<string, string>;
  availableOptions: Record<string, string[]>;
  quantity: number;
  onOptionChange: (optionId: string, value: string) => void;
  onQuantityChange: (quantity: number) => void;
  onAddToCart: () => void;
  disabled?: boolean;
  isLoading?: boolean;
  isSoldOut?: boolean;
  forceExpanded?: boolean;
}

const MobileStickyVariations = ({
  productName,
  price,
  productImage,
  options,
  selectedOptions,
  availableOptions,
  quantity,
  onOptionChange,
  onQuantityChange,
  onAddToCart,
  disabled = false,
  isLoading = false,
  isSoldOut = false,
  forceExpanded = false
}: MobileStickyVariationsProps) => {
  const [isExpanded, setIsExpanded] = useState(forceExpanded);

  const totalPrice = price * quantity;

  // Check if product has variations
  const hasVariations = options.length > 0;

  const handleDecrease = () => {
    if (quantity > 1) onQuantityChange(quantity - 1);
  };

  const handleIncrease = () => {
    onQuantityChange(quantity + 1);
  };

  const containerClasses = forceExpanded
    ? "w-full border border-gray-200 rounded-2xl bg-white p-4 space-y-4"
    : "fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 shadow-lg";

  return (
    <div className={containerClasses}>
      {/* Compact View with Inline Variations (only when not forced expanded) */}
      {!forceExpanded && !isExpanded && (
        <div className="p-3 space-y-3">
          {/* Product Info Row with Variations Stacked on Right */}
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 border rounded overflow-hidden flex-shrink-0">
              <img src={productImage} alt={productName} className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-urwdin font-medium truncate">{productName}</p>
              <p className="text-sm font-urwdin text-gray-600">${totalPrice.toFixed(2)}</p>
            </div>

            {/* Variations Stacked on Right - Label and Dropdown Side by Side */}
            {hasVariations && (
              <div className="flex flex-col gap-1.5 min-w-[140px]">
                {options.map((option) => (
                  <div key={option.id} className="flex items-center gap-2">
                    <label className="text-xs font-urwdin font-medium text-gray-700 uppercase tracking-wide whitespace-nowrap">
                      {option.title}
                    </label>
                    <Select
                      value={selectedOptions[option.id] || ""}
                      onValueChange={(value) => onOptionChange(option.id, value)}
                    >
                      <SelectTrigger className="h-7 text-xs font-urwdin font-normal flex-1">
                        <SelectValue placeholder={`Select ${option.title}`} />
                      </SelectTrigger>
                      <SelectContent className="font-urwdin">
                        {option.values.map((optionValue) => {
                          const isAvailable = availableOptions[option.id]?.includes(optionValue.value) ?? true;
                          return (
                            <SelectItem
                              key={optionValue.id}
                              value={optionValue.value}
                              disabled={!isAvailable}
                              className="text-sm"
                            >
                              {optionValue.value} {!isAvailable && '(Sold out)'}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quantity and Add to Cart Row */}
          <div className="flex items-center gap-2">
            {/* Quantity */}
            <div className="flex items-center border border-gray-300 rounded">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-none border-r border-gray-300"
                onClick={handleDecrease}
                disabled={quantity <= 1}
              >
                <Minus size={14} />
              </Button>
              <span className="px-3 text-sm min-w-[40px] text-center">{quantity}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-none border-l border-gray-300"
                onClick={handleIncrease}
              >
                <Plus size={14} />
              </Button>
            </div>

            {/* Add to Cart */}
            <div className="flex-1">
              <AddToCartButton
                onClick={onAddToCart}
                disabled={disabled}
                isLoading={isLoading}
                isSoldOut={isSoldOut}
                price={totalPrice}
                showPrice={true}
                size="sm"
                fullWidth={true}
              />
            </div>
          </div>
        </div>
      )}

      {/* Expanded View */}
      {isExpanded && (
        <div className="p-4 space-y-4">
          {/* Header with collapse button */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 border rounded overflow-hidden flex-shrink-0">
                <img src={productImage} alt={productName} className="w-full h-full object-cover" />
              </div>
              <div>
                <p className="text-sm font-medium">{productName}</p>
                <p className="text-sm text-gray-500">${price.toFixed(2)}/each</p>
              </div>
            </div>
            {!forceExpanded && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(false)}
                className="text-xs"
              >
                ✕
              </Button>
            )}
          </div>

          {/* Dynamic Option Selection */}
          {options.map((option) => (
            <div key={option.id} className="flex items-center gap-3">
              <label className="text-sm font-medium text-gray-900 w-20 shrink-0">
                {option.title}
              </label>
              <Select
                value={selectedOptions[option.id] || ""}
                onValueChange={(value) => onOptionChange(option.id, value)}
              >
                <SelectTrigger className="w-full h-10">
                  <SelectValue placeholder={`Select ${option.title}`} />
                </SelectTrigger>
                <SelectContent>
                  {option.values.map((optionValue) => {
                    const isAvailable = availableOptions[option.id]?.includes(optionValue.value) ?? true;
                    return (
                      <SelectItem
                        key={optionValue.id}
                        value={optionValue.value}
                        disabled={!isAvailable}
                      >
                        {optionValue.value} {!isAvailable && '(Sold out)'}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          ))}

          {/* Quantity */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-900">Quantity</label>
            <div className="flex items-center border border-gray-300 rounded overflow-hidden">
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-10 w-10 rounded-none border-r border-gray-300 p-0"
                onClick={handleDecrease}
                disabled={quantity <= 1}
              >
                <Minus size={16} />
              </Button>
              <span className="px-3 min-w-[44px] text-center">{quantity}</span>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-10 w-10 rounded-none border-l border-gray-300 p-0"
                onClick={handleIncrease}
              >
                <Plus size={16} />
              </Button>
            </div>
          </div>

          {/* Add to Cart */}
          <AddToCartButton
            onClick={onAddToCart}
            disabled={disabled}
            isLoading={isLoading}
            isSoldOut={isSoldOut}
            price={totalPrice}
            showPrice={true}
            size="md"
            fullWidth={true}
          />
        </div>
      )}
    </div>
  );
};

export default MobileStickyVariations;
