import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { getStoredAttribution } from './useAttributionCapture';
import { trackProductViewServerSide } from '@/lib/data/products';

/**
 * Custom hook to initialize and manage analytics tracking
 * Handles GTM pageview events on route changes
 * Initializes Facebook Pixel and CustomerLabs tracking
 */
export const useTracking = () => {
  const location = useLocation();

  useEffect(() => {
    // Initialize tracking on mount
    initializeTracking();
  }, []);

  useEffect(() => {
    // Track pageview on route change
    trackPageView(location.pathname);
  }, [location]);
};

/**
 * Initialize all tracking systems
 */
function initializeTracking() {
  // GTM, Facebook Pixel, CustomerLabs, and Attentive are already initialized in index.html
  // This function can be extended for additional initialization needs

  // Log that tracking is initialized
  if (window.gtag) {
    console.log('✅ Google Analytics initialized');
  }

  if (window.fbq) {
    console.log('✅ Facebook Pixel initialized');
  }

  if (window._cl) {
    console.log('✅ CustomerLabs CDP initialized');
  }

  if (window.attentive) {
    console.log('✅ Attentive SMS initialized');
  }

  console.log('✅ Analytics tracking initialized');
}

/**
 * Track a page view event with GTM, Facebook Pixel, CustomerLabs, and Attentive
 * @param path - The current page path
 */
export function trackPageView(path: string) {
  // GTM Page View
  if (window.dataLayer) {
    window.dataLayer.push({
      event: 'page_view',
      page_path: path,
      page_title: document.title,
      timestamp: new Date().toISOString(),
    });
    console.log('📊 GTM Page View tracked:', path);
  }

  // Facebook Pixel Page View (if not already tracked in index.html)
  if (window.fbq) {
    window.fbq('track', 'PageView');
  }

  // CustomerLabs Page View - SDK auto-tracks pageviews, only log for debugging
  // The CustomerLabs SDK v2.0.0 automatically tracks page views via the snippet
  // Manual pageview calls can cause issues with the SDK's internal state
  if (window._cl) {
    console.log('📊 CustomerLabs: Page view auto-tracked by SDK for:', path);
  }

  // Attentive Page View (automatic via script, no explicit call needed)
  // Attentive automatically tracks page views when the script loads
}

/**
 * Track custom events
 * @param eventName - Name of the event
 * @param eventData - Additional event data
 */
export function trackEvent(eventName: string, eventData?: Record<string, any>) {
  // GTM Custom Event
  if (window.dataLayer) {
    window.dataLayer.push({
      event: eventName,
      ...eventData,
      timestamp: new Date().toISOString(),
    });
    console.log('📊 GTM Event tracked:', eventName, eventData);
  }

  // Facebook Pixel Custom Event
  if (window.fbq) {
    window.fbq('trackCustom', eventName, eventData);
  }

  // CustomerLabs Custom Event (v2.0.0 JS Helper API: _cl.trackClick(eventName, properties))
  // Documentation: https://www.customerlabs.com/docs/website-event-tracking/developer-documentation/javascript-helper-functions-code-snippet/
  try {
    if (window._cl && typeof window._cl.trackClick === 'function') {
      const clEventInterval = setInterval(() => {
        try {
          if (((window.CLabsgbVar || {}) as { generalProps?: { uid?: unknown } }).generalProps?.uid) {
            // Convert flat eventData to CustomerLabs customProperties format
            const customProperties: Record<string, { t: string; v: string }> = {};
            if (eventData) {
              Object.entries(eventData).forEach(([key, value]) => {
                const valueType = typeof value === 'number' ? 'number' : 'string';
                customProperties[key] = { t: valueType, v: String(value) };
              });
            }
            const properties = { customProperties };
            window._cl?.trackClick?.(eventName, properties);
            console.log('📊 CustomerLabs Event tracked:', eventName, eventData);
            clearInterval(clEventInterval);
          }
        } catch (e) {
          console.warn('CustomerLabs trackClick error:', e);
          clearInterval(clEventInterval);
        }
      }, 100);
      setTimeout(() => clearInterval(clEventInterval), 5000);
    }
  } catch (e) {
    console.warn('CustomerLabs trackClick initialization error:', e);
  }
}

/**
 * Track ecommerce events (Add to Cart, Purchase, etc.)
 */
