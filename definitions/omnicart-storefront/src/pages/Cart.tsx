
import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Minus, Plus, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useCart } from '@/hooks/useCart';

const Cart = () => {
  // Use the cart context hook
  const { cart, isLoading, removeItem, updateItemQuantity } = useCart();

  // Use cart items from cart context - filter out mystery gift line items
  const cartItems = (cart?.items || []).filter(
    (item: any) => !item.metadata?.is_mystery_gift
  );

  // Check stock status directly from cart item variant data
  // Per Medusa v2 docs: variant is in stock if manage_inventory === false OR inventory_quantity > 0
  // https://docs.medusajs.com/resources/storefront-development/products/inventory
  const outOfStockItems = useMemo(() => {
    const outOfStock = new Set<string>();

    for (const item of cartItems) {
      const variant = item.variant as any;
      if (!variant) continue;

      // Check if variant is out of stock based on Medusa v2 inventory rules
      const manageInventory = variant.manage_inventory;
      const inventoryQuantity = variant.inventory_quantity;

      // If manage_inventory is false, item is always in stock
      if (manageInventory === false) continue;

      // If manage_inventory is true (or undefined, defaulting to managed):
      // - inventory_quantity > 0 means in stock
      // - inventory_quantity === 0 means out of stock
      // - inventory_quantity === null/undefined means no inventory level set for this stock location
      //   (could be a configuration issue, but we'll treat as in stock to avoid false positives)
      if (typeof inventoryQuantity === 'number' && inventoryQuantity <= 0) {
        outOfStock.add(item.id);
      }
    }

    return outOfStock;
  }, [cartItems]);

  const hasOutOfStockItems = outOfStockItems.size > 0;

  // Check for shipping-restricted items based on saved shipping address
  const restrictedItems = useMemo(() => {
    const province = (cart?.shipping_address as any)?.province;
    if (!province || !cartItems.length) return [];

    // Normalize province: "us-ak" → "AK"
    const stateCode = province.toUpperCase().replace(/^[A-Z]{2}-/, '');

    return cartItems.filter((item: any) => {
      const excluded = item.product?.metadata?.excluded_shipping_states;
      return Array.isArray(excluded) && excluded.some((s: string) => s.toUpperCase() === stateCode);
    });
  }, [cart?.shipping_address, cartItems]);

  const hasRestrictedItems = restrictedItems.length > 0;

  // Handle quantity updates
  const handleUpdateQuantity = async (id: string, newQuantity: number) => {
    if (newQuantity < 1) return;

    if (cart?.items?.length) {
      await updateItemQuantity(id, newQuantity);
    }
  };

  // Handle item removal
  const handleRemoveItem = async (id: string) => {
    if (cart?.items?.length) {
      await removeItem(id);
    }
  };

  // Calculate totals from cart data (API sends prices in dollars)
  // Use item_subtotal for subtotal display (items only, before tax/shipping)
  // Use total for the final total (includes tax if calculated)
  const subtotal = cart?.item_subtotal || 0;
  const total = cart?.total || 0;
  const taxTotal = cart?.tax_total || 0;
  const currencyCode = cart?.region?.currency_code?.toUpperCase() || 'USD';

  // Check if cart is empty
  const isCartEmpty = cartItems.length === 0;

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode,
    }).format(value);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-grow">
        {/* Cart Content */}
        <div className="container mx-auto px-4 py-8 max-w-6xl">
          {/* Header with title and continue shopping link */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 md:mb-10 gap-3">
            <h1 className="text-2xl md:text-[40px] font-normal uppercase mb-0" style={{ fontFamily: 'stratumno1-black' }}>
              Your Cart
            </h1>
            <Link
              to="/collections/all"
              className="text-sm md:text-[18px] underline hover:no-underline font-light"
              style={{ color: 'rgb(18, 18, 18)' }}
            >
              Continue shopping
            </Link>
          </div>

          {isCartEmpty ? (
            <div className="bg-white rounded-2xl shadow-sm p-8 text-center mb-8">
              <h2 className="text-2xl font-bold mb-2">Your cart is empty</h2>
              <p className="text-gray-500 mb-6">Looks like you haven't added any products to your cart yet.</p>
              <Button asChild className="bg-vnsh-green hover:bg-[#0f4a1c]">
                <Link to="/collections/all">Continue Shopping</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-10">
              {/* Out of stock warning banner */}
              {hasOutOfStockItems && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                  <AlertTriangle className="text-red-500 flex-shrink-0 mt-0.5" size={20} />
                  <div>
                    <p className="text-red-800 font-medium">Some items in your cart are no longer available</p>
                    <p className="text-red-600 text-sm mt-1">Please remove the sold out items before proceeding to checkout.</p>
                  </div>
                </div>
              )}

              {/* Shipping restriction warning banner */}
              {hasRestrictedItems && (
                <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex items-start gap-3">
                  <AlertTriangle className="text-amber-600 flex-shrink-0 mt-0.5" size={20} />
                  <div className="flex-1">
                    <p className="text-amber-800 font-medium">Shipping restriction</p>
                    <p className="text-amber-700 text-sm mt-1">
                      The following {restrictedItems.length === 1 ? 'item' : 'items'} cannot be shipped to your address. Please remove {restrictedItems.length === 1 ? 'it' : 'them'} before checkout:
                    </p>
                    <ul className="mt-2 space-y-1">
                      {restrictedItems.map((item: any) => (
                        <li key={item.id} className="flex items-center justify-between text-sm">
                          <span className="text-amber-800 font-medium">{item.product?.title || item.title}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.id)}
                            className="text-red-600 hover:text-red-800 text-xs font-medium underline ml-3"
                          >
                            Remove
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              <div className="space-y-6">
                {cartItems.map(item => {
                  const isOutOfStock = outOfStockItems.has(item.id);
                  return (
                  <article key={item.id} className={`bg-white border rounded-2xl sm:rounded-[32px] shadow-sm transition hover:shadow-md p-4 sm:p-5 ${isOutOfStock ? 'border-red-300 bg-red-50/50' : 'border-gray-100'}`}>
                    {isOutOfStock && (
                      <div className="flex items-center gap-2 text-red-600 text-sm font-medium mb-3 pb-3 border-b border-red-200">
                        <AlertTriangle size={16} />
                        <span>This item is sold out and must be removed</span>
                      </div>
                    )}
                    {/* Mobile: 2-row layout, Desktop: single row */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 lg:gap-6">
                      {/* Row 1 on mobile: Image + Product Info | Desktop: part of single row */}
                      <div className="flex items-start gap-3 sm:gap-4 sm:flex-1">
                        {/* Product Image */}
                        <div className={`h-16 w-16 sm:h-24 sm:w-24 flex-shrink-0 overflow-hidden rounded-xl sm:rounded-2xl bg-gray-50 ${isOutOfStock ? 'opacity-50' : ''}`}>
                          <img
                            src={item.thumbnail || item.product?.thumbnail || '/placeholder.svg'}
                            alt={item.title}
                            className="h-full w-full object-cover"
                          />
                        </div>

                        {/* Product Name and Variant Info */}
                        <div className={`flex-1 min-w-0 ${isOutOfStock ? 'opacity-60' : ''}`}>
                          <Link
                            to={`/products/${item.product?.handle}`}
                            className="hover:underline text-sm sm:text-base lg:text-lg font-semibold uppercase tracking-wide block text-vnsh-dark line-clamp-2 sm:line-clamp-1"
                          >
                            {item.title}
                          </Link>
                          {item.variant?.title && item.variant.title !== 'Default Title' && (
                            <div className="text-xs text-gray-600 mt-0.5">
                              {item.variant.title}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Row 2 on mobile: Qty + Price + Remove | Desktop: right side of single row */}
                      <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-6 sm:flex-shrink-0 pl-[76px] sm:pl-0">
                        {/* Quantity Controls */}
                        <div className="flex items-center gap-0 border border-gray-300 rounded-lg overflow-hidden bg-white shadow-sm">
                          <button
                            type="button"
                            onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                            disabled={item.quantity <= 1}
                            className="h-9 w-9 sm:h-11 sm:w-11 flex items-center justify-center bg-gray-50 hover:bg-gray-100 active:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors touch-manipulation border-r border-gray-300"
                            aria-label={`Decrease quantity for ${item.title}`}
                          >
                            <Minus size={14} className="text-gray-700 sm:hidden" />
                            <Minus size={18} className="text-gray-700 hidden sm:block" />
                          </button>
                          <div className="h-9 sm:h-11 min-w-[36px] sm:min-w-[60px] px-2 sm:px-4 flex items-center justify-center">
                            <span className="text-sm sm:text-base font-semibold text-gray-900">{item.quantity}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                            className="h-9 w-9 sm:h-11 sm:w-11 flex items-center justify-center bg-gray-50 hover:bg-gray-100 active:bg-gray-200 transition-colors touch-manipulation border-l border-gray-300"
                            aria-label={`Increase quantity for ${item.title}`}
                          >
                            <Plus size={14} className="text-gray-700 sm:hidden" />
                            <Plus size={18} className="text-gray-700 hidden sm:block" />
                          </button>
                        </div>

                        {/* Price - mobile inline, desktop stacked with remove */}
                        <span className="text-sm sm:text-lg font-semibold text-gray-900 whitespace-nowrap sm:hidden">
                          {formatCurrency(item.unit_price * item.quantity)}
                        </span>

                        {/* Remove button - mobile */}
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.id)}
                          className="sm:hidden text-xs font-medium text-vnsh-red hover:text-vnsh-red/80 transition uppercase"
                          aria-label={`Remove ${item.title}`}
                        >
                          Remove
                        </button>

                        {/* Price + Remove - desktop only */}
                        <div className="hidden sm:flex flex-col items-end gap-2 flex-shrink-0">
                          <span className="text-lg font-semibold text-gray-900 whitespace-nowrap">
                            {formatCurrency(item.unit_price * item.quantity)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.id)}
                            className="text-sm font-medium text-vnsh-red hover:text-vnsh-red/80 transition underline"
                            aria-label={`Remove ${item.title}`}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                  );
                })}
              </div>

              <div className="flex w-full justify-end">
                <div className="w-full max-w-md rounded-[32px] border border-gray-100 bg-white p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-lg font-semibold text-vnsh-dark">Estimated Total</h2>
                    <span className="text-sm text-gray-500">{cartItems.length} items</span>
                  </div>
                  <div className="space-y-2 text-gray-700">
                    <div className="flex justify-between text-sm">
                      <span>Subtotal</span>
                      <span>{formatCurrency(subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Shipping</span>
                      <span className="text-gray-500">Calculated at checkout</span>
                    </div>
                    {cart?.discount_total > 0 && (
                      <div className="flex justify-between text-sm text-green-600">
                        <span>Discount</span>
                        <span>-{formatCurrency(cart.discount_total)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-base font-semibold pt-2 border-t border-gray-200">
                      <span>Total</span>
                      <span>{formatCurrency(subtotal)}</span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-3">
                    Taxes, discounts, and{' '}
                    <Link
                      to="/pages/shipping-policy"
                      className="underline hover:no-underline"
                    >
                      shipping
                    </Link>{' '}
                    are calculated at checkout.
                  </p>
                  {hasOutOfStockItems ? (
                    <div className="mt-6">
                      <Button disabled className="w-full bg-gray-400 cursor-not-allowed">
                        Remove Sold Out Items to Checkout
                      </Button>
                    </div>
                  ) : hasRestrictedItems ? (
                    <div className="mt-6">
                      <Button disabled className="w-full bg-gray-400 cursor-not-allowed">
                        Remove Restricted Items to Checkout
                      </Button>
                    </div>
                  ) : (
                    <Link to="/express-checkout" className="mt-6 block">
                      <Button className="w-full bg-vnsh-green hover:bg-[#0f4a1c]">
                        Continue to Checkout
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Cart;
