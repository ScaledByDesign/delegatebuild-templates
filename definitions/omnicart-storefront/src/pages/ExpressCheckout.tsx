/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, Minus, Plus, AlertTriangle } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { useCart } from "@/hooks/useCart";
import { updateCart, addShippingMethod, createCart, addToCart, retrieveCart } from "@/lib/data/cart";
import { updateCartEmail, calculateCartTaxes, updateShippingAddressWithTaxes, batchUpdateCart } from "@/lib/data/checkout";
import { sdk } from "@/lib/sdk";
import { listCartShippingOptions } from "@/services/medusa/shipping";
import { normalizeStateCode, capitalizeWords } from "@/lib/checkout/states";
import DiscountCode from "@/components/DiscountCode";
import { Separator } from '@/components/ui/separator';
import { StripePaymentWrapper } from '@/lib/stripe/StripePaymentWrapper';
import { buildExpressCheckoutLineItems } from '@/lib/stripe/expressCheckoutLineItems';
import { PaymentElementComponent } from '@/components/checkout/PaymentElementComponent';
import { ExpressCheckout as ExpressCheckoutElement } from '@/components/checkout/ExpressCheckoutElement';
import { ShippingAddressForm } from '@/components/checkout/ShippingAddressForm';
import {
  saveOrderRecoveryData,
  clearOrderRecoveryData,
  completeCartWithRetry,
  attemptOrderRecovery,
  getOrderRecoveryData,
} from '@/lib/checkout/orderRecovery';

/**
 * Helper function to wait for tax recalculation after address update.
 * Medusa may delete existing tax lines during address update and recreate them.
 * This function polls the cart until tax calculation is complete or timeout.
 */

// Removed Stripe Tax calculation - now relying on Medusa's built-in tax calculation

const parseCustomerName = (rawName?: string) => {
  if (!rawName) {
    return null;
  }

  const withoutPrefix = rawName.trim().replace(/^\s*#\d+\s*/, '').trim();
  if (!withoutPrefix) {
    return null;
  }

  const alias = withoutPrefix.split('@')[0];
  const tokens = alias.split(/[\s.\-_]+/).filter(Boolean);
  if (tokens.length === 0) {
    return null;
  }

  const deduped: string[] = [];
  tokens.forEach((token) => {
    const lowerToken = token.toLowerCase();
    const lastToken = deduped[deduped.length - 1];
    if (lastToken && lastToken.toLowerCase() === lowerToken) {
      return;
    }
    deduped.push(token);
  });

  if (deduped.length === 0) {
    return null;
  }

  const firstName = capitalizeWords(deduped[0]);
  const lastName = deduped.length > 1 ? capitalizeWords(deduped.slice(1).join(' ')) : '';

  return { firstName, lastName };
};

const waitForTaxRecalculation = async (
  cartId: string,
  expectedTaxableState: string | undefined,
  maxRetries: number = 5,
  delayMs: number = 500
): Promise<{ cart: any; taxReady: boolean }> => {
  console.log(`🔄 Waiting for tax recalculation (state: ${expectedTaxableState || 'unknown'})...`);

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    // Wait before checking (give Medusa time to recalculate)
    await new Promise(resolve => setTimeout(resolve, delayMs));

    try {
      const refreshedCart = await retrieveCart(cartId);

      if (!refreshedCart) {
        console.warn(`⚠️ Attempt ${attempt}/${maxRetries}: Failed to retrieve cart`);
        continue;
      }

      const taxTotal = refreshedCart.tax_total || 0;
      const subtotal = refreshedCart.subtotal || 0;
      const province = refreshedCart.shipping_address?.province || '';

      console.log(`🔄 Attempt ${attempt}/${maxRetries}: tax_total=$${taxTotal}, subtotal=$${subtotal}, province=${province}`);

      // Check if we expect tax for this state (Texas, California, etc.)
      // This is a basic heuristic - you may need to adjust based on your tax regions
      const taxableStates = ['TX', 'CA', 'NY', 'FL', 'WA', 'PA', 'IL', 'OH', 'GA', 'NC', 'MI', 'NJ', 'VA', 'AZ', 'MA', 'TN', 'IN', 'MO', 'MD', 'WI', 'CO', 'MN', 'SC', 'AL', 'LA', 'KY', 'OR', 'OK', 'CT', 'IA', 'UT', 'MS', 'AR', 'NV', 'KS', 'NM', 'NE', 'WV', 'ID', 'HI', 'NH', 'ME', 'RI', 'MT', 'DE', 'SD', 'ND', 'AK', 'VT', 'WY'];
      const stateCode = String(expectedTaxableState || province || '').toUpperCase().replace(/^US-/, '');
      const expectsTax = taxableStates.includes(stateCode) && subtotal > 0;

      // If we don't expect tax, we're done
      if (!expectsTax) {
        console.log(`✅ Tax recalculation complete: No tax expected for state ${stateCode}`);
        return { cart: refreshedCart, taxReady: true };
      }

      // If we expect tax and have it, we're done
      if (taxTotal > 0) {
        const taxRate = subtotal > 0 ? ((taxTotal / subtotal) * 100).toFixed(2) : '0.00';
        console.log(`✅ Tax recalculation complete: $${taxTotal} (${taxRate}%) for ${stateCode}`);
        return { cart: refreshedCart, taxReady: true };
      }

      // Tax not ready yet, continue polling
      console.log(`⏳ Tax not ready yet for ${stateCode}, waiting...`);
    } catch (error) {
      console.error(`❌ Attempt ${attempt}/${maxRetries}: Error retrieving cart:`, error);
    }
  }

  // Timeout - return last cart state
  console.warn(`⚠️ Tax recalculation timeout after ${maxRetries} attempts`);
  const finalCart = await retrieveCart(cartId);
  return { cart: finalCart, taxReady: false };
};

/**
 * Validates that the cart total is consistent with the payment amount.
 * Returns true if totals match (within a small tolerance), false otherwise.
 */
const validateCartVsPayment = (
  cart: any,
  paymentAmountCents: number
): { isValid: boolean; cartTotal: number; paymentTotal: number; difference: number } => {
  // Cart totals are in dollars, PaymentIntent amount is in cents
  const cartTotal = cart?.total || 0;
  const paymentTotal = paymentAmountCents / 100;
  const difference = Math.abs(paymentTotal - cartTotal);

  // Allow a small tolerance (1 cent) for rounding
  const isValid = difference < 0.02;

  return { isValid, cartTotal, paymentTotal, difference };
};

/**
 * Builds product information from cart items to pass to Stripe.
 * This data is included in the PaymentIntent metadata for:
 * - Better transaction tracking in Stripe Dashboard
 * - Improved receipt generation with product details
 * - Easier dispute handling with product context
 * - Enhanced analytics and reporting
 */