export function trackAddToCart(product: {
  id: string;
  title: string;
  price: number;
  quantity: number;
  variant_id?: string;
  image_url?: string;
  category?: string;
}) {
  // GTM Add to Cart
  if (window.dataLayer) {
    window.dataLayer.push({
      event: 'add_to_cart',
      ecommerce: {
        items: [
          {
            item_id: product.id,
            item_name: product.title,
            price: product.price,
            quantity: product.quantity,
          },
        ],
      },
    });
  }

  // Facebook Pixel Add to Cart
  if (window.fbq) {
    window.fbq('track', 'AddToCart', {
      content_name: product.title,
      content_ids: [product.id],
      content_type: 'product',
      value: product.price * product.quantity,
      currency: 'USD',
    });
  }

  // CustomerLabs Add to Cart (v2.0.0 JS Helper API: _cl.trackClick(eventName, properties))
  // Documentation: https://www.customerlabs.com/docs/website-event-tracking/developer-documentation/javascript-helper-functions-code-snippet/
  try {
    if (window._cl && typeof window._cl.trackClick === 'function') {
      const clAddToCartInterval = setInterval(() => {
        try {
          if (((window.CLabsgbVar || {}) as { generalProps?: { uid?: unknown } }).generalProps?.uid) {
            const properties = {
              productProperties: [
                {
                  product_id: { t: 'string', v: product.id },
                  product_name: { t: 'string', v: product.title },
                  product_price: { t: 'number', v: String(product.price) },
                  product_quantity: { t: 'number', v: String(product.quantity) },
                  ...(product.category && { product_category: { t: 'string', v: product.category } }),
                  ...(product.image_url && { product_image: { t: 'string', v: product.image_url } }),
                },
              ],
              customProperties: {
                currency: { t: 'string', v: 'USD' },
                value: { t: 'number', v: String(product.price * product.quantity) },
              },
            };
            window._cl?.trackClick?.('Added to cart', properties);
            console.log('📊 CustomerLabs Add to Cart tracked:', product);
            clearInterval(clAddToCartInterval);
          }
        } catch (e) {
          console.warn('CustomerLabs Add to Cart error:', e);
          clearInterval(clAddToCartInterval);
        }
      }, 100);
      setTimeout(() => clearInterval(clAddToCartInterval), 5000);
    }
  } catch (e) {
    console.warn('CustomerLabs Add to Cart initialization error:', e);
  }

  // Attentive Add to Cart
  if (window.attentive && typeof window.attentive.analytics?.addToCart === 'function') {
    const attentiveItem: any = {
      productId: product.id,
      productVariantId: product.variant_id || product.id,
      name: product.title,
      price: {
        value: product.price.toString(),
        currency: 'USD',
      },
      quantity: product.quantity,
    };

    // Only include optional fields if they have valid values (avoid empty strings per Attentive docs)
    if (product.image_url) {
      attentiveItem.productImage = product.image_url;
    }
    if (product.category) {
      attentiveItem.category = product.category;
    }

    window.attentive.analytics?.addToCart({
      items: [attentiveItem],
    });
    console.log('📊 Attentive Add to Cart tracked:', product);
  }
}

/**
 * Track purchase events
 */
