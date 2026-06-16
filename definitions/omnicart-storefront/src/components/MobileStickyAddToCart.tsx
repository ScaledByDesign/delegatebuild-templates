
import React, { useState, useEffect } from 'react';
import { ShoppingCart, Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface MobileStickyAddToCartProps {
  productName: string;
  price: number;
  onAddToCart: (quantity: number, size?: string) => void;
  productImage: string;
}

const MobileStickyAddToCart = ({ 
  productName, 
  price, 
  onAddToCart,
  productImage
}: MobileStickyAddToCartProps) => {
  const [quantity, setQuantity] = useState(1);
  const [size, setSize] = useState<string>("");
  const [totalPrice, setTotalPrice] = useState(price);
  
  // Available sizes - updated as requested
  const sizes = ["Regular", "Large", "Extra Large"];

  useEffect(() => {
    setTotalPrice(price * quantity);
  }, [price, quantity]);

  const handleDecrease = () => {
    if (quantity > 1) setQuantity(quantity - 1);
  };

  const handleIncrease = () => {
    setQuantity(quantity + 1);
  };

  const handleAddToCart = () => {
    onAddToCart(quantity, size);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-3 z-40 shadow-lg">
      {/* Product Image and Name - Line 1 */}
      <div className="flex items-center gap-3 mb-3">
        <div className="w-14 h-14 border rounded overflow-hidden flex-shrink-0">
          <img src={productImage} alt={productName} className="w-full h-full object-cover" />
        </div>
        <div className="flex-grow">
          <p className="text-sm font-medium truncate">{productName}</p>
          <p className="text-sm text-gray-500">${price.toFixed(2)}/each</p>
        </div>
      </div>
      
      {/* Quantity and Size controls - Line 2 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center border border-gray-300 rounded">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-9 w-9 rounded-none border-r border-gray-300"
            onClick={handleDecrease}
          >
            <Minus size={16} />
          </Button>
          <span className="px-2 min-w-[30px] text-center">{quantity}</span>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-9 w-9 rounded-none border-l border-gray-300"
            onClick={handleIncrease}
          >
            <Plus size={16} />
          </Button>
        </div>
        
        <div className="flex items-center">
          <Select value={size} onValueChange={setSize}>
            <SelectTrigger className="w-[130px] h-9 text-xs">
              <SelectValue placeholder="Select Size" />
            </SelectTrigger>
            <SelectContent>
              {sizes.map((sizeOption) => (
                <SelectItem key={sizeOption} value={sizeOption}>
                  {sizeOption}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      
      {/* Add to Cart button with total price - Line 3 */}
      <Button
        onClick={handleAddToCart}
        className="bg-vnsh-green hover:bg-[#0f4a1c] text-white w-full h-10 add-to-cart-button"
      >
        <ShoppingCart size={16} className="mr-2" />
        Add to Cart - ${totalPrice.toFixed(2)}
      </Button>
    </div>
  );
};

export default MobileStickyAddToCart;
