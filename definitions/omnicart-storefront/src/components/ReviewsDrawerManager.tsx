import { useEffect, useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';

// CSS for the drawer that slides from left with tab attached
const drawerStyles = `
:root {
  --reviews-drawer-w: 720px;
}

.vnsh-reviews-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0,0,0,.4);
  z-index: 2147483644;
  opacity: 0;
  visibility: hidden;
  transition: opacity .35s ease, visibility .35s ease;
  pointer-events: none;
}

.vnsh-reviews-overlay.show {
  opacity: 1;
  visibility: visible;
  pointer-events: auto;
}

.vnsh-reviews-drawer {
  position: fixed;
  top: 0;
  left: calc(-1 * var(--reviews-drawer-w));
  width: var(--reviews-drawer-w);
  height: 100vh;
  background: #fff;
  box-shadow: 8px 0 24px rgba(0,0,0,.25);
  z-index: 2147483645;
  display: flex;
  flex-direction: column;
  transition: left .35s ease;
}

.vnsh-reviews-drawer[aria-hidden="false"] {
  left: 0;
}

/* Make the reviews tab slide with the drawer */
.reviews-sticky-tab--sliding {
  will-change: transform;
  transition: transform .35s ease;
  z-index: 2147483646 !important;
}

/* Override the !important transform when sliding */
.reviews-sticky-tab--sliding {
  transform: translateY(-50%) translateX(var(--tab-slide-x, 0)) !important;
}

/* Mobile: Full width drawer and proper off-screen positioning */
@media (max-width: 768px) {
  :root {
    --reviews-drawer-w: 100vw;
  }

  .vnsh-reviews-drawer {
    width: 100vw;
    left: -100vw;
  }

  .vnsh-reviews-drawer[aria-hidden="false"] {
    left: 0;
  }
}

/* Panel interior spacing/typography only */
.vnsh-reviews-header {
  position: sticky;
  top: 0;
  background: #fff;
  border-bottom: 1px solid #eee;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 18px;
  z-index: 10;
}

.vnsh-reviews-header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #111;
}

/* Yotpo testimonials widget styling */
#vnsh-reviews-widget-mount {
  padding: 20px 24px;
  min-height: 400px;
}

.yotpo-testimonials {
  width: 100% !important;
  max-width: none !important;
}

/* Ensure proper spacing and layout */
.yotpo-testimonials .yotpo-testimonials-header,
.yotpo-testimonials .yotpo-testimonials-body {
  padding: 0 !important;
  margin: 0 !important;
}

/* Make Yotpo modals appear above our overlay */
.yotpo-modal,
.yotpo-lightbox,
.yotpo-write-review-modal,
.yotpo-testimonials-modal,
.yotpo-reviews-modal,
.yotpo-modal-overlay {
  z-index: 999999 !important;
}

/* Force Yotpo to use full width */
.yotpo-testimonials-container,
.yotpo-testimonials-widget {
  width: 100% !important;
  max-width: 100% !important;
}

/* Style the drawer width for desktop */
@media (min-width: 769px) {
  :root { 
    --reviews-drawer-w: 720px; 
  }
}

/* Loading spinner animation */
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.vnsh-reviews-close {
  align-self: flex-end;
  margin: 12px 12px 0 0;
  width: 36px; 
  height: 36px;
  border: 2px solid #1b5e20;
  border-radius: 8px;
  background: #fff;
  font-size: 20px; 
  line-height: 1;
  display: grid; 
  place-items: center;
  cursor: pointer;
  color: #666;
}

.vnsh-reviews-close:hover {
  background: #f5f5f5;
  color: #000;
}

.vnsh-reviews-body {
  overflow: auto;
  -webkit-overflow-scrolling: touch;
  padding: 0;
  flex: 1;
}

.vnsh-reviews-body #vnsh-reviews-widget-mount {
  max-width: none;
  margin: 0;
}
`;

// Interface for Yotpo product data
interface YotpoProductData {
  productId: string | null;
  productName: string | null;
  productUrl: string | null;
}

// Hook to get Shopify product ID for Yotpo from ProductDetail page
function useYotpoProductData(): YotpoProductData {
  const location = useLocation();
  const [data, setData] = useState<YotpoProductData>({
    productId: null,
    productName: null,
    productUrl: null
  });

  useEffect(() => {
    // Check if we're on a product page
    const match = location.pathname.match(/\/products\/([^/]+)/);
    if (!match) {
      console.log('📭 No product detected in URL');
      setData({ productId: null, productName: null, productUrl: null });
      return;
    }

    const handle = match[1];
    console.log('🎯 Product handle detected:', handle);

    // Try to get the Shopify product ID from global state (set by ProductDetail)
    const getYotpoData = () => {
      const shopifyId = (window as any).__vnsh_yotpo_product_id;
      const productName = (window as any).__vnsh_yotpo_product_name;
      const productUrl = (window as any).__vnsh_yotpo_product_url;

      if (shopifyId) {
        console.log('📦 Got Shopify product ID from ProductDetail:', shopifyId);
        setData({
          productId: shopifyId,
          productName: productName || handle,
          productUrl: productUrl || `https://vnsh.com/products/${handle}`
        });
      } else {
        // Fallback to handle if Shopify ID not available yet
        console.log('⏳ Shopify product ID not yet available, using handle:', handle);
        setData({
          productId: handle,
          productName: handle.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
          productUrl: `https://vnsh.com/products/${handle}`
        });
      }
    };

    // Get initial data
    getYotpoData();

    // Listen for updates from ProductDetail
    const handleProductChange = (event: CustomEvent) => {
      console.log('📦 Received product change event:', event.detail);
      setData({
        productId: event.detail.productId,
        productName: event.detail.productName,
        productUrl: event.detail.productUrl
      });
    };

    window.addEventListener('vnsh:yotpo-product-change', handleProductChange as EventListener);

    // Re-check after a delay in case ProductDetail loads after this component
    const timeout = setTimeout(getYotpoData, 500);

    return () => {
      window.removeEventListener('vnsh:yotpo-product-change', handleProductChange as EventListener);
      clearTimeout(timeout);
    };
  }, [location.pathname]);

  return data;
}

export default function ReviewsDrawerManager() {
  console.log('ReviewsDrawerManager: Component rendered');
  const [isInitialized, setIsInitialized] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const rootRef = useRef<any>(null);
  const lastFocusRef = useRef<HTMLElement | null>(null);
  const yotpoData = useYotpoProductData();
  const productId = yotpoData.productId;

  useEffect(() => {
    console.log('ReviewsDrawerManager: First useEffect running');
    // Add styles to head if not already present
    const styleId = 'vnsh-reviews-drawer-styles';
    if (!document.getElementById(styleId)) {
      console.log('Adding drawer styles');
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = drawerStyles;
      document.head.appendChild(style);
    } else {
      console.log('Drawer styles already exist');
    }

    // Create drawer HTML structure if not present
    if (!document.querySelector('.vnsh-reviews-drawer')) {
      console.log('Creating drawer HTML structure');
      
      // Create overlay
      const overlay = document.createElement('div');
      overlay.className = 'vnsh-reviews-overlay';
      document.body.appendChild(overlay);
      
      // Create drawer
      const drawer = document.createElement('aside');
      drawer.className = 'vnsh-reviews-drawer';
      drawer.setAttribute('role', 'dialog');
      drawer.setAttribute('aria-modal', 'true');
      drawer.setAttribute('aria-labelledby', 'vnshReviewsTitle');
      drawer.setAttribute('aria-hidden', 'true');
      drawer.hidden = true;

      drawer.innerHTML = `
        <header class="vnsh-reviews-header">
          <h2 id="vnshReviewsTitle">Customer Testimonials</h2>
          <button type="button" class="vnsh-reviews-close" aria-label="Close reviews">×</button>
        </header>
        <div class="vnsh-reviews-body">
          <div id="vnsh-reviews-widget-mount">
            <!-- Loading placeholder -->
            <div id="reviews-loading" style="padding: 40px 0; text-align: center; color: #666;">
              <div style="margin-bottom: 16px;">Loading Customer Reviews...</div>
              <div style="width: 32px; height: 32px; border: 3px solid #f3f3f3; border-top: 3px solid #e8771b; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto;"></div>
            </div>
            
            <!-- Yotpo V3 Reviews Main Widget (Drawer-specific) -->
            <div class="yotpo-widget-instance yotpo-drawer-reviews-widget"
                 data-yotpo-instance-id="470985"
                 data-yotpo-product-id=""
                 data-yotpo-name="VNSH Product"
                 data-yotpo-url="https://vnsh.com"
                 style="display: none;">
            </div>
          </div>
        </div>
      `;
      
      document.body.appendChild(drawer);
      console.log('Drawer structure created');
    } else {
      console.log('Drawer structure already exists');
    }

    setIsInitialized(true);
    console.log('ReviewsDrawerManager: Initialization flag set to true');

    return () => {
      // Cleanup on unmount
      const overlay = document.querySelector('.vnsh-reviews-overlay');
      const drawer = document.querySelector('.vnsh-reviews-drawer');
      if (overlay) overlay.remove();
      if (drawer) drawer.remove();
      
      const style = document.getElementById('vnsh-reviews-drawer-styles');
      if (style) style.remove();
    };
  }, []);

  // Update Yotpo widget with current product ID
  useEffect(() => {
    if (!isInitialized) return;

    const widget = document.querySelector('.yotpo-drawer-reviews-widget');
    if (!widget) {
      console.log('⚠️ Yotpo drawer widget not found in DOM');
      return;
    }

    if (yotpoData.productId) {
      console.log('📦 Setting Yotpo drawer product ID:', yotpoData.productId);
      // V3 uses data-yotpo-product-id attribute
      widget.setAttribute('data-yotpo-product-id', yotpoData.productId);
      widget.setAttribute('data-yotpo-name', yotpoData.productName || 'VNSH Product');
      widget.setAttribute('data-yotpo-url', yotpoData.productUrl || 'https://vnsh.com');

      // Trigger Yotpo V3 to load reviews for this product
      setTimeout(() => {
        const yotpoWidgetsContainer = (window as any).yotpoWidgetsContainer;
        if (yotpoWidgetsContainer?.initWidgets) {
          console.log('🔄 Initializing Yotpo V3 widgets for product:', yotpoData.productId);
          yotpoWidgetsContainer.initWidgets();
        } else if ((window as any).yotpo) {
          console.log('🔄 Refreshing Yotpo widgets for product:', yotpoData.productId);
          if (typeof (window as any).yotpo.refreshWidgets === 'function') {
            (window as any).yotpo.refreshWidgets();
          } else if (typeof (window as any).yotpo.initWidgets === 'function') {
            (window as any).yotpo.initWidgets();
          }
        } else {
          console.log('⏳ Yotpo not yet loaded, will refresh when drawer opens');
        }
      }, 100);
    } else {
      console.log('📭 No product ID, skipping Yotpo update');
    }
  }, [yotpoData, isInitialized]);

  useEffect(() => {
    if (!isInitialized) return;

    console.log('ReviewsDrawerManager: Starting initialization');
    const tab = document.querySelector('[data-reviews-tab]') as HTMLElement;
    const overlay = document.querySelector('.vnsh-reviews-overlay') as HTMLElement;
    const drawer = document.querySelector('.vnsh-reviews-drawer') as HTMLElement;
    const closeBtn = document.querySelector('.vnsh-reviews-close') as HTMLElement;
    const mount = document.getElementById('vnsh-reviews-widget-mount') as HTMLElement;

    console.log('Elements found:', { tab, overlay, drawer, closeBtn, mount });

    if (!tab || !overlay || !drawer || !closeBtn || !mount) {
      console.error('Missing elements for drawer functionality');
      return;
    }

    // Store references and prepare tab for sliding
    overlayRef.current = overlay as HTMLDivElement;
    drawerRef.current = drawer as HTMLDivElement;
    closeButtonRef.current = closeBtn as HTMLButtonElement;
    
    // Add sliding class to tab without changing its visual design
    tab.classList.add('reviews-sticky-tab--sliding');
    console.log('Added sliding class to tab');

    // Helper to get drawer width in pixels
    const getDrawerWidth = () => {
      const w = drawer.getBoundingClientRect().width;
      if (w && w > 0) return w;
      
      // Fallback to CSS variable
      const cssVar = getComputedStyle(document.documentElement)
        .getPropertyValue('--reviews-drawer-w').trim() || '560px';
      
      const testEl = document.createElement('div');
      testEl.style.position = 'absolute';
      testEl.style.visibility = 'hidden';
      testEl.style.width = cssVar;
      document.body.appendChild(testEl);
      const px = testEl.getBoundingClientRect().width || 560;
      document.body.removeChild(testEl);
      return px;
    };

    // Helper to wait for Yotpo V3 loader (loaded in index.html)
    const loadYotpo = (callback?: () => void) => {
      // Check if product ID is available - don't load Yotpo without it
      const yotpoWidget = document.querySelector('.yotpo-drawer-reviews-widget');
      const currentProductId = yotpoWidget?.getAttribute('data-yotpo-product-id');

      if (!currentProductId || currentProductId === '') {
        console.log('Skipping Yotpo - no product ID available');
        callback?.();
        return;
      }

      console.log('Waiting for Yotpo V3 loader...');

      // Check if Yotpo is already available
      if ((window as any).yotpoLoaded) {
        console.log('Yotpo already loaded');
        callback?.();
        return;
      }

      // Yotpo V3 loader sets window.yotpoWidgetsContainer when ready
      let attempts = 0;
      const maxAttempts = 50; // 5 seconds total (50 * 100ms)

      const checkYotpo = () => {
        if ((window as any).yotpoWidgetsContainer || (window as any).yotpo) {
          console.log('Yotpo V3 loader available');
          (window as any).yotpoLoaded = true;
          callback?.();
          return;
        }

        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(checkYotpo, 100);
        } else {
          console.warn('Yotpo V3 loader timeout - loader script may not have loaded from index.html');
          (window as any).yotpoLoaded = true; // Mark as attempted even if failed
          callback?.();
        }
      };

      checkYotpo();
    };

    // Check for deep link query parameter
    const checkDeepLink = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const reviewsPage = urlParams.get('yoReviewsPage');
      if (reviewsPage) {
        // Auto-open drawer and navigate to specific page
        setTimeout(() => {
          open();
          // Let Yotpo handle the page navigation after widgets are loaded
          if ((window as any).yotpo && (window as any).yotpo.navigate) {
            (window as any).yotpo.navigate.toPage(parseInt(reviewsPage));
          }
        }, 100);
      }
    };

    const open = () => {
      console.log('Opening drawer');
      lastFocusRef.current = document.activeElement as HTMLElement;
      const drawerWidth = getDrawerWidth();

      // Show overlay
      overlay.classList.add('show');

      drawer.hidden = false;

      requestAnimationFrame(() => {
        drawer.setAttribute('aria-hidden', 'false');
        tab.setAttribute('aria-expanded', 'true');

        // Use CSS variable to slide the tab with the drawer
        tab.style.setProperty('--tab-slide-x', `${drawerWidth}px`);

        // DO NOT set aria-hidden on body - it hides all content from screen readers
        // The overlay element with pointer-events handles visual blocking

        console.log('Drawer opened, overlay visible');
      });

      // Initialize Yotpo widgets using V3 API
      console.log('📖 Opening reviews drawer');
      const loadingEl = document.getElementById('reviews-loading');
      const widget = document.querySelector('.yotpo-drawer-reviews-widget');

      console.log('📊 Current product ID:', productId);
      console.log('🔍 Drawer widget data-yotpo-product-id:', widget?.getAttribute('data-yotpo-product-id'));

      // Trigger Yotpo V3 widget initialization
      const yotpoWidgetsContainer = (window as any).yotpoWidgetsContainer;
      if (yotpoWidgetsContainer?.initWidgets) {
        console.log('🔄 Initializing Yotpo V3 widgets for drawer');
        yotpoWidgetsContainer.initWidgets();
      } else if ((window as any).yotpo) {
        console.log('🔄 Refreshing Yotpo widgets for drawer (fallback)');
        // Fallback to legacy method
        if (typeof (window as any).yotpo.refreshWidgets === 'function') {
          (window as any).yotpo.refreshWidgets();
        } else if (typeof (window as any).yotpo.initWidgets === 'function') {
          (window as any).yotpo.initWidgets();
        }
      } else {
        console.warn('⏳ Yotpo not yet available, widgets may load shortly');
      }

      // Hide loading indicator and show widget
      setTimeout(() => {
        if (loadingEl) loadingEl.style.display = 'none';
        if (widget) {
          (widget as HTMLElement).style.display = 'block';
          console.log('✅ Reviews widget displayed');
        }
      }, 300);
    };

    const close = () => {
      console.log('Closing drawer');
      drawer.setAttribute('aria-hidden', 'true');
      tab.setAttribute('aria-expanded', 'false');
      
      // Hide overlay
      overlay.classList.remove('show');
      
      // Return tab to original position using CSS variable
      tab.style.setProperty('--tab-slide-x', '0px');
      
      setTimeout(() => {
        drawer.hidden = true;
        console.log('Drawer closed, overlay hidden');
      }, 350);
      
      if (lastFocusRef.current) {
        lastFocusRef.current.focus();
      }
    };

    const isDrawerOpen = () => {
      return drawer.getAttribute('aria-hidden') === 'false';
    };

    const toggle = () => {
      if (isDrawerOpen()) {
        close();
      } else {
        open();
      }
    };

    const handleTabClick = (e: MouseEvent) => {
      console.log('Tab clicked!');
      e.preventDefault();
      // Always toggle - if open, close it; if closed, open it
      toggle();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isDrawerOpen()) {
        close();
      }
    };

    const handleOverlayClick = (e: MouseEvent) => {
      if (e.target === overlay) {
        close();
      }
    };


    // Handle window resize to recalculate tab position
    let resizeTimer: NodeJS.Timeout;
    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (isDrawerOpen()) {
          const drawerWidth = getDrawerWidth();
          tab.style.setProperty('--tab-slide-x', `${drawerWidth}px`);
        }
      }, 100);
    };

    console.log('Setting up event listeners');
    // Set up attributes and event listeners
    tab.setAttribute('aria-controls', 'vnsh-reviews-drawer');
    tab.setAttribute('aria-expanded', 'false');
    tab.addEventListener('click', handleTabClick);
    overlay.addEventListener('click', handleOverlayClick);
    closeBtn.addEventListener('click', close);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleResize);
    
    console.log('ReviewsDrawerManager: Initialization complete');

    // Check for deep link on page load
    checkDeepLink();

    // CRITICAL: Pre-load Yotpo immediately so it's ready before drawer opens
    // This eliminates the "not available" warning on first click
    console.log('Pre-loading Yotpo V3 in background');
    loadYotpo(() => {
      console.log('Yotpo V3 pre-loaded successfully - drawer will open instantly');
    });

    // Cleanup function
    return () => {
      tab.removeEventListener('click', handleTabClick);
      overlay.removeEventListener('click', handleOverlayClick);
      closeBtn.removeEventListener('click', close);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleResize);
      
      // Reset tab styles
      tab.classList.remove('reviews-sticky-tab--sliding');
      tab.style.removeProperty('--tab-slide-x');
      
      // Cleanup React root
      if (rootRef.current) {
        rootRef.current.unmount();
        rootRef.current = null;
      }
    };
  }, [isInitialized, productId]);

  // This component doesn't render anything visible - it just manages the drawer
  return null;
}