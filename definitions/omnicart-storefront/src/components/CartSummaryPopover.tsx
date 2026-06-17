import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { X, ShoppingCart } from 'lucide-react';
import { useCartSummary } from '@/context/CartSummaryContext';

const CartSummaryPopover: React.FC = () => {
  const { isOpen, data, closeSummary } = useCartSummary();
  const popoverRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, right: 0 });

  // Calculate position relative to cart icon
  useEffect(() => {
    if (isOpen) {
      // Try desktop cart icon first, then mobile
      const cartIcon = document.getElementById('desktop-cart-icon') || document.getElementById('mobile-cart-icon');

      if (cartIcon) {
        const rect = cartIcon.getBoundingClientRect();
        setPosition({
          top: rect.bottom + 8, // 8px below the cart icon
          right: window.innerWidth - rect.right, // Align right edge with cart icon
        });
      }
    }
  }, [isOpen]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        closeSummary();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, closeSummary]);

  if (!isOpen || !data) return null;

  const { item, cartTotal, cartItemCount } = data;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      <div
        ref={popoverRef}
        style={{ top: `${position.top}px`, right: `${position.right}px` }}
        className="pointer-events-auto absolute w-80 bg-white border border-gray-200 rounded-lg shadow-xl animate-in slide-in-from-top-2 duration-200"
      >
        {/* Close Button */}
        <button
          onClick={closeSummary}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Close"
        >
          <X size={20} />
        </button>

        {/* Header */}
        <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 rounded-t-lg">
          <h3 className="text-sm font-semibold text-gray-800">Item Added to Cart</h3>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Item Details */}
          <div className="flex gap-3">
            {/* Thumbnail */}
            {item.thumbnail && (
              <div className="flex-shrink-0">
                <img
                  src={item.thumbnail}
                  alt={item.title}
                  className="w-16 h-16 object-cover rounded border border-gray-200"
                />
              </div>
            )}

            {/* Item Info */}
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-medium text-gray-900 truncate">
                {item.title}
              </h4>
              {item.variant && item.variant !== 'Default Title' && (
                <div className="text-xs text-gray-500 mt-0.5">
                  {item.variant.split(' / ').map((part, index) => {
                    const [key, value] = part.includes(':')
                      ? part.split(':').map(s => s.trim())
                      : ['Option', part.trim()];
                    return (
                      <span key={index} className="mr-2">
                        {key}: {value}
                      </span>
                    );
                  })}
                </div>
              )}
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-gray-600">
                  Qty: <span className="font-medium">{item.quantity}</span>
                </span>
                <span className="text-sm font-medium text-gray-900">
                  ${item.total.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-200" />

          {/* Cart Summary */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-600">Cart Total:</span>
              <span className="font-semibold text-gray-900">
                ${cartTotal.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs text-gray-500">
              <span>{cartItemCount} item{cartItemCount !== 1 ? 's' : ''} in cart</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <Link
              to="/cart"
              onClick={closeSummary}
              className="flex-1 bg-vnsh-green hover:bg-[#0f4a1c] text-white text-sm font-medium py-2 rounded transition-colors flex items-center justify-center gap-1"
            >
              <ShoppingCart size={16} />
              View Cart
            </Link>
            <button
              onClick={closeSummary}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 text-sm font-medium py-2 rounded transition-colors"
            >
              Continue Shopping
            </button>
          </div>
        </div>

        {/* Auto-dismiss hint */}
        <div className="bg-gray-50 px-4 py-2 rounded-b-lg border-t border-gray-200">
          <p className="text-xs text-gray-500 text-center">
            This will close automatically
          </p>
        </div>
      </div>
    </div>
  );
};

export default CartSummaryPopover;

// Also exported as a named export so either import style resolves
// (`import CartSummaryPopover from ...` or `import { CartSummaryPopover } from ...`).
export { CartSummaryPopover };