export function trackPurchase(orderData: {
  order_id: string;
  total: number;
  currency: string;
  user_email?: string;
  user_phone?: string;
  items: Array<{
    id: string;
    name: string;
    price: number;
    quantity: number;
    variant_id?: string;
    image_url?: string;
    category?: string;
  }>;
}) {
  // GTM Purchase Event
  if (window.dataLayer) {
    window.dataLayer.push({
      event: 'purchase',
      ecommerce: {
        transaction_id: orderData.order_id,
        value: orderData.total,
        currency: orderData.currency,
        items: orderData.items.map((item) => ({
          item_id: item.id,
          item_name: item.name,
          price: item.price,
          quantity: item.quantity,
        })),
      },
    });
    console.log('📊 GTM Purchase tracked:', orderData.order_id, orderData.total);
  }

  // Facebook Pixel Purchase Event
  if (window.fbq) {
    window.fbq('track', 'Purchase', {
      value: orderData.total,
      currency: orderData.currency,
      content_ids: orderData.items.map((item) => item.id),
      content_type: 'product',
      num_items: orderData.items.reduce((sum, item) => sum + item.quantity, 0),
    });
    console.log('📊 Facebook Pixel Purchase tracked:', orderData.order_id, orderData.total);
  }

  // CustomerLabs Purchase Event (v2.0.0 JS Helper API: _cl.trackClick(eventName, properties))
  // Documentation: https://www.customerlabs.com/docs/website-event-tracking/developer-documentation/javascript-helper-functions-code-snippet/
  try {
    if (window._cl && typeof window._cl.trackClick === 'function') {
      const clPurchaseInterval = setInterval(() => {
        try {
          if (((window.CLabsgbVar || {}) as { generalProps?: { uid?: unknown } }).generalProps?.uid) {
            const productProperties = orderData.items.map((item) => ({
              product_id: { t: 'string', v: item.id },
              product_name: { t: 'string', v: item.name },
              product_price: { t: 'number', v: String(item.price) },
              product_quantity: { t: 'number', v: String(item.quantity) },
              ...(item.category && { product_category: { t: 'string', v: item.category } }),
              ...(item.image_url && { product_image: { t: 'string', v: item.image_url } }),
            }));
            const attribution = getStoredAttribution();
            const attributionProps: Record<string, { t: string; v: string }> = {};
            if (attribution?._raclid) attributionProps._raclid = { t: 'string', v: attribution._raclid };
            if (attribution?.utm_source) attributionProps.utm_source = { t: 'string', v: attribution.utm_source };
            if (attribution?.utm_campaign) attributionProps.utm_campaign = { t: 'string', v: attribution.utm_campaign };
            if (attribution?.utm_medium) attributionProps.utm_medium = { t: 'string', v: attribution.utm_medium };
            if (attribution?.utm_term) attributionProps.utm_term = { t: 'string', v: attribution.utm_term };
            if (attribution?.utm_content) attributionProps.utm_content = { t: 'string', v: attribution.utm_content };
            if (attribution?.fbclid) attributionProps.fbclid = { t: 'string', v: attribution.fbclid };
            if (attribution?.gclid) attributionProps.gclid = { t: 'string', v: attribution.gclid };
            if (attribution?.ttclid) attributionProps.ttclid = { t: 'string', v: attribution.ttclid };

            const properties = {
              productProperties,
              customProperties: {
                transaction_id: { t: 'string', v: orderData.order_id },
                currency: { t: 'string', v: orderData.currency },
                value: { t: 'number', v: String(orderData.total) },
                subtotal: { t: 'number', v: String(orderData.total) },
                ...attributionProps,
              },
            };
            window._cl?.trackClick?.('Purchased', properties);
            console.log('📊 CustomerLabs Purchase tracked:', orderData.order_id, orderData.total);
            clearInterval(clPurchaseInterval);
          }
        } catch (e) {
          console.warn('CustomerLabs Purchase error:', e);
          clearInterval(clPurchaseInterval);
        }
      }, 100);
      setTimeout(() => clearInterval(clPurchaseInterval), 5000);
    }
  } catch (e) {
    console.warn('CustomerLabs Purchase initialization error:', e);
  }

  // Attentive Purchase Event
  if (window.attentive && typeof window.attentive.analytics?.purchase === 'function') {
    const attentiveData: any = {
      items: orderData.items.map((item) => {
        const attentiveItem: any = {
          productId: item.id,
          productVariantId: item.variant_id || item.id,
          name: item.name,
          price: {
            value: item.price.toString(),
            currency: orderData.currency,
          },
          quantity: item.quantity,
        };

        // Only include optional fields if they have valid values (avoid empty strings per Attentive docs)
        if (item.image_url) {
          attentiveItem.productImage = item.image_url;
        }
        if (item.category) {
          attentiveItem.category = item.category;
        }

        return attentiveItem;
      }),
      order: {
        orderId: orderData.order_id,
      },
    };

    // Only include user object if we have email or phone (avoid empty strings per Attentive docs)
    if (orderData.user_email || orderData.user_phone) {
      attentiveData.user = {};
      if (orderData.user_email) {
        attentiveData.user.email = orderData.user_email;
      }
      if (orderData.user_phone) {
        attentiveData.user.phone = orderData.user_phone;
      }
    }

    window.attentive.analytics?.purchase(attentiveData);
    console.log('📊 Attentive Purchase tracked:', orderData.order_id, orderData.total);
  }
}

/**
 * Identify a user for tracking
 * @param userId - The user's unique identifier
 * @param traits - Additional user traits (email, name, phone, etc.)
 */
