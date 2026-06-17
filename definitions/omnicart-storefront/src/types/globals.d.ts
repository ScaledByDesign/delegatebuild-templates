/**
 * Ambient type declarations for the OmniCart storefront.
 *
 * 1. Third-party marketing/analytics globals injected via <script> tags
 *    (GTM, Google, Meta Pixel, Yotpo, Attentive, CustomerLabs). Declaring them
 *    here lets the app use `window.<global>` with types instead of `as any`.
 * 2. The storefront's own `VITE_*` environment variables, so `import.meta.env`
 *    reads are typed.
 */
export {};

declare global {
  interface Window {
    /** Google Tag Manager data layer. */
    dataLayer?: unknown[];
    /** Google Analytics gtag. */
    gtag?: (...args: unknown[]) => void;
    /** Meta (Facebook) Pixel. */
    fbq?: (...args: unknown[]) => void;
    /** CustomerLabs SDK. */
    _cl?: {
      trackClick?: (...args: unknown[]) => void;
      identify?: (...args: unknown[]) => void;
    } & Record<string, unknown>;
    customerlabs?: { track?: (...args: unknown[]) => void } & Record<string, unknown>;
    CLabsgbVar?: Record<string, unknown>;
    /** Yotpo reviews widget API. */
    yotpo?: {
      refreshWidgets?: () => void;
      navigate?: (...args: unknown[]) => void;
    } & Record<string, unknown>;
    yotpoWidgetsContainer?: { initWidgets?: () => void } & Record<string, unknown>;
    yotpoLoaded?: boolean;
    __vnsh_yotpo_product_id?: string;
    __vnsh_yotpo_product_url?: string;
    __vnsh_yotpo_product_name?: string;
    /** Attentive SMS analytics. */
    attentive?: {
      analytics?: Record<string, (...args: unknown[]) => void>;
    } & Record<string, unknown>;
  }

  interface ImportMetaEnv {
    readonly VITE_OMNICART_BACKEND_URL?: string;
    readonly VITE_OMNICART_PUBLISHABLE_KEY?: string;
    readonly VITE_OMNICART_SALES_CHANNEL_ID?: string;
    readonly VITE_OMNICART_REGION_ID?: string;
    readonly VITE_OMNICART_INVENTORY_LOCATION_ID?: string;
    readonly VITE_OMNICART_DISABLE_PROXY?: string;
    readonly VITE_OMNICART_ADMIN_URL?: string;
    readonly VITE_STRIPE_PUBLISHABLE_KEY?: string;
  }
}