const ExpressCheckout = () => {
  const {
    toast
  } = useToast();
  const navigate = useNavigate();
  const {
    cart,
    isLoading,
    updateItemQuantity,
    removeItem,
    clearCart,
    setCart
  } = useCart();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCartUpdating, setIsCartUpdating] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentSessionInitialized, setPaymentSessionInitialized] = useState(false);

  // Store pending clientSecret from Express Checkout to apply after callback completes
  const pendingClientSecretRef = useRef<string | null>(null);
  const [selectedPaymentProvider, setSelectedPaymentProvider] = useState<string>('pp_stripe_stripe');
  const [pageLoadId] = useState(() => Date.now()); // Unique ID for each page load
  const [isRecoveringOrder, setIsRecoveringOrder] = useState(false);
  // Shown the moment Stripe confirms payment, while we finalize the order.
  // Gives the customer immediate "payment went through" feedback instead of a
  // frozen button during cart completion.
  const [isFinalizingOrder, setIsFinalizingOrder] = useState(false);
  const [isShippingAddressComplete, setIsShippingAddressComplete] = useState(false);
  const [restrictedItems, setRestrictedItems] = useState<Array<{ id: string; title: string }>>([]);
  const [emailInput, setEmailInput] = useState(''); // Local state for email input
  const [emailError, setEmailError] = useState<string | null>(null);
  const emailDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const lastSyncedTotalRef = React.useRef<number | null>(null);
  const recoveryAttemptedRef = useRef(false);
  const paymentRefreshDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize email input from cart when cart loads
  useEffect(() => {
    if (cart?.email && !emailInput) {
      setEmailInput(cart.email);
    }
  }, [cart?.email]);

  // Debounced email update handler
  const handleEmailChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmailInput(value);

    // Clear any pending debounce
    if (emailDebounceRef.current) {
      clearTimeout(emailDebounceRef.current);
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (value && !emailRegex.test(value)) {
      setEmailError('Please enter a valid email address');
      return;
    } else {
      setEmailError(null);
    }

    // Debounce the API call - only sync valid emails after 500ms of no typing
    if (value && emailRegex.test(value) && cart?.id) {
      emailDebounceRef.current = setTimeout(async () => {
        try {
          await updateCartEmail(cart.id, value);
          const updatedCart = await retrieveCart(cart.id);
          if (updatedCart) setCart(updatedCart as any);
          console.log('✅ Email synced to cart:', value);
        } catch (error) {
          console.error('Failed to update email:', error);
          setEmailError('Failed to save email. Please try again.');
        }
      }, 500);
    }
  }, [cart?.id, setCart]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (emailDebounceRef.current) {
        clearTimeout(emailDebounceRef.current);
      }
      if (paymentRefreshDebounceRef.current) {
        clearTimeout(paymentRefreshDebounceRef.current);
      }
    };
  }, []);

  // CRITICAL: Check for pending order recovery on page load
  // This handles cases where payment succeeded but order creation failed
  // (e.g., network issues, browser closure, mobile app suspension)
  useEffect(() => {
    const checkOrderRecovery = async () => {
      // Only attempt recovery once per page load
      if (recoveryAttemptedRef.current) return;
      recoveryAttemptedRef.current = true;

      const recoveryData = getOrderRecoveryData();
      if (!recoveryData) return;

      console.log('🔍 Found pending order recovery data on page load');
      console.log('   Cart ID:', recoveryData.cartId);
      console.log('   Payment Intent:', recoveryData.paymentIntentId?.substring(0, 20) + '...');
      console.log('   Age:', Math.round((Date.now() - recoveryData.timestamp) / 60000), 'minutes');

      setIsRecoveringOrder(true);
      toast({
        title: "Recovering your order...",
        description: "We found a pending order. Please wait while we complete it.",
      });

      try {
        const result = await attemptOrderRecovery();

        if (result.recovered && result.orderId) {
          console.log('✅ Order recovered successfully:', result.orderId);
          clearCart();
          toast({
            title: "Order recovered successfully!",
            description: `Your order ${result.orderId} has been confirmed.`,
          });
          navigate(`/checkout-success?order_id=${result.orderId}`);
        } else if (result.error) {
          console.error('❌ Order recovery failed:', result.error);

          // If max attempts reached, show support message
          if (result.recoveryData && result.recoveryData.attempts >= 5) {
            toast({
              variant: "destructive",
              title: "Order recovery failed",
              description: `Please contact support with Payment ID: ${result.recoveryData.paymentIntentId}`,
            });
          } else {
            toast({
              variant: "destructive",
              title: "Order recovery failed",
              description: "We'll try again. If this persists, please contact support.",
            });
          }
        }
      } catch (error: any) {
        console.error('❌ Order recovery error:', error);
        toast({
          variant: "destructive",
          title: "Order recovery error",
          description: error.message || "Please contact support if you were charged.",
        });
      } finally {
        setIsRecoveringOrder(false);
      }
    };

    checkOrderRecovery();
  }, [toast, navigate, clearCart]);

  // Check stock status directly from cart item variant data
  // Per Medusa v2 docs: variant is in stock if manage_inventory === false OR inventory_quantity > 0
  // https://docs.medusajs.com/resources/storefront-development/products/inventory
  const outOfStockItems = useMemo(() => {
    const cartItems = cart?.items || [];
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
  }, [cart?.items]);

  const hasOutOfStockItems = outOfStockItems.size > 0;

  // Calculate order summary from real cart
  // NOTE: In Medusa v2, cart.subtotal = item_subtotal + shipping_subtotal
  // For display purposes, we want to show items separately from shipping
  // MEMOIZED: Prevents re-creation on every render which causes Express Checkout to flicker
  const orderSummary = useMemo(() => ({
    subtotal: cart?.item_subtotal || 0, // Use item_subtotal (items only, no shipping)
    shipping: cart?.shipping_total || 0,
    tax: cart?.tax_total || 0,
    discount: cart?.discount_total || 0,
    total: cart?.total || 0
  }), [cart?.item_subtotal, cart?.shipping_total, cart?.tax_total, cart?.discount_total, cart?.total]);

  // Debug: Log cart totals and address to diagnose tax calculation
  React.useEffect(() => {
    if (cart) {
      console.log('🛒 Cart Debug:', {
        id: cart.id,
        subtotal: cart.subtotal,
        item_subtotal: cart.item_subtotal,
        shipping_total: cart.shipping_total,
        tax_total: cart.tax_total,
        discount_total: cart.discount_total,
        total: cart.total,
        shipping_address: cart.shipping_address ? {
          province: cart.shipping_address.province,
          city: cart.shipping_address.city,
          postal_code: cart.shipping_address.postal_code,
        } : null,
        billing_address: cart.billing_address ? {
          province: cart.billing_address.province,
          city: cart.billing_address.city,
        } : null,
        items: cart.items?.map((item: any) => ({
          title: item.title,
          quantity: item.quantity,
          unit_price: item.unit_price,
          subtotal: item.subtotal,
          total: item.total,
        }))
      });
    }
  }, [cart?.id, cart?.subtotal, cart?.shipping_total, cart?.tax_total]);

  // Visual-only FREESHIPPING50 display when cart item subtotal exceeds $50
  // This is a UI-only feature - shipping is already free, so we just display the code for marketing purposes
  // NOTE: We check item_subtotal (products only) not subtotal (which includes shipping in Medusa v2)
  const FREESHIPPING_CODE = "FREESHIPPING50";
  const FREESHIPPING_MINIMUM = 50;

  const showFreeShippingBadge = React.useMemo(() => {
    if (!cart?.item_subtotal) return false;
    return cart.item_subtotal > FREESHIPPING_MINIMUM;
  }, [cart?.item_subtotal]);

  // Show toast notification when free shipping is "applied" (visual only)
  const [freeShippingToastShown, setFreeShippingToastShown] = useState(false);

  useEffect(() => {
    if (showFreeShippingBadge && !freeShippingToastShown) {
      setFreeShippingToastShown(true);
      console.log(`🎟️ Free shipping badge displayed - cart item subtotal: $${cart?.item_subtotal?.toFixed(2)}`);
      toast({
        title: "Free Shipping Applied! 🎉",
        description: "Your order qualifies for free shipping with code FREESHIPPING50.",
      });
    }
  }, [showFreeShippingBadge, freeShippingToastShown, cart?.item_subtotal, toast]);

  // Store initial shipping rates for Express Checkout Element
  const [initialShippingRates, setInitialShippingRates] = useState<Array<{
    id: string;
    displayName: string;
    amount: number;
    deliveryEstimate?: {
      minimum?: { unit: 'business_day' | 'day' | 'hour' | 'month' | 'week'; value: number };
      maximum?: { unit: 'business_day' | 'day' | 'hour' | 'month' | 'week'; value: number };
    };
  }>>([]);

  /**
   * Recreate cart with fresh PaymentIntent when terminal state is detected
   * This preserves the cart items but creates a completely new cart with fresh payment session
   */
  const recreateCartWithFreshPaymentIntent = React.useCallback(async (oldCart: any) => {
    try {
      console.log("🔄 Recreating cart with fresh PaymentIntent...");
      console.log("Old cart ID:", oldCart.id);

      // Save the current cart items
      const items = oldCart.items || [];
      console.log("Saving cart items:", items.length);

      // Prevent infinite reload loop with empty carts
      if (items.length === 0) {
        console.warn("⚠️ Cart is empty, cannot recreate. Redirecting to homepage...");
        localStorage.removeItem("_medusa_cart_id");
        window.location.href = '/';
        return null;
      }

      // Check for reload loop prevention - only allow one recreation attempt per session
      const lastRecreateTime = sessionStorage.getItem('_cart_recreate_time');
      const now = Date.now();
      if (lastRecreateTime && (now - parseInt(lastRecreateTime)) < 10000) {
        console.error("❌ Cart recreation attempted too recently - preventing infinite loop");
        toast({
          variant: "destructive",
          title: "Payment Error",
          description: "There was a problem with the payment system. Please try again later.",
        });
        window.location.href = '/';
        return null;
      }
      sessionStorage.setItem('_cart_recreate_time', now.toString());

      // Clear the old cart ID from storage
      localStorage.removeItem("_medusa_cart_id");

      // Create a fresh cart
      const newCart = await createCart(oldCart.region_id);
      console.log("✅ New cart created:", newCart.id);

      // Add all items back to the new cart
      for (const item of items) {
        console.log(`Adding item: ${item.variant_id} (qty: ${item.quantity})`);
        await addToCart(item.variant_id, item.quantity);
      }

      console.log("✅ All items added to new cart");

      // Reload the page to initialize with the fresh cart
      window.location.reload();

      return newCart;
    } catch (error: any) {
      console.error("❌ Failed to recreate cart:", error);
      throw error;
    }
  }, []);

  /**
   * Transform Medusa shipping options to Stripe Express Checkout format
   * Includes validation to ensure shipping rates always have valid numeric amounts
   */
  const transformShippingOptionsForStripe = (shippingOptions: any[]) => {
    return shippingOptions.map((option: any) => {
      // Extract price, ensuring it's a valid number
      const price = option.calculated_price ?? option.amount ?? 0;
      const priceNumber = typeof price === 'number' && !isNaN(price) ? price : 0;

      // Convert to cents, ensuring result is valid
      const amountInCents = Math.round(priceNumber * 100);
      const validAmount = !isNaN(amountInCents) && isFinite(amountInCents) ? amountInCents : 0;

      return {
        id: option.id || 'default-shipping',
        displayName: option.name || 'Shipping',
        amount: validAmount,
        deliveryEstimate: {
          minimum: { unit: 'business_day' as const, value: 3 },
          maximum: { unit: 'business_day' as const, value: 7 },
        },
      };
    });
  };

  /**
   * Auto-select the appropriate shipping method for the cart
   * This function prioritizes the "Default" shipping option which matches
   * the default shipping profile (sp_01K1SNCP660JVFS7Y4JPWZ6X3J) required by most products
   */
  const autoSelectShippingMethod = React.useCallback(async (cartId: string) => {
    try {
      console.log("🚚 Auto-selecting shipping method for cart:", cartId);

      // Get available shipping options for the cart
      const shippingOptions = await listCartShippingOptions(cartId);
      console.log("📦 Available shipping options:", shippingOptions.length);
      shippingOptions.forEach((opt: any) => {
        console.log(`  - ${opt.name} (ID: ${opt.id}, Profile: ${opt.shipping_profile_id})`);
      });

      if (shippingOptions && shippingOptions.length > 0) {
        // Check if cart already has a shipping method
        const currentCart = await retrieveCart(cartId);
        const hasShippingMethod = (currentCart as any)?.shipping_methods && (currentCart as any).shipping_methods.length > 0;

        if (hasShippingMethod) {
          console.log("✅ Shipping method already selected:", (currentCart as any).shipping_methods[0]);
          return;
        }

        console.log("⚠️ No shipping method selected, auto-selecting now...");

        // The "Manual Shipping" profile ID used by ALL VNSH products
        // This is the correct profile that products are configured to use in the database
        const manualShippingProfileId = 'sp_01K1Q2JK6MZR55HVS2S05F3ZYG';

        // Priority order for shipping method selection:
        // 1. Shipping option with the "Manual Shipping" profile ID (matches product requirements)
        // 2. Shipping option named exactly "Manual Shipping"
        // 3. Shipping option containing "manual" in name
        // 4. Shipping option named exactly "Default"
        // 5. Shipping option containing "default" in name
        // 6. Shipping option containing "standard" in name
        // 7. First available option
        const preferredShipping = shippingOptions.find((opt: any) =>
          opt.shipping_profile_id === manualShippingProfileId
        ) || shippingOptions.find((opt: any) =>
          opt.name.toLowerCase() === 'manual shipping'
        ) || shippingOptions.find((opt: any) =>
          opt.name.toLowerCase().includes('manual')
        ) || shippingOptions.find((opt: any) =>
          opt.name.toLowerCase() === 'default'
        ) || shippingOptions.find((opt: any) =>
          opt.name.toLowerCase().includes('default')
        ) || shippingOptions.find((opt: any) =>
          opt.name.toLowerCase().includes('standard')
        ) || shippingOptions[0];

        console.log("🎯 Selected shipping option:");
        console.log(`  Name: ${preferredShipping.name}`);
        console.log(`  ID: ${preferredShipping.id}`);
        console.log(`  Shipping Profile ID: ${preferredShipping.shipping_profile_id}`);
        console.log(`  Price: $${(preferredShipping.amount || 0) / 100}`);

        await addShippingMethod(cartId, preferredShipping.id);
        console.log("✅ Shipping method added to cart successfully!");
      } else {
        console.warn("⚠️ No shipping options available for this cart");
      }
      } catch (error: any) {
        console.error("❌ Failed to auto-select shipping method:", error);
        throw error;
      }
    }, []);

  const updatePaymentIntentAmount = React.useCallback(
    async (cartId: string, paymentIntentId: string) => {
      const MAX_ATTEMPTS = 2;
      let lastError: Error | null = null;

      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        const updateResponse = await fetch('/api/store/payment-intent/update-amount', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cartId,
            paymentIntentId,
          }),
        });

        const responseBody = await updateResponse.json().catch(() => null);

        if (updateResponse.ok) {
          return responseBody;
        }

        const errorMessage =
          (responseBody && (responseBody.error || responseBody.message)) ||
          updateResponse.statusText ||
          'Failed to update PaymentIntent';

        lastError = new Error(errorMessage);

        if (attempt < MAX_ATTEMPTS) {
          console.warn(
            `🔁 Retrying PaymentIntent amount update (attempt ${attempt + 1}/${MAX_ATTEMPTS})`
          );
          await new Promise((resolve) => setTimeout(resolve, 300));
        }
      }

      throw lastError || new Error('Failed to update PaymentIntent amount after retries');
    },
    []
  );

  // Initialize payment session when cart is loaded
  // This runs on every page load to ensure fresh PaymentIntent
  React.useEffect(() => {
    const initializePaymentSession = async () => {
      if (!cart?.id || !cart?.region_id) {
        return;
      }

      // Skip if already initialized for this specific page load
      if (paymentSessionInitialized) {
        return;
      }

      // Check if cart is already completed
      if ((cart as any).completed_at) {
        console.warn("⚠️ Cart is already completed, skipping payment session initialization");
        toast({
          title: "Cart Already Completed",
          description: "This cart has already been completed. Please create a new cart.",
          variant: "destructive",
        });
        return;
      }

      try {
        console.log("🔄 Initializing fresh payment session on page load...");
        console.log("Page Load ID:", pageLoadId);

	        // Step 1: Check if payment sessions already exist and detect terminal states
	        // NOTE: Always work with the latest server cart object in this initializer.
	        // Using a stale in-memory `cart` object here can create a PaymentIntent for the wrong totals,
	        // which then immediately triggers a refresh loop (and can temporarily clear clientSecret).
	        let currentCart = await retrieveCart(cart.id) as any;
	        const existingSessions = currentCart.payment_collection?.payment_sessions || [];

        console.log("Existing payment sessions:", existingSessions.length);

        // Check if any existing session has a terminal PaymentIntent
        let hasTerminalPaymentIntent = false;
        if (existingSessions.length > 0) {
          existingSessions.forEach((session: any) => {
            console.log(`Session ${session.provider_id}:`, {
              status: session.status,
              data: session.data
            });

            // Check if this is a Stripe session with terminal PaymentIntent
            if (session.provider_id === 'pp_stripe_stripe' && session.data) {
              const piStatus = session.data.status;
              if (piStatus === 'succeeded' || piStatus === 'canceled') {
                console.warn(`⚠️ Found terminal PaymentIntent with status: ${piStatus}`);
                hasTerminalPaymentIntent = true;
              }
            }
          });
        }

        // Step 1.5: ALWAYS fetch and pre-select shipping method for Express Checkout
        // This ensures the initial PaymentIntent includes shipping cost
        // and shipping options are available in Apple Pay/Google Pay sheet
        try {
          console.log("🚚 Fetching shipping options for Express Checkout...");

          // Check if cart already has a shipping method to avoid unnecessary work
          const hasShippingMethod = currentCart.shipping_methods && currentCart.shipping_methods.length > 0;

          if (!hasShippingMethod) {
            // Fetch available shipping options
            const shippingOptions = await listCartShippingOptions(cart.id);
            console.log(`📦 Found ${shippingOptions.length} shipping options`);

            if (shippingOptions.length > 0) {
              // Transform to Stripe format and store for Express Checkout Element
              const stripeShippingRates = transformShippingOptionsForStripe(shippingOptions);
              setInitialShippingRates(stripeShippingRates);
              console.log("✅ Initial shipping rates set for Express Checkout:", stripeShippingRates);

              // Auto-select the default shipping method in Medusa
              console.log("🚚 Auto-selecting default shipping method...");
	              await autoSelectShippingMethod(cart.id);
	              // Refresh cart so totals + shipping_methods are up-to-date before creating payment session
	              currentCart = await retrieveCart(cart.id) as any;
              console.log("✅ Shipping method pre-selected");
            } else {
              console.warn("⚠️ No shipping options available");
            }
          } else {
            console.log("✅ Shipping method already selected, fetching options for Express Checkout...");
            // Still fetch and transform shipping options for the Express Checkout Element
            const shippingOptions = await listCartShippingOptions(cart.id);
            if (shippingOptions.length > 0) {
              const stripeShippingRates = transformShippingOptionsForStripe(shippingOptions);
              setInitialShippingRates(stripeShippingRates);
              console.log("✅ Initial shipping rates set for Express Checkout:", stripeShippingRates);
            }
          }
        } catch (shippingError) {
          console.warn("⚠️ Failed to fetch/pre-select shipping:", shippingError);
          // Continue anyway - shipping will be selected when user enters address
        }

        // Step 2: Get available payment providers for the region
        const { payment_providers } = await sdk.store.payment.listPaymentProviders({
	          region_id: currentCart.region_id,
        });

        console.log("Available payment providers:", payment_providers.map((p: any) => p.id));

        // Step 3: Select Stripe provider (or fallback)
        const stripeProvider = payment_providers.find((p: any) =>
          p.id === 'pp_stripe_stripe' && p.is_enabled
        );

        let providerId = 'pp_system_default';
        if (stripeProvider) {
          providerId = 'pp_stripe_stripe';
          console.log("✅ Stripe provider found and will be used");
        } else {
          console.log("⚠️ Stripe provider not available, using fallback:", providerId);
        }

        setSelectedPaymentProvider(providerId);

        // Step 4: Handle payment session creation based on terminal state
        if (hasTerminalPaymentIntent) {
          // If we have a terminal PaymentIntent, automatically recreate the cart
          console.warn("⚠️ Terminal PaymentIntent detected - recreating cart with fresh payment session");
          await recreateCartWithFreshPaymentIntent(currentCart);
          return; // Page will reload with fresh cart
        }

        // Always create a fresh payment session on page load to avoid stale PaymentIntents
        console.log("Creating fresh payment session (replacing any existing sessions)...");

        try {
          await sdk.store.payment.initiatePaymentSession(currentCart as any, {
            provider_id: providerId,
          });
          console.log("✅ Fresh payment session created successfully");
        } catch (sessionError: any) {
          console.error("❌ Failed to create payment session:", sessionError);

          // If creation fails with 500 error, it's likely due to terminal PaymentIntent
          // Medusa can't delete terminal sessions, so we need to recreate the cart
          if (sessionError.status === 500 || sessionError.message?.includes("terminal") || sessionError.message?.includes("succeeded") || sessionError.message?.includes("canceled")) {
            console.warn("⚠️ Payment session creation failed (likely terminal PaymentIntent) - recreating cart");
            await recreateCartWithFreshPaymentIntent(currentCart);
            return; // Page will reload with fresh cart
          }

          throw sessionError;
        }

        // Step 5: Extract client secret for Stripe
        if (providerId === 'pp_stripe_stripe') {
          // Refresh cart to get updated payment collection
          const updatedCart = await retrieveCart(cart.id) as any;

          const stripeSession = updatedCart?.payment_collection?.payment_sessions?.find(
            (s: any) => s.provider_id === 'pp_stripe_stripe'
          );

          if (stripeSession?.data?.client_secret) {
            // Verify the PaymentIntent is not in terminal state
            const piStatus = stripeSession.data.status;
            if (piStatus === 'succeeded' || piStatus === 'canceled') {
              // Automatically recreate cart instead of showing error
              console.warn(`⚠️ PaymentIntent in terminal state (${piStatus}) - recreating cart`);
              await recreateCartWithFreshPaymentIntent(updatedCart);
              return; // Page will reload with fresh cart
            }

            const clientSecretValue = stripeSession.data.client_secret as string;
            console.log("✅ Stripe client secret obtained:", clientSecretValue.substring(0, 20) + "...");
            console.log("PaymentIntent status:", piStatus);
            setClientSecret(clientSecretValue);
	            // Keep local cart state in sync with the server cart used to create the payment session.
	            // This prevents the cart-total watcher from immediately triggering a refresh on first load.
	            setCart(updatedCart as any);
	            lastSyncedTotalRef.current = updatedCart?.total ?? currentCart?.total ?? null;
          } else {
            console.warn("⚠️ No client secret found in payment session");
            throw new Error("Failed to obtain payment client secret. Please refresh the page.");
          }
        }

        setPaymentSessionInitialized(true);
      } catch (error: any) {
        console.error("❌ Payment session initialization error:", error);

        // Check if this is a terminal state error
        const isTerminalError = error.message?.includes('terminal state') ||
                                error.message?.includes('expired') ||
                                error.message?.includes('succeeded') ||
                                error.message?.includes('canceled');

        toast({
          title: "Payment Initialization Error",
          description: error.message || "Failed to initialize payment. Please refresh the page.",
          variant: "destructive",
        });

        // If terminal error, clear cart and redirect
        if (isTerminalError) {
          clearCart();
          navigate('/');
        }
      }
    };

    initializePaymentSession();
  }, [cart?.id, cart?.region_id, paymentSessionInitialized, toast]);

  // Keep Stripe PaymentIntent in sync when cart totals change (quantity/discount updates)
  const refreshStripePaymentIntent = React.useCallback(async (cartId?: string, skipClientSecretUpdate = false) => {
    const targetCartId = cartId || cart?.id;
    if (!targetCartId || !selectedPaymentProvider) {
      return null;
    }

    try {
      // CRITICAL: Use retrieveCart() instead of sdk.store.cart.retrieve() to get tax_total and other computed fields
      const latestCart = await retrieveCart(targetCartId);
      if (!latestCart) {
        console.error('Failed to retrieve cart for PaymentIntent refresh');
        return null;
      }

      await sdk.store.payment.initiatePaymentSession(latestCart as any, {
        provider_id: selectedPaymentProvider,
      });

      // CRITICAL: Use retrieveCart() to get the refreshed cart with all computed fields including tax_total
      const refreshedCart = await retrieveCart(targetCartId);
      if (!refreshedCart) {
        console.error('Failed to retrieve refreshed cart after PaymentIntent update');
        return null;
      }

      const stripeSession = refreshedCart.payment_collection?.payment_sessions?.find(
        (s: any) => s.provider_id === 'pp_stripe_stripe'
      );

      // CRITICAL: Handle clientSecret updates during Express Checkout callbacks
      // We need to update the PaymentIntent but avoid remounting Elements during the callback
      if (stripeSession?.data?.client_secret) {
        const newClientSecret = stripeSession.data.client_secret as string;
        const paymentIntentId = newClientSecret.split('_secret_')[0];
        const currentPaymentIntentId = clientSecret?.split('_secret_')[0];

        if (!skipClientSecretUpdate) {
          // Normal flow: update immediately
          if (newClientSecret !== clientSecret) {
            if (paymentIntentId !== currentPaymentIntentId) {
              console.log(`🔄 PaymentIntent changed: ${currentPaymentIntentId} → ${paymentIntentId}`);
            }
            setClientSecret(newClientSecret);
          }
        } else {
          // Express Checkout flow: check if PaymentIntent changed
          if (paymentIntentId !== currentPaymentIntentId) {
            console.warn(`⚠️ PaymentIntent ID changed during Express Checkout callback: ${currentPaymentIntentId} → ${paymentIntentId}`);
            console.warn('Storing new clientSecret to apply after callback completes.');
            // Store the new clientSecret to apply after callback completes
            pendingClientSecretRef.current = newClientSecret;
          } else {
            console.log(`✅ PaymentIntent amount updated in-place (ID: ${paymentIntentId})`);
          }
        }
      }

      // NOTE: The backend can occasionally return a cart object whose `total` is momentarily stale
      // right after re-initializing the payment session. We want our sync ref to reflect the
      // *intended* cart total we just retrieved, otherwise we can trigger repeat refresh loops.
      const intendedTotal = latestCart?.total;
      if (typeof intendedTotal === "number") {
        lastSyncedTotalRef.current = intendedTotal;
      }
      return refreshedCart;
    } catch (error: any) {
      console.error("Failed to refresh Stripe payment session after cart change:", error);

	      // Check if this is a *Medusa payment session* not-found error (session deleted/expired).
	      // Be strict here: we don't want random 404s (or other network noise) to disturb Stripe UI.
	      const status = error?.status ?? error?.response?.status;
	      const message =
	        error?.response?.data?.message ??
	        error?.response?.data?.error ??
	        error?.message ??
	        "";

	      const isNotFoundError =
	        status === 404 &&
	        /PaymentSession/i.test(String(message)) &&
	        /not found/i.test(String(message));

      if (isNotFoundError) {
        // Payment session expired/deleted - need to reinitialize
        console.log("🔄 Payment session not found, reinitializing...");
        setPaymentSessionInitialized(false);
	        // IMPORTANT: Do NOT clear clientSecret here.
	        // Clearing it unmounts Stripe Elements, causing a visible flicker.
	        // We'll keep rendering the existing Elements while the init effect creates a fresh session.
        // The useEffect will pick this up and reinitialize
        return null;
      }

      toast({
        variant: "destructive",
        title: "Payment session update failed",
        description: "We couldn't refresh your payment details. Please try again.",
      });
      return null;
    }
  }, [cart?.id, selectedPaymentProvider, toast]);

  // Track if we're currently refreshing to prevent duplicate refreshes
  const isRefreshingPaymentRef = React.useRef(false);

  // Track if Express Checkout is updating to prevent central watcher interference
  const isExpressCheckoutUpdatingRef = React.useRef(false);

  React.useEffect(() => {
    if (!cart?.id || !paymentSessionInitialized) {
      return;
    }

    // Skip if Express Checkout is handling the update
    if (isExpressCheckoutUpdatingRef.current) {
      console.log('⏭️ Skipping central refresh - Express Checkout handling update');
      return;
    }

    // Don't need clientSecret to trigger refresh - we just need it to exist for payment to work
    // Removing clientSecret from dependencies prevents infinite loop when refresh updates clientSecret

    if (typeof cart.total !== "number") {
      return;
    }

    if (lastSyncedTotalRef.current === null) {
      lastSyncedTotalRef.current = cart.total;
      return;
    }

    // OPTIMIZATION 1: Threshold check - only refresh if total changed by more than $0.05
    // This prevents unnecessary refreshes for tiny rounding differences
    const totalDifference = Math.abs(cart.total - lastSyncedTotalRef.current);
    const REFRESH_THRESHOLD = 0.05; // $0.05 minimum difference

    if (totalDifference < REFRESH_THRESHOLD) {
      console.log(`⏭️ Skipping PaymentIntent refresh: total difference ($${totalDifference.toFixed(2)}) below threshold ($${REFRESH_THRESHOLD.toFixed(2)})`);
      return;
    }

    // Prevent duplicate refresh calls
    if (isRefreshingPaymentRef.current) {
      console.log(`⏳ Already refreshing PaymentIntent, skipping...`);
      return;
    }

    console.log(`🔄 Cart total changed: $${lastSyncedTotalRef.current?.toFixed(2)} → $${cart.total.toFixed(2)} (diff: $${totalDifference.toFixed(2)})`);

    // OPTIMIZATION 2: Debounce - wait 300ms before refreshing to batch rapid changes
    // This prevents multiple refreshes when quantity is changed rapidly or multiple discounts are applied
    if (paymentRefreshDebounceRef.current) {
      clearTimeout(paymentRefreshDebounceRef.current);
    }

    let isCurrent = true;
    const targetTotal = cart.total; // Capture the target total we're syncing to

    paymentRefreshDebounceRef.current = setTimeout(async () => {
      if (!isCurrent) return;
      if (isRefreshingPaymentRef.current) return;

      isRefreshingPaymentRef.current = true;
      setIsCartUpdating(true);

      try {
        console.log(`💳 Refreshing PaymentIntent with new total: $${targetTotal.toFixed(2)}`);
        const refreshedCart = await refreshStripePaymentIntent(cart.id);

	        // Update lastSyncedTotalRef to the target total we intended to sync to.
	        // This prevents repeat refresh loops when the backend cart response is momentarily stale.
	        if (isCurrent && refreshedCart) {
	          lastSyncedTotalRef.current = targetTotal;
	          console.log(
	            `✅ PaymentIntent refresh completed (synced target $${targetTotal.toFixed(2)}; cart returned $${refreshedCart.total?.toFixed?.(2) ?? "n/a"})`
	          );
	        }
      } finally {
        isRefreshingPaymentRef.current = false;
        if (isCurrent) {
          setIsCartUpdating(false);
        }
      }
    }, 300); // 300ms debounce

    return () => {
      isCurrent = false;
      if (paymentRefreshDebounceRef.current) {
        clearTimeout(paymentRefreshDebounceRef.current);
      }
    };
  }, [cart?.id, cart?.total, paymentSessionInitialized, refreshStripePaymentIntent]);

  const handleQuantityChange = async (lineId: string, nextQuantity: number) => {
    if (!cart?.id) {
      toast({
        variant: "destructive",
        title: "Cart not found",
        description: "Please add an item to your cart before updating quantities."
      });
      return;
    }

    setIsCartUpdating(true);

    try {
      if (nextQuantity < 1) {
        await removeItem(lineId);
      } else {
        await updateItemQuantity(lineId, nextQuantity);
      }
    } catch (error: any) {
      console.error("Failed to update item quantity:", error);
      toast({
        variant: "destructive",
        title: "Update failed",
        description: "We couldn't update your cart. Please try again."
      });
    } finally {
      setIsCartUpdating(false);
    }
  };

  const isInitialLoading = isLoading && !cart;
  const isCartBusy = isCartUpdating || (isLoading && !!cart);

  // Payment handlers
  // MEMOIZED: Prevents re-creation on every render which causes Express Checkout to flicker
  const handlePaymentSuccess = useCallback(async (paymentIntent?: any) => {
    try {
      setIsProcessing(true);
      setIsFinalizingOrder(true);
      console.log("✅ Payment succeeded, now syncing customer data and completing order...");
      console.log("PaymentIntent data:", paymentIntent);
      console.log("Express checkout data:", paymentIntent?.expressCheckoutData);

      if (!cart?.id) {
        throw new Error("Cart ID not found");
      }

      // Get express checkout data if available (from Apple Pay/Google Pay)
      const expressData = paymentIntent?.expressCheckoutData;

      // ROOT CAUSE GUARD: For the standard card flow, email, shipping address,
      // shipping method, and tax are ALL synced BEFORE payment (the payment form
      // only renders once isShippingAddressComplete + a valid email are present).
      // Re-syncing them here — AFTER the PaymentIntent has succeeded — is both
      // redundant and the trigger for "Could not delete all payment sessions"
      // (Medusa can't reinitialize a terminal payment session). When this is a
      // card payment (no expressCheckoutData) and the cart already has a usable
      // shipping address, skip straight to completion and avoid the error window.
      const existingShipping = cart?.shipping_address as any;
      const cartHasUsableShippingAddress = Boolean(
        existingShipping?.address_1 &&
        existingShipping.address_1.trim() !== "" &&
        !existingShipping.address_1.startsWith("ZIP ") &&
        existingShipping.address_1 !== "TBD" &&
        !existingShipping.address_1.includes("pending")
      );
      const isCardFlow = !expressData;

      if (isCardFlow && cartHasUsableShippingAddress) {
        console.log("💳 Card flow with address already synced pre-payment — skipping post-payment cart mutations, completing order directly.");

        try {
          const result = await completeCartWithRetry(cart.id, 3, 1000);

          if ('type' in result && result.type === 'order') {
            console.log("✅ Order created successfully:", result.order.id);
            clearOrderRecoveryData();
            clearCart();
            toast({
              title: "Order placed successfully!",
              description: `Order ID: ${result.order.id}`
            });
            navigate(`/checkout-success?order_id=${result.order.id}`);
            return;
          }

          throw new Error("Order creation failed - no order ID returned");
        } catch (orderError: any) {
          // "already completed" means the order actually exists — treat as success.
          if (orderError.message?.includes('already completed')) {
            console.log("✅ Cart was already completed - order exists");
            clearOrderRecoveryData();
            clearCart();
            toast({
              title: "Order placed successfully!",
              description: "Your order has been confirmed."
            });
            navigate('/checkout-success');
            return;
          }
          throw orderError;
        }
      }

      // Step 1: Sync customer email from PaymentIntent or express checkout
      const email = paymentIntent?.receipt_email ||
                    paymentIntent?.billing_details?.email ||
                    expressData?.billingDetails?.email;
      if (email) {
        console.log("📧 Syncing customer email:", email);
        try {
          await updateCart(cart.id, { email });
          console.log("✅ Email synced successfully");
        } catch (emailError: any) {
          console.error("Failed to sync email:", emailError);
          // Don't block order completion for email sync failure
        }
      }

      // Step 2: Sync shipping address from PaymentIntent or express checkout data
      // This triggers Medusa to recalculate taxes based on the new address
      const shippingSource = paymentIntent?.shipping || expressData?.shippingAddress;
      let shippingState: string | undefined;

      if (shippingSource) {
        console.log("📍 Syncing shipping address...");
        try {
          // Handle both PaymentIntent format and express checkout format
          // IMPORTANT: Prefer paymentIntent.shipping if it has a valid line1, otherwise use expressData
          const piShipping = paymentIntent?.shipping;
          const exShipping = expressData?.shippingAddress;

          // Determine which source has the best address data
          const piHasLine1 = !!piShipping?.address?.line1?.trim();
          const exHasLine1 = !!exShipping?.address?.line1?.trim();

          console.log("📍 Address sources:", {
            paymentIntentHasLine1: piHasLine1,
            expressDataHasLine1: exHasLine1,
            piLine1: piShipping?.address?.line1,
            exLine1: exShipping?.address?.line1,
          });

          // Use the source that has a valid street address, preferring paymentIntent
          const usePaymentIntent = piHasLine1 || (!exHasLine1 && piShipping);
          const source = usePaymentIntent ? piShipping : exShipping;

          const selectedShippingName = usePaymentIntent ? piShipping?.name : exShipping?.name;
          const parsedShippingName = parseCustomerName(selectedShippingName);
          const rawShippingAddress = {
            first_name: parsedShippingName?.firstName || 'Customer',
            last_name: parsedShippingName?.lastName || '',
            address_1: (usePaymentIntent ? piShipping?.address?.line1 : exShipping?.address?.line1) || 'Address not provided',
            address_2: (usePaymentIntent ? piShipping?.address?.line2 : exShipping?.address?.line2) || '',
            city: (usePaymentIntent ? piShipping?.address?.city : exShipping?.address?.city) || '',
            state: (usePaymentIntent ? piShipping?.address?.state : exShipping?.address?.state) || '',
            postal_code: (usePaymentIntent ? piShipping?.address?.postal_code : exShipping?.address?.postal_code) || '',
            country_code: ((usePaymentIntent ? piShipping?.address?.country : exShipping?.address?.country) || 'us').toLowerCase(),
            phone: (usePaymentIntent ? piShipping?.phone : exShipping?.phone) || '',
          };

          // Log warning if address_1 is still a placeholder
          if (rawShippingAddress.address_1 === 'Address not provided' ||
              rawShippingAddress.address_1.includes('pending')) {
            console.warn("⚠️ WARNING: Shipping address line 1 is missing or placeholder!", rawShippingAddress);
          }

          // Convert state code to ISO 3166-2 format (e.g., "TX" -> "us-tx")
          // Medusa requires lowercase ISO 3166-2 format for tax region matching
          const stateCode = rawShippingAddress.state?.toUpperCase() || '';
          const province = stateCode
            ? `${rawShippingAddress.country_code}-${stateCode.toLowerCase()}`
            : '';

          const shippingAddress = {
            ...rawShippingAddress,
            province,
          };
          delete (shippingAddress as any).state; // Remove temporary state field

          // Extract state for tax calculation check
          shippingState = stateCode;

          console.log("Syncing shipping address to Medusa:", shippingAddress);
          await updateCart(cart.id, { shipping_address: shippingAddress });
          console.log("✅ Shipping address synced successfully");
        } catch (addressError: any) {
          console.error("Failed to sync shipping address:", addressError);
          // Don't block order completion for address sync failure
        }
      }

      // Step 3: Sync billing address from PaymentIntent or express checkout
      const billingSource = paymentIntent?.billing_details || expressData?.billingDetails;
      if (billingSource) {
        console.log("💳 Syncing billing address...");
        try {
          // Convert state code to ISO 3166-2 format for billing address too
          const billingStateCode = billingSource.address?.state?.toUpperCase() || '';
          const billingCountryCode = billingSource.address?.country?.toLowerCase() || 'us';
          const billingProvince = billingStateCode
            ? `${billingCountryCode}-${billingStateCode.toLowerCase()}`
            : '';

          const parsedBillingName = parseCustomerName(billingSource.name);
          const billingAddress = {
            first_name: parsedBillingName?.firstName || '',
            last_name: parsedBillingName?.lastName || '',
            address_1: billingSource.address?.line1 || '',
            address_2: billingSource.address?.line2 || '',
            city: billingSource.address?.city || '',
            province: billingProvince,
            postal_code: billingSource.address?.postal_code || '',
            country_code: billingCountryCode,
            phone: billingSource.phone || '',
          };

          console.log("Syncing billing address to Medusa:", billingAddress);
          await updateCart(cart.id, { billing_address: billingAddress });
          console.log("✅ Billing address synced successfully");
        } catch (billingError: any) {
          console.error("Failed to sync billing address:", billingError);
          // Don't block order completion for billing sync failure
        }
      }

      // Step 4: Ensure shipping method is selected using the auto-select function
      try {
        await autoSelectShippingMethod(cart.id);
        console.log("✅ Shipping method selection completed");
      } catch (shippingError: any) {
        console.error("Failed to select shipping method:", shippingError);
        throw new Error("Failed to select shipping method: " + shippingError.message);
      }

      // Step 5: Wait for tax recalculation to complete
      // This is critical: Medusa deletes existing tax lines when address is updated
      // and recreates them asynchronously. We need to wait for this to complete.
      console.log("🔄 Waiting for tax recalculation after address update...");
      const { cart: refreshedCart, taxReady } = await waitForTaxRecalculation(
        cart.id,
        shippingState,
        6, // Max retries (increased from 5)
        400 // Delay between retries in ms
      );

      // Step 6: Validate cart total vs payment amount
      const paymentAmountCents = paymentIntent?.amount || 0;
      if (paymentAmountCents > 0 && refreshedCart) {
        const validation = validateCartVsPayment(refreshedCart, paymentAmountCents);

        if (!validation.isValid) {
          // Log critical warning about the discrepancy
          console.error(`🚨 CRITICAL: Cart total mismatch!`);
          console.error(`   Payment charged: $${validation.paymentTotal.toFixed(2)}`);
          console.error(`   Cart total: $${validation.cartTotal.toFixed(2)}`);
          console.error(`   Difference: $${validation.difference.toFixed(2)}`);
          console.error(`   Tax ready: ${taxReady}`);
          console.error(`   Shipping state: ${shippingState || 'unknown'}`);

          // If the discrepancy is significant (likely missing tax), log warning but proceed
          // The order will be created with incorrect totals, but we don't want to
          // fail the order after payment was already captured
          if (validation.difference > 1) {
            console.warn(`⚠️ Proceeding with order despite $${validation.difference.toFixed(2)} discrepancy.`);
            console.warn(`   This order may require manual review for tax adjustment.`);
          }
        } else {
          console.log(`✅ Cart total validated: $${validation.cartTotal.toFixed(2)} matches payment`);
        }
      }


      // Step 6b: Validate shipping address is complete (not placeholder)
      // This is critical for Express Checkout where Apple Pay provides partial address initially
      if (refreshedCart?.shipping_address) {
        const addr = refreshedCart.shipping_address;
        const hasCompleteAddress = addr.address_1 && addr.address_1.trim() !== "" &&
          !addr.address_1.startsWith("ZIP ") && addr.address_1 !== "TBD" &&
          !addr.address_1.toLowerCase().includes('pending') &&
          addr.address_1 !== "Address not provided" &&
          !/\S+@\S+\.\S+/.test(addr.address_1);
        if (!hasCompleteAddress) {
          const errorMsg =
            "Shipping address could not be captured. Please reopen the Express Checkout sheet and confirm your full street address.";
          console.error("🚨 CRITICAL: Shipping address is incomplete!");
          console.error("   address_1:", addr.address_1 || "(empty)");
          console.error("   This should have been synced from paymentIntent.shipping");
          console.warn("⚠️ Aborting order completion until a valid address is captured");
          throw new Error(errorMsg);
        } else {
          console.log("✅ Shipping address validated:", addr.address_1, addr.city, addr.province);
        }
      }

      // Step 7: Complete the order with retry logic
      // CRITICAL: This is the most important step - if this fails, the customer is charged but no order is created
      console.log("✅ Completing order with retry logic...");

      try {
        const result = await completeCartWithRetry(cart.id, 3, 1000);

        if ('type' in result && result.type === 'order') {
          console.log("✅ Order created successfully:", result.order.id);

          // CRITICAL: Clear recovery data AFTER successful order creation
          clearOrderRecoveryData();

          // Clear cart from context and localStorage
          clearCart();

          toast({
            title: "Order placed successfully!",
            description: `Order ID: ${result.order.id}`
          });
          navigate(`/checkout-success?order_id=${result.order.id}`);
        } else {
          throw new Error("Order creation failed - no order ID returned");
        }
      } catch (orderError: any) {
        // Order completion failed after retries
        // Recovery data is still saved, so user can recover on page reload
        console.error("❌ Order completion failed after retries:", orderError);

        // Check if this is a "cart already completed" error - which means order was actually created
        if (orderError.message?.includes('already completed')) {
          console.log("✅ Cart was already completed - order exists");
          clearOrderRecoveryData();
          clearCart();
          toast({
            title: "Order placed successfully!",
            description: "Your order has been confirmed."
          });
          navigate('/checkout-success');
          return;
        }

        throw orderError;
      }
    } catch (error: any) {
      console.error("❌ Order completion failed:", error);

      // Drop the finalizing overlay so the customer can see the error / retry.
      // On the success paths we navigate away (and unmount), so we intentionally
      // leave the overlay up there to avoid a flicker before the redirect.
      setIsFinalizingOrder(false);

      // Show error with recovery information
      toast({
        variant: "destructive",
        title: "Order completion failed",
        description: `${error.message || "There was an error completing your order."} Your payment was processed. Please refresh the page to retry or contact support.`
      });
    } finally {
      setIsProcessing(false);
    }
  }, [cart?.id, toast, clearCart, navigate, autoSelectShippingMethod, setIsProcessing]);

  // MEMOIZED: Prevents re-creation on every render which causes Express Checkout to flicker
  const handlePaymentError = useCallback((error: string) => {
    console.error("Payment error:", error);

    // Check if this is a terminal state error (requires new cart)
    const isTerminalStateError = error.includes('terminal state') ||
                                  error.includes('already succeeded') ||
                                  error.includes('already canceled');

    if (isTerminalStateError) {
      // Terminal state - user needs to create a new cart
      toast({
        variant: "destructive",
        title: "Payment Session Expired",
        description: "This payment session has expired. Redirecting to start a new checkout...",
      });
      // Clear cart and redirect to homepage
      clearCart();
      navigate('/');
    } else {
      // Regular payment error - user can retry with the same PaymentIntent
      toast({
        variant: "destructive",
        title: "Payment Failed",
        description: error + " Please check your payment details and try again."
      });
    }

    // Reset processing state to allow retry
    setIsProcessing(false);
  }, [toast, clearCart, navigate, setIsProcessing]);

  // Handle payment processing state (for async payments like bank debits)
  // MEMOIZED: Prevents re-creation on every render which causes Express Checkout to flicker
  const handlePaymentProcessing = useCallback((paymentIntent?: any) => {
    console.log("⏳ Payment is processing:", paymentIntent?.id);
    toast({
      title: "Payment Processing",
      description: "Your payment is being processed. You'll receive a confirmation email once complete.",
    });
    // Don't navigate away - the order will be completed by webhook or on next page load
    setIsProcessing(false);
  }, [toast, setIsProcessing]);

  const handleExpressCheckoutShippingAddressConfirm = React.useCallback(
    async (shippingAddress: any) => {
      if (!cart?.id) {
        throw new Error("Cart not found");
      }

      const line1 = shippingAddress?.address?.line1?.trim();
      if (!line1) {
        throw new Error("Complete street address is required for shipping");
      }

      const rawState = shippingAddress?.address?.state;
      const normalizedState = normalizeStateCode(rawState);
      if (!normalizedState) {
        throw new Error(`Invalid state: ${rawState || 'missing'}`);
      }

      const countryCode = (shippingAddress?.address?.country || 'US').toLowerCase();
      const province = `${countryCode}-${normalizedState}`;
      const parsedName = parseCustomerName(shippingAddress?.name);
      const firstName = parsedName?.firstName || 'Customer';
      const lastName = parsedName?.lastName || '';

      const medusaAddress = {
        first_name: firstName,
        last_name: lastName,
        address_1: line1,
        address_2: shippingAddress?.address?.line2 || '',
        city: shippingAddress?.address?.city || '',
        province,
        postal_code: shippingAddress?.address?.postal_code || '',
        country_code: countryCode,
        phone: shippingAddress?.phone || '',
      };

      console.log("📍 Persisting Express Checkout shipping address before confirm:", medusaAddress);
      const updatedCart = await updateCart(cart.id, { shipping_address: medusaAddress });
      setCart(updatedCart as any);
    },
    [cart?.id, setCart]
  );

  // Handle shipping address change during Express Checkout (Apple Pay/Google Pay)
  // Flow: Update address → Tax recalculation → Update PaymentIntent amount in-place → Return line items
  // Uses /store/payment-intent/update-amount endpoint to update existing PaymentIntent without changing ID
  const handleExpressCheckoutShippingAddressChange = useCallback(async (address: any) => {
    if (!cart?.id || !clientSecret) return null;

    // Set flag to prevent central watcher interference
    isExpressCheckoutUpdatingRef.current = true;

    const MOBILE_TIMEOUT = 8000; // 8s timeout for Apple Pay
    const startTime = performance.now();

    console.log("🍎 Express Checkout address change (Medusa-only approach):", {
      userAgent: navigator.userAgent.substring(0, 50),
      timestamp: Date.now(),
      address: { city: address.city, state: address.state, postal_code: address.postal_code }
    });

    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Address update timeout')), MOBILE_TIMEOUT)
      );

      const addressUpdatePromise = (async () => {
        // Normalize state code
        const rawState = address.state;
        const normalizedStateCode = normalizeStateCode(rawState);

        if (!normalizedStateCode) {
          console.error(`❌ Failed to normalize state: "${rawState}"`);
          throw new Error(`Invalid state: ${rawState}`);
        }

        const countryCode = address.country?.toLowerCase() || 'us';
        const province = `${countryCode}-${normalizedStateCode}`;

        // Update Medusa cart with shipping address (to keep cart in sync)
        // NOTE: During onShippingAddressChange, Apple Pay/Google Pay only provides partial address
        // (city, state, postal_code) for privacy. Full street address comes after payment confirmation.
        // We use a placeholder to ensure orders never have empty address_1 if completed during this phase.
        const parsedAddressName = parseCustomerName(address.name);
        const shippingAddressForMedusa = {
          first_name: parsedAddressName?.firstName || 'Customer',
          last_name: parsedAddressName?.lastName || '',
          address_1: address.line1 || 'Address pending - Express Checkout',
          address_2: address.line2 || '',
          city: address.city || 'City pending',
          province: province,
          postal_code: address.postal_code || '',
          country_code: countryCode,
          phone: address.phone || '',
        };

        // Update cart with shipping address (triggers tax recalculation in Medusa)
        console.log('🚚 Updating cart address and fetching shipping options...');
        await updateCart(cart.id, { shipping_address: shippingAddressForMedusa });

        // Fetch updated cart with recalculated tax and shipping options in parallel
        const [updatedCart, shippingOptions] = await Promise.all([
          retrieveCart(cart.id),
          listCartShippingOptions(cart.id),
        ]);
        console.log(`📦 Cart updated with tax, ${shippingOptions.length} shipping options fetched`);

        // Extract PaymentIntent ID from clientSecret
        const paymentIntentId = clientSecret.split('_secret_')[0];

        // Update PaymentIntent amount to match new cart total (with tax)
        console.log(`💰 Updating PaymentIntent ${paymentIntentId} amount...`);
        const updateResult = await updatePaymentIntentAmount(cart.id, paymentIntentId);
        console.log(`✅ PaymentIntent updated:`, updateResult);

        // Build line items from UPDATED cart (with tax)
        const lineItems = buildExpressCheckoutLineItems(updatedCart);
        const lineItemsTotal = lineItems.reduce((sum, item) => sum + item.amount, 0);

        console.log(`📊 Line items built:`, lineItems);
        console.log(`📊 Line items total: $${lineItemsTotal/100} (${(performance.now() - startTime).toFixed(0)}ms total)`);
        // Transform shipping options to Stripe format (already fetched in parallel above)
        const shippingRates = transformShippingOptionsForStripe(shippingOptions);
        console.log(`✅ ${shippingRates.length} shipping rates ready`);

        return {
          shippingRates,
          lineItems,
        };
      })();

      return await Promise.race([addressUpdatePromise, timeoutPromise]);

    } catch (error) {
      console.error("❌ Express Checkout address change failed:", error);
      console.error("🚨 Cannot safely calculate tax - returning null to prevent incorrect charge");
      return null;
    } finally {
      isExpressCheckoutUpdatingRef.current = false;

      // Apply pending clientSecret update if backend created a new PaymentIntent
      // We defer this update until after the callback to prevent Elements remount during the callback
      // A small delay ensures Stripe processes the callback response before remounting
      if (pendingClientSecretRef.current) {
        setTimeout(() => {
          console.log('✅ Applying deferred clientSecret update after Express Checkout callback');
          setClientSecret(pendingClientSecretRef.current!);
          pendingClientSecretRef.current = null;
        }, 100); // 100ms delay to ensure callback completes
      }
    }
  }, [cart?.id, clientSecret, setCart]);

  // Handle shipping rate change during Express Checkout (Apple Pay/Google Pay)
  // MEMOIZED: Prevents re-creation on every render which causes Express Checkout to flicker
  const handleExpressCheckoutShippingRateChange = useCallback(async (shippingRateId: string) => {
    if (!cart?.id) return null;

    // Set flag to prevent central watcher interference
    isExpressCheckoutUpdatingRef.current = true;

    const startTime = performance.now();
    console.log('🚚 Express Checkout shipping rate change:', shippingRateId);

    try {
      // Check if this is a fallback rate (not a real Medusa shipping option)
      // Fallback rates use placeholder IDs that Medusa won't recognize
      const isFallbackRate = shippingRateId === 'standard-shipping' || shippingRateId === 'free-shipping';

      if (!isFallbackRate) {
        // Only call addShippingMethod for real Medusa shipping option IDs
        console.log(`📦 Adding shipping method ${shippingRateId} to cart...`);
        await addShippingMethod(cart.id, shippingRateId);
        console.log(`✅ Shipping method added (${(performance.now() - startTime).toFixed(0)}ms)`);
      } else {
        console.log(`⏭️ Skipping addShippingMethod for fallback rate: ${shippingRateId}`);
      }

      // Get the current state (shipping address province) for tax calculation
      const currentCart = await retrieveCart(cart.id);
      const province = String(currentCart?.shipping_address?.province || '');
      const stateCode = province.replace(/^us-/, '').toUpperCase(); // Extract state code from "us-tx"

      // Wait for tax to recalculate (shipping can affect tax in some jurisdictions)
      console.log(`💰 Waiting for tax recalculation after shipping change...`);
      const { cart: cartWithTax, taxReady } = await waitForTaxRecalculation(
        cart.id,
        stateCode
      );

      if (!taxReady) {
        console.warn('⚠️ Tax recalculation not ready, using latest cart state');
      }

      // Extract PaymentIntent ID from clientSecret
      const paymentIntentId = clientSecret!.split('_secret_')[0];

      // Update PaymentIntent amount to match new cart total (with shipping + tax)
      console.log(`💰 Updating PaymentIntent ${paymentIntentId} amount after shipping change...`);
      const updateResult = await updatePaymentIntentAmount(cart.id, paymentIntentId);
      console.log(`✅ PaymentIntent updated:`, updateResult);

      // Update local cart state
      setCart(cartWithTax as any);
      const finalCart = cartWithTax;

      // Build updated lineItems to show in the payment sheet
      const lineItems = buildExpressCheckoutLineItems(finalCart);
      const lineItemsTotal = lineItems.reduce((sum, item) => sum + item.amount, 0);

      console.log(`📊 Updated line items:`, lineItems);
      console.log(`📊 Line items total: $${lineItemsTotal/100} (${(performance.now() - startTime).toFixed(0)}ms total)`);

      // Validate lineItems sum matches PaymentIntent
      // Note: paymentAmount from Medusa is in dollars, lineItemsTotal is in cents
      const paymentAmountDollars = finalCart.payment_collection?.payment_sessions?.[0]?.amount;
      const paymentAmountCents = paymentAmountDollars ? Math.round(paymentAmountDollars * 100) : null;
      if (paymentAmountCents && Math.abs(lineItemsTotal - paymentAmountCents) > 1) {
        console.error(`❌ VALIDATION FAILED: LineItems total (${lineItemsTotal} cents) != PaymentIntent amount (${paymentAmountCents} cents / $${paymentAmountDollars})`);
        throw new Error(`LineItems/PaymentIntent mismatch: ${lineItemsTotal} vs ${paymentAmountCents}`);
      }
      console.log(`✅ Validation passed: LineItems sum (${lineItemsTotal} cents) matches PaymentIntent (${paymentAmountCents} cents)`);

      return { lineItems };

    } catch (error) {
      console.error("❌ Express Checkout shipping rate change failed:", error);
      console.error("🚨 Cannot safely update shipping - preventing payment to avoid charging incorrect amount");

      // FAIL SAFE: Return null to prevent incorrect charges
      return null;
    } finally {
      isExpressCheckoutUpdatingRef.current = false;

      // Apply pending clientSecret update if backend created a new PaymentIntent
      // We defer this update until after the callback to prevent Elements remount during the callback
      // A small delay ensures Stripe processes the callback response before remounting
      if (pendingClientSecretRef.current) {
        setTimeout(() => {
          console.log('✅ Applying deferred clientSecret update after Express Checkout callback');
          setClientSecret(pendingClientSecretRef.current!);
          pendingClientSecretRef.current = null;
        }, 100); // 100ms delay to ensure callback completes
      }
    }
  }, [cart?.id, setCart, refreshStripePaymentIntent]);

  // Memoized callback for shipping address change
  const handleAddressChange = useCallback((isComplete: boolean) => {
    setIsShippingAddressComplete(isComplete);
  }, []);

  // Check cart items for shipping restrictions when state changes
  const handleStateChange = useCallback((stateCode: string) => {
    if (!cart?.items?.length || !stateCode) {
      setRestrictedItems([]);
      return;
    }

    const upper = stateCode.toUpperCase();
    const restricted = cart.items.filter((item: any) => {
      const excluded = item.product?.metadata?.excluded_shipping_states;
      return Array.isArray(excluded) && excluded.some((s: string) => s.toUpperCase() === upper);
    });

    setRestrictedItems(
      restricted.map((item: any) => ({
        id: item.id,
        title: item.product?.title || item.title || 'Unknown product',
      }))
    );
  }, [cart?.items]);

  // Memoized callback for tax calculation ready
  const handleTaxCalculationReady = useCallback(async (updatedCart: any) => {
    if (updatedCart) {
      const taxTotal = updatedCart.tax_total || 0;
      const province = updatedCart.shipping_address?.province || 'unknown';
      console.log('💰 Early tax calculation received:');
      console.log(`   Tax: $${taxTotal.toFixed(2)}`);
      console.log(`   Province: ${province}`);
      setCart(updatedCart);
    }
  }, [setCart]);

  // Memoized callback for address complete
  const handleAddressComplete = useCallback(async (updatedCart: any) => {
    if (updatedCart) {
      const prevTax = cart?.tax_total || 0;
      const newTax = updatedCart.tax_total || 0;
      const province = updatedCart.shipping_address?.province || 'unknown';

      console.log('💰 Tax update received:');
      console.log(`   Previous tax: $${prevTax.toFixed(2)}`);
      console.log(`   New tax: $${newTax.toFixed(2)}`);
      console.log(`   Province: ${province}`);

      setCart(updatedCart);

      if (newTax > 0) {
        console.log(`✅ Tax applied: $${newTax.toFixed(2)}`);
      }
    }

    // Auto-select shipping method when address is complete
    if (cart?.id) {
      try {
        console.log("📍 Address complete, auto-selecting shipping...");
        await autoSelectShippingMethod(cart.id);

        // Refresh cart to get final totals after shipping selection
        const refreshedCart = await retrieveCart(cart.id);
        if (refreshedCart) setCart(refreshedCart as any);
        // PaymentIntent will be refreshed automatically by the central useEffect when it detects cart.total change
      } catch (error) {
        console.error("Failed to auto-select shipping or refresh PaymentIntent:", error);
      }
    }
  }, [cart?.id, cart?.tax_total, setCart, autoSelectShippingMethod, refreshStripePaymentIntent]);

  // Memoized callback for discount codes updated
  const handleCodesUpdated = useCallback((_: any, updatedCart: any) => {
    if (updatedCart) {
      setCart(updatedCart);
    }
  }, [setCart]);

  // Loading state - show spinner
  if (isInitialLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading checkout...</p>
        </div>
      </div>;
  }

  // Empty cart state - show friendly message with CTA
  if (!cart || !cart.items || cart.items.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="border-b bg-card">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <Link to="/" className="flex items-center space-x-2">
                <img src="/lovable-uploads/060fc0ae-7c76-4b9d-84bf-ef2ccf5c7704.png" alt="VNSH Logo" className="h-16 w-auto" />
              </Link>
            </div>
          </div>
        </header>

        {/* Empty Cart Message */}
        <main className="max-w-2xl mx-auto px-4 py-16 text-center">
          <div className="space-y-6">
            <div className="w-24 h-24 mx-auto bg-gray-100 rounded-full flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-12 w-12 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                />
              </svg>
            </div>

            <div>
              <h1 className="text-2xl font-semibold text-gray-900 mb-2">Your cart is empty</h1>
              <p className="text-gray-600">
                Looks like you haven't added any items to your cart yet.
              </p>
            </div>

            <div className="pt-4">
              <Link
                to="/collections/all"
                className="inline-flex items-center justify-center px-8 py-3 bg-black text-white font-medium rounded-lg hover:bg-gray-800 transition-colors"
              >
                Continue Shopping
              </Link>
            </div>

            <div className="pt-8 border-t border-gray-200">
              <p className="text-sm text-gray-500">
                Need help? <Link to="/pages/contact" className="text-blue-600 hover:underline">Contact us</Link>
              </p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return <div className="min-h-screen bg-background">
      {/* Finalizing overlay — shown immediately after Stripe confirms payment so
          the customer gets clear "payment went through, almost done" feedback
          instead of a frozen button while the order is created. */}
      {isFinalizingOrder && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-white/90 backdrop-blur-sm"
          role="status"
          aria-live="polite"
        >
          <div className="flex flex-col items-center text-center px-6">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-vnsh-red mb-4"></div>
            <p className="text-lg font-semibold text-gray-900">Payment confirmed</p>
            <p className="text-sm text-gray-600 mt-1">Finalizing your order — please don't close this window…</p>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <Link to="/" className="flex items-center space-x-2">
              <img src="/lovable-uploads/060fc0ae-7c76-4b9d-84bf-ef2ccf5c7704.png" alt="VNSH Logo" className="h-16 w-auto" />
            </Link>
            
            <nav className="flex items-center space-x-2 text-sm text-muted-foreground">
              <Link to="/cart" className="hover:text-foreground transition-colors">Cart</Link>
              <ChevronLeft className="h-4 w-4 rotate-180" />
              
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Checkout Form */}
          <div className="space-y-6">
            {/* Express Checkout - Wallet Buttons */}
            {clientSecret && (
              <div>
                <h3 className="text-lg font-semibold mb-4">Express Checkout</h3>
                <StripePaymentWrapper clientSecret={clientSecret}>
                  <ExpressCheckoutElement
                    amount={orderSummary.total}
                    subtotal={cart?.item_subtotal || 0}
                    onSuccess={handlePaymentSuccess}
                    onError={handlePaymentError}
                    onProcessing={handlePaymentProcessing}
                    cartId={cart?.id}
                    onShippingAddressChange={handleExpressCheckoutShippingAddressChange}
                    onBeforeConfirm={handleExpressCheckoutShippingAddressConfirm}
                    onShippingRateChange={handleExpressCheckoutShippingRateChange}
                    initialShippingRates={initialShippingRates}
                  />
                </StripePaymentWrapper>
              </div>
            )}

            {/* Divider */}
            <div className="flex items-center gap-4">
              <div className="flex-1 border-t border-gray-300"></div>
              <span style={{ fontSize: '12px', color: 'rgb(115, 115, 115)', fontWeight: '400' }}>OR</span>
              <div className="flex-1 border-t border-gray-300"></div>
            </div>

            {/* Complete Your Order Section */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Complete Your Order</h3>

              {/* Email Address (Outside Stripe - Matches Original) */}
              <div className="border border-gray-200 rounded-lg p-4 mb-4">
                <h4 className="text-sm font-semibold mb-3 text-gray-700">Email Address</h4>
                <input
                  type="email"
                  name="email"
                  autoComplete="email"
                  value={emailInput}
                  onChange={handleEmailChange}
                  placeholder="your.email@example.com"
                  required
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-black ${
                    emailError ? 'border-red-500' : 'border-gray-300'
                  }`}
                  style={{
                    fontSize: '14px',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  }}
                />
                {emailError ? (
                  <p className="text-xs text-red-500 mt-2">{emailError}</p>
                ) : (
                  <p className="text-xs text-gray-500 mt-2">
                    We'll send your order confirmation and receipt to this email address.
                  </p>
                )}
              </div>

              {/* Shipping Address Form (Outside Stripe Elements - No Reload!) */}
              <div className="border border-gray-200 rounded-lg p-4 mb-4">
                <h4 className="text-sm font-semibold mb-3 text-gray-700">Shipping Address</h4>
                <ShippingAddressForm
                  cartId={cart?.id || ''}
                  onAddressChange={handleAddressChange}
                  onTaxCalculationReady={handleTaxCalculationReady}
                  onAddressComplete={handleAddressComplete}
                  onStateChange={handleStateChange}
                />
              </div>

              {/* Shipping restriction warning */}
              {restrictedItems.length > 0 && (
                <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 mb-4 flex items-start gap-3">
                  <AlertTriangle className="text-amber-600 flex-shrink-0 mt-0.5" size={20} />
                  <div className="flex-1">
                    <p className="text-amber-800 font-medium text-sm">
                      Shipping restriction
                    </p>
                    <p className="text-amber-700 text-sm mt-1">
                      The following {restrictedItems.length === 1 ? 'item' : 'items'} cannot be shipped to this state and must be removed before checkout:
                    </p>
                    <ul className="mt-2 space-y-1">
                      {restrictedItems.map((item) => (
                        <li key={item.id} className="flex items-center justify-between text-sm">
                          <span className="text-amber-800">{item.title}</span>
                          <button
                            type="button"
                            onClick={() => removeItem(item.id)}
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

              {/* Stripe Payment Section (Credit Card + Billing Address) */}
              {/* Only show payment fields after shipping address is complete, no restrictions, and email is valid */}
              {clientSecret && isShippingAddressComplete && emailInput && !emailError && restrictedItems.length === 0 ? (
                <StripePaymentWrapper clientSecret={clientSecret}>
                  <div className="border border-gray-200 rounded-lg p-4">
                    <h4 className="text-sm font-semibold mb-3 text-gray-700">Payment Information</h4>
                    <PaymentElementComponent
                      onSuccess={handlePaymentSuccess}
                      onError={handlePaymentError}
                      isProcessing={isProcessing}
                      collectShipping={false}
                      cartId={cart?.id}
                      email={cart?.email || ''}
                      shippingAddress={cart?.shipping_address}
                    />
                  </div>
                </StripePaymentWrapper>
              ) : (
                <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                  <h4 className="text-sm font-semibold mb-3 text-gray-700">Payment Information</h4>
                  <p className="text-gray-500 text-sm">
                    {!clientSecret
                      ? "Loading payment options..."
                      : restrictedItems.length > 0
                      ? "Please remove restricted items above to proceed with payment."
                      : !emailInput
                      ? "Please enter your email address to proceed with payment."
                      : emailError
                      ? "Please enter a valid email address."
                      : "Please complete your shipping address above to proceed with payment."}
                  </p>
                </div>
              )}
            </div>

            <div className="text-center mt-6">
              <Link to="/" className="inline-flex items-center hover:underline" style={{ fontSize: '16px', color: 'rgb(24, 120, 185)', fontWeight: '500', textDecoration: 'none' }}>
                <ChevronLeft className="h-5 w-5 mr-1" />
                Continue Shopping
              </Link>
            </div>

            <div className="text-center mt-8 space-y-2">
              <p style={{ fontSize: '16px', fontWeight: '600' }}>
                Need help? <Link to="/pages/contact" style={{ color: 'rgb(37, 99, 235)' }}>Contact us</Link>
              </p>
              <p style={{ fontSize: '15px', color: 'rgb(111, 111, 111)' }}>
                We offer a 60-day money back guarantee. If for any reason, you don't absolutely love it,
                we'll refund your money even if you send us back an opened box.
              </p>
              <div className="flex justify-center space-x-4" style={{ fontSize: '14px' }}>
                <Link to="/pages/return-policy" style={{ color: 'rgb(37, 99, 235)' }}>Refund Policy</Link>
                <Link to="/pages/privacy-policy" style={{ color: 'rgb(37, 99, 235)' }}>Privacy Policy</Link>
                <Link to="/pages/terms-disclaimer" style={{ color: 'rgb(37, 99, 235)' }}>Terms of Service</Link>
              </div>
            </div>
          </div>
          
          {/* Order Summary */}
          <div className="lg:sticky lg:top-8 h-fit space-y-6">
            {/* Out of stock warning */}
            {hasOutOfStockItems && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                <AlertTriangle className="text-red-500 flex-shrink-0 mt-0.5" size={20} />
                <div>
                  <p className="text-red-800 font-medium">Some items are no longer available</p>
                  <p className="text-red-600 text-sm mt-1">
                    <Link to="/cart" className="underline hover:no-underline">Return to cart</Link> to remove sold out items before checkout.
                  </p>
                </div>
              </div>
            )}

            {/* Order Items */}
            <div className="space-y-4">
              <div className="hidden sm:grid grid-cols-[minmax(0,1fr)_140px_100px] items-center gap-4">
                <span style={{ fontSize: '16px', fontWeight: '700', color: 'rgb(111, 111, 111)' }}>Item</span>
                <span className="text-center" style={{ fontSize: '16px', fontWeight: '700', color: 'rgb(111, 111, 111)' }}>Quantity</span>
                <span className="text-right" style={{ fontSize: '16px', fontWeight: '700', color: 'rgb(111, 111, 111)' }}>Price</span>
              </div>

              {cart?.items?.filter((i: any) => !i.metadata?.is_mystery_gift).map(item => {
                const isOutOfStock = outOfStockItems.has(item.id);
                return (
                <div key={item.id} className={`sm:grid sm:grid-cols-[minmax(0,1fr)_140px_100px] sm:items-center sm:gap-4 ${isOutOfStock ? 'bg-red-50 -mx-2 px-2 py-2 rounded-lg border border-red-200' : ''}`}>
                  {/* Item: image + name */}
                  <div className="flex items-center gap-3">
                    <div className="relative flex-shrink-0">
                      <img src={item.thumbnail || "/placeholder.svg"} alt={item.title} style={{ width: '64px', height: '64px', objectFit: 'contain', borderRadius: '0px' }} className={`border ${isOutOfStock ? 'opacity-50' : ''}`} />
                      {isOutOfStock && (
                        <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs px-1 rounded">Sold out</div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3 style={{ fontSize: '18px', fontWeight: '500', color: isOutOfStock ? 'rgb(127, 29, 29)' : 'rgb(0, 0, 0)' }}>{item.title}</h3>
                      {item.variant?.title && item.variant.title !== 'Default Title' && (
                        <p style={{ fontSize: '16px', fontWeight: '400', color: 'rgb(111, 111, 111)', marginTop: '4px' }}>
                          {item.variant.title}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Quantity + Price row (stacks below on mobile) */}
                  <div className="flex items-center justify-between sm:contents mt-3 sm:mt-0 pl-[76px] sm:pl-0">
                    <div className="flex items-center justify-center gap-0 border border-gray-300 rounded-lg overflow-hidden bg-white shadow-sm">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleQuantityChange(item.id, item.quantity - 1);
                        }}
                        disabled={item.quantity <= 1 || isCartBusy}
                        className="h-9 w-9 sm:h-11 sm:w-11 flex items-center justify-center bg-gray-50 hover:bg-gray-100 active:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors touch-manipulation border-r border-gray-300"
                        aria-label={`Decrease quantity for ${item.title}`}
                      >
                        <Minus size={18} className="text-gray-700" />
                      </button>
                      <div className="h-9 sm:h-11 min-w-[44px] sm:min-w-[60px] px-2 sm:px-4 flex items-center justify-center">
                        <span className="text-base font-semibold text-gray-900">{item.quantity}</span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleQuantityChange(item.id, item.quantity + 1);
                        }}
                        disabled={isCartBusy}
                        className="h-9 w-9 sm:h-11 sm:w-11 flex items-center justify-center bg-gray-50 hover:bg-gray-100 active:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors touch-manipulation border-l border-gray-300"
                        aria-label={`Increase quantity for ${item.title}`}
                      >
                        <Plus size={18} className="text-gray-700" />
                      </button>
                    </div>

                    <span className="sm:text-right" style={{ fontSize: '16px', fontWeight: '600' }}>${(item.unit_price * item.quantity).toFixed(2)}</span>
                  </div>
                </div>
                );
              })}
            </div>

            {/* Discount Code */}
            {cart && (
              <DiscountCode
                cartId={cart.id}
                appliedCodes={cart.promotions?.map((p: any) => p.code).filter(Boolean) || []}
                visualOnlyCodes={showFreeShippingBadge ? [FREESHIPPING_CODE] : []}
                onCodesUpdated={handleCodesUpdated}
              />
            )}

            <Separator />
            
            {/* Order Totals */}
            <div className="space-y-3">
              <div className="flex justify-between">
                <span style={{ fontSize: '16px', fontWeight: '500', color: 'rgb(111, 111, 111)' }}>Sub Total</span>
                <span style={{ fontSize: '16px', fontWeight: '500', color: 'rgb(111, 111, 111)' }}>${orderSummary.subtotal.toFixed(2)}</span>
              </div>

              <div className="flex justify-between">
                <span style={{ fontSize: '16px', fontWeight: '500', color: 'rgb(111, 111, 111)' }}>Shipping</span>
                <span style={{ fontSize: '16px', fontWeight: '500', color: showFreeShippingBadge ? 'rgb(22, 163, 74)' : 'rgb(111, 111, 111)' }}>
                  {showFreeShippingBadge ? 'FREE' : `$${orderSummary.shipping.toFixed(2)}`}
                </span>
              </div>

              {/* Only show tax if there's a shipping address (tax is calculated based on address) */}
              {cart?.shipping_address?.province && (
                <div className="flex justify-between">
                  <span style={{ fontSize: '16px', fontWeight: '500', color: 'rgb(111, 111, 111)' }}>Sales Tax</span>
                  <span style={{ fontSize: '16px', fontWeight: '500', color: 'rgb(111, 111, 111)' }}>${orderSummary.tax.toFixed(2)}</span>
                </div>
              )}

              {orderSummary.discount > 0 && (
                <div className="flex justify-between">
                  <span style={{ fontSize: '16px', fontWeight: '500', color: 'rgb(111, 111, 111)' }}>Discount</span>
                  <span style={{ fontSize: '16px', fontWeight: '500', color: 'rgb(111, 111, 111)' }}>${orderSummary.discount.toFixed(2)}</span>
                </div>
              )}

              <Separator />

              <div className="flex justify-between">
                <span style={{ fontSize: '20px', fontWeight: '600', color: 'rgb(0, 0, 0)' }}>Grand Total</span>
                <span style={{ fontSize: '20px', fontWeight: '600', color: 'rgb(0, 0, 0)' }}>${orderSummary.total.toFixed(2)}</span>
              </div>
            </div>

            <Separator />

            {/* Why Choose Us */}
            <div className="space-y-4">
              <h3 style={{ fontSize: '18px', fontWeight: '600', textAlign: 'center', color: 'rgb(0, 0, 0)' }}>WHY CHOOSE US?</h3>

              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex items-center justify-center flex-shrink-0" style={{ width: '70px', height: '70px' }}>
                    <img
                      src="https://assets.checkoutchamp.com/f09818f0-af22-11ea-afe1-abac30942df7/money_back.webp"
                      alt="Money Back Guarantee"
                      style={{ width: '70px', height: '70px', objectFit: 'fill' }}
                    />
                  </div>
                  <div>
                    <p style={{ fontSize: '16px', fontWeight: '600' }}>60-day Satisfaction guarantee with Money Back</p>
                    <p style={{ fontSize: '14px', color: 'rgb(111, 111, 111)' }}>If you're not satisfied with your products we will issue a full refund, no questions asked.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex items-center justify-center flex-shrink-0" style={{ width: '70px', height: '70px' }}>
                    <img
                      src="https://assets.checkoutchamp.com/f09818f0-af22-11ea-afe1-abac30942df7/mail_truck.webp"
                      alt="Successfully Shipped Orders"
                      style={{ width: '70px', height: '70px', objectFit: 'fill' }}
                    />
                  </div>
                  <div>
                    <p style={{ fontSize: '16px', fontWeight: '600' }}>Over 45,579 successfully shipped orders</p>
                    <p style={{ fontSize: '14px', color: 'rgb(111, 111, 111)' }}>We've made as many happy customers as orders we've shipped. You simply have to join our big family.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>;
};
export default ExpressCheckout;