export function identifyUser(userId: string, traits?: Record<string, any>) {
  // CustomerLabs Identify (v2.0.0 JS Helper API: _cl.identify(properties))
  // Documentation: https://www.customerlabs.com/docs/website-event-tracking/developer-documentation/javascript-helper-functions-code-snippet/
  try {
    if (window._cl && typeof window._cl.identify === 'function') {
      const clIdentifyInterval = setInterval(() => {
        try {
          if (((window.CLabsgbVar || {}) as { generalProps?: { uid?: unknown } }).generalProps?.uid) {
            // Build user_traits object in CustomerLabs format
            const userTraitsValue: Record<string, { t: string; v: string }> = {};
            if (traits?.first_name) userTraitsValue.first_name = { t: 'string', v: traits.first_name };
            if (traits?.last_name) userTraitsValue.last_name = { t: 'string', v: traits.last_name };
            if (traits?.email) userTraitsValue.email = { t: 'string', v: traits.email };
            if (traits?.phone) userTraitsValue.phone = { t: 'string', v: traits.phone };

            const properties: any = {
              customProperties: {
                user_traits: {
                  t: 'Object',
                  v: userTraitsValue,
                },
              },
            };

            // Set identify_by based on available identifier (email preferred)
            if (traits?.email) {
              properties.customProperties.identify_by_email = {
                t: 'string',
                v: traits.email,
                ib: true, // ib = identify by this field
              };
            } else if (traits?.phone) {
              properties.customProperties.identify_by_phone = {
                t: 'string',
                v: traits.phone,
                ib: true,
              };
            } else {
              properties.customProperties.identify_by_user_id = {
                t: 'string',
                v: userId,
                ib: true,
              };
            }

            window._cl?.identify?.(properties);
            console.log('👤 CustomerLabs User identified:', userId, traits);
            clearInterval(clIdentifyInterval);
          }
        } catch (e) {
          console.warn('CustomerLabs identify error:', e);
          clearInterval(clIdentifyInterval);
        }
      }, 100);
      setTimeout(() => clearInterval(clIdentifyInterval), 5000);
    }
  } catch (e) {
    console.warn('CustomerLabs identify initialization error:', e);
  }

  // GTM User Identification (via dataLayer)
  if (window.dataLayer) {
    window.dataLayer.push({
      event: 'user_identified',
      user_id: userId,
      ...traits,
      timestamp: new Date().toISOString(),
    });
    console.log('👤 GTM User identified:', userId);
  }

  // Attentive User Identification
  if (window.attentive && typeof window.attentive.analytics?.identify === 'function') {
    const identifyData: any = {};

    // Add email if available
    if (traits?.email) {
      identifyData.email = traits.email;
    }

    // Add phone if available
    if (traits?.phone) {
      identifyData.phone = traits.phone;
    }

    // Only trigger if we have email or phone
    if (identifyData.email || identifyData.phone) {
      window.attentive.analytics?.identify(identifyData);
      console.log('👤 Attentive User identified:', identifyData);
    }
  }
}

/**
 * Track product view events
 *
 * Fans out to GTM, Facebook Pixel, CustomerLabs, the Attentive web SDK
 * (browse-abandonment), and — when `customer_id` is provided — the
 * OmniCart backend's `/store/products/:id/track-view` route which emits
 * a server-side Attentive "Product Viewed" custom event.  The
 * server-side path matches how Added to Cart / Started Checkout / Order
 * Placed are already delivered; the JS-tag path remains in place so
 * Attentive's existing browse-abandonment journeys keep working.
 */
