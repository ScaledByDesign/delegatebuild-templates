import React from 'react';
import { X } from 'lucide-react';

const PromotionalBanners: React.FC = () => {
  const [showNewProduct, setShowNewProduct] = React.useState(true);
  const [showFreeShipping, setShowFreeShipping] = React.useState(true);

  if (!showNewProduct && !showFreeShipping) return null;

  return (
    <div className="w-full">
      {/* New Product Banner */}
      {showNewProduct && (
        <div className="bg-orange-500 text-white py-2 px-4 text-center relative" style={{ fontFamily: 'URWDIN-Regular' }}>
          <a href="/products/the-vnsh-holster-weapon-mounted-light-compatible" className="text-[14px] leading-[20px] font-semibold hover:underline">
            New Product: Weapon Mounted Light Compatible Holster Now Available - Buy Now and Get 2 FREE Gifts
          </a>
          <button
            onClick={() => setShowNewProduct(false)}
            className="absolute right-4 top-1/2 transform -translate-y-1/2 hover:opacity-75"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Free Shipping Banner */}
      {showFreeShipping && (
        <div className="bg-black text-white py-1.5 px-4 text-center relative" style={{ fontFamily: 'URWDIN-Regular' }}>
          <span className="text-[13px] leading-[18px] font-medium">
            🔥 Welcome to our store. Free shipping over $50 🔥
          </span>
          <button
            onClick={() => setShowFreeShipping(false)}
            className="absolute right-4 top-1/2 transform -translate-y-1/2 hover:opacity-75"
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
};

export default PromotionalBanners;