import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * YotpoReviewsTab - Renders the Yotpo Reviews Tab widget placeholder
 *
 * This component adds the Yotpo Reviews Tab widget (instance ID 587405) which creates
 * a floating "Reviews" tab on the left side of the page. When clicked, it opens a
 * drawer/modal with customer reviews.
 *
 * This matches the production implementation at vnshholsters.com
 */
export default function ReviewsStickyTab() {
  const location = useLocation();
  const [yotpoProductId, setYotpoProductId] = useState<string | null>(null);

  useEffect(() => {
    // Get the Shopify product ID from the global state (set by ProductDetail)
    const getProductId = () => {
      const shopifyId = window.__vnsh_yotpo_product_id;
      if (shopifyId) {
        setYotpoProductId(shopifyId);
      }
    };

    // Get initial data
    getProductId();

    // Listen for product changes
    const handleProductChange = (event: CustomEvent) => {
      if (event.detail?.productId) {
        setYotpoProductId(event.detail.productId);
      }
    };

    window.addEventListener('vnsh:yotpo-product-change', handleProductChange as EventListener);

    // Re-check after a delay in case ProductDetail loads after this component
    const timeout = setTimeout(getProductId, 500);

    return () => {
      window.removeEventListener('vnsh:yotpo-product-change', handleProductChange as EventListener);
      clearTimeout(timeout);
    };
  }, [location.pathname]);

  // Refresh Yotpo widgets when product ID changes
  useEffect(() => {
    if (yotpoProductId) {
      // Give Yotpo time to detect the new widget
      setTimeout(() => {
        const yotpoWidgetsContainer = window.yotpoWidgetsContainer;
        if (yotpoWidgetsContainer?.initWidgets) {
          yotpoWidgetsContainer.initWidgets();
        } else if (window.yotpo?.refreshWidgets) {
          window.yotpo?.refreshWidgets?.();
        }
      }, 100);
    }
  }, [yotpoProductId]);

  // Render the Yotpo Reviews Tab widget placeholder
  // Yotpo will automatically populate this with the floating tab
  return (
    <div
      className="yotpo-widget-instance"
      data-yotpo-instance-id="587405"
      data-yotpo-product-id={yotpoProductId || ''}
    />
  );
}

// Also exported as a named export so either import style resolves
// (`import ReviewsStickyTab from ...` or `import { ReviewsStickyTab } from ...`).
export { ReviewsStickyTab };