export function trackProductView(product: {
  id: string;
  title: string;
  price: number;
  category?: string;
  variant_id?: string;
  image_url?: string;
  customer_id?: string;
}) {
  // GTM Product View
  if (window.dataLayer) {
    window.dataLayer.push({
      event: 'view_item',
      ecommerce: {
        items: [
          {
            item_id: product.id,
            item_name: product.title,
            price: product.price,
            item_category: product.category,
          },
        ],
      },
    });
    console.log('📊 GTM Product View tracked:', product.title);
  }

  // Facebook Pixel Product View
  if (window.fbq) {
    window.fbq('track', 'ViewContent', {
      content_name: product.title,
      content_ids: [product.id],
      content_type: 'product',
      value: product.price,
      currency: 'USD',
    });
  }

  // CustomerLabs Product View (v2.0.0 JS Helper API: _cl.trackClick(eventName, properties))
  // Documentation: https://www.customerlabs.com/docs/website-event-tracking/developer-documentation/javascript-helper-functions-code-snippet/
  try {
    if (window._cl && typeof window._cl.trackClick === 'function') {
      const clProductViewInterval = setInterval(() => {
        try {
          if (((window.CLabsgbVar || {}) as { generalProps?: { uid?: unknown } }).generalProps?.uid) {
            const properties = {
              productProperties: [
                {
                  product_id: { t: 'string', v: product.id },
                  product_name: { t: 'string', v: product.title },
                  product_price: { t: 'number', v: String(product.price) },
                  ...(product.category && { product_category: { t: 'string', v: product.category } }),
                  ...(product.image_url && { product_image: { t: 'string', v: product.image_url } }),
                },
              ],
              customProperties: {
                page_url: { t: 'string', v: window.location.href },
              },
            };
            window._cl?.trackClick?.('Product viewed', properties);
            console.log('📊 CustomerLabs Product View tracked:', product.title);
            clearInterval(clProductViewInterval);
          }
        } catch (e) {
          console.warn('CustomerLabs Product View error:', e);
          clearInterval(clProductViewInterval);
        }
      }, 100);
      setTimeout(() => clearInterval(clProductViewInterval), 5000);
    }
  } catch (e) {
    console.warn('CustomerLabs Product View initialization error:', e);
  }

  // Attentive Product View
  if (window.attentive && typeof window.attentive.analytics?.productView === 'function') {
    const attentiveItem: any = {
      productId: product.id,
      productVariantId: product.variant_id || product.id,
      name: product.title,
      price: {
        value: product.price.toString(),
        currency: 'USD',
      },
    };

    // Only include optional fields if they have valid values (avoid empty strings per Attentive docs)
    if (product.image_url) {
      attentiveItem.productImage = product.image_url;
    }
    if (product.category) {
      attentiveItem.category = product.category;
    }

    window.attentive.analytics?.productView({
      items: [attentiveItem],
    });
    console.log('📊 Attentive Product View tracked:', product.title);
  }

  // Server-side Attentive "Product Viewed" custom event via OmniCart.
  // Fire-and-forget; the helper catches all errors so a failed analytics
  // call never bubbles into the PDP render.  Anonymous viewers (no
  // customer_id) still hit the endpoint but the backend subscriber bails
  // because Attentive needs an identifier — so the round-trip is cheap.
  void trackProductViewServerSide(product.id, product.customer_id);
}

/**
 * Track begin checkout event
 */
export function trackBeginCheckout(cartData: {
  total: number;
  currency: string;
  items: Array<{
    id: string;
    name: string;
    price: number;
    quantity: number;
  }>;
}) {
  // GTM Begin Checkout
  if (window.dataLayer) {
    window.dataLayer.push({
      event: 'begin_checkout',
      ecommerce: {
        value: cartData.total,
        currency: cartData.currency,
        items: cartData.items.map((item) => ({
          item_id: item.id,
          item_name: item.name,
          price: item.price,
          quantity: item.quantity,
        })),
      },
    });
    console.log('📊 GTM Begin Checkout tracked:', cartData.total);
  }

  // Facebook Pixel Begin Checkout
  if (window.fbq) {
    window.fbq('track', 'InitiateCheckout', {
      value: cartData.total,
      currency: cartData.currency,
      content_ids: cartData.items.map((item) => item.id),
      content_type: 'product',
      num_items: cartData.items.reduce((sum, item) => sum + item.quantity, 0),
    });
  }

  // CustomerLabs Begin Checkout (v2.0.0 JS Helper API: _cl.trackClick(eventName, properties))
  // Documentation: https://www.customerlabs.com/docs/website-event-tracking/developer-documentation/javascript-helper-functions-code-snippet/
  try {
    if (window._cl && typeof window._cl.trackClick === 'function') {
      const clCheckoutInterval = setInterval(() => {
        try {
          if (((window.CLabsgbVar || {}) as { generalProps?: { uid?: unknown } }).generalProps?.uid) {
            const productProperties = cartData.items.map((item) => ({
              product_id: { t: 'string', v: item.id },
              product_name: { t: 'string', v: item.name },
              product_price: { t: 'number', v: String(item.price) },
              product_quantity: { t: 'number', v: String(item.quantity) },
            }));
            const properties = {
              productProperties,
              customProperties: {
                currency: { t: 'string', v: cartData.currency },
                value: { t: 'number', v: String(cartData.total) },
              },
            };
            window._cl?.trackClick?.('Checkout made', properties);
            console.log('📊 CustomerLabs Begin Checkout tracked:', cartData.total);
            clearInterval(clCheckoutInterval);
          }
        } catch (e) {
          console.warn('CustomerLabs Begin Checkout error:', e);
          clearInterval(clCheckoutInterval);
        }
      }, 100);
      setTimeout(() => clearInterval(clCheckoutInterval), 5000);
    }
  } catch (e) {
    console.warn('CustomerLabs Begin Checkout initialization error:', e);
  }
}

export default useTracking;
