/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link, useSearchParams, useLocation } from "react-router-dom";
import { findRedirectByPathAndQuery } from "@/services/redirects";
import { useQuery } from "@tanstack/react-query";
import {
  Star,
  Minus,
  Plus,
  ShieldCheck,
  Info,
  Loader2,
} from "lucide-react";
import faqIcon from "@/assets/faq-original.png";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import ProductMediaGallery from "@/components/product/ProductMediaGallery";
import VariantSelector from "@/components/VariantSelector";
import MobileStickyVariations from "@/components/MobileStickyVariations";
import AddToCartButton from "@/components/AddToCartButton";
import { HeroBadges } from "@/components/product/HeroBadges";
import { HeroHighlights } from "@/components/product/HeroHighlights";
import { IncludedItems } from "@/components/product/IncludedItems";
import { HeroVideo } from "@/components/product/HeroVideo";
import { ValueProps } from "@/components/product/ValueProps";
import { Features } from "@/components/product/Features";
import { ProductSpecs } from "@/components/product/ProductSpecs";
import { useCart } from "@/hooks/useCart";
import { useCustomer } from "@/hooks/useCustomer";
import { useIsMobile } from "@/hooks/use-mobile";
import { getProductContent } from "@/lib/content/productContent";
import {
  getProductByHandle,
  MedusaProduct,
  MedusaProductVariant,
} from "@/services/medusa/products";
import { trackProductView } from "@/hooks/useTracking";
import { transformCdnUrl } from "@/lib/util/image-url";
import { sortProductOptions } from "@/lib/util/product-utils";
import JsonLd from "@/components/JsonLd";
import {
  generateProductJsonLd,
  generateBreadcrumbJsonLd,
  generateFaqJsonLd,
} from "@/lib/seo/structuredData";

/** Separate component so hooks run unconditionally (not after early returns) */
function ProductSeo({ product, selectedVariant, productContent }: {
  product: MedusaProduct
  selectedVariant?: MedusaProductVariant
  productContent: import("@/lib/content/productContent").ProductContent
}) {
  const { data: reviewSummary } = useQuery({
    queryKey: ['product-review-summary-seo', product.id],
    queryFn: () => import('@/services/medusa/reviews').then(m => m.getProductReviewSummary(product.id)),
    enabled: !!product.id,
    staleTime: 10 * 60 * 1000,
  });

  const productJsonLd = useMemo(
    () => generateProductJsonLd(product, selectedVariant, productContent, reviewSummary),
    [product, selectedVariant, productContent, reviewSummary]
  );

  const breadcrumbJsonLd = useMemo(
    () =>
      generateBreadcrumbJsonLd([
        { name: 'Home', url: 'https://vnsh.com/' },
        ...(product.collection
          ? [{ name: product.collection.title, url: `https://vnsh.com/collections/${product.collection.handle}` }]
          : []),
        { name: product.title, url: `https://vnsh.com/products/${product.handle}` },
      ]),
    [product.title, product.handle, product.collection]
  );

  const faqJsonLd = useMemo(() => {
    const metadata = product.metadata as Record<string, unknown> | undefined;
    const pdpSects = (metadata?.pdp_sections as any[] | undefined) || [];
    const faqSection = pdpSects.find((s: any) => s.type === 'faq');
    const faqItems: Array<{ question: string; answer: string }> = faqSection?.items || [];
    const staticFaq = productContent.faq || [];
    const allFaq = [...faqItems, ...staticFaq];
    return generateFaqJsonLd(allFaq);
  }, [product.metadata, productContent.faq]);

  return (
    <>
      <JsonLd data={productJsonLd} id="product" />
      <JsonLd data={breadcrumbJsonLd} id="breadcrumb" />
      {faqJsonLd && <JsonLd data={faqJsonLd} id="faq" />}
    </>
  );
}

const currencyFormatter = (amount?: number, currencyCode = "USD") => {
  if (amount === undefined || amount === null) return "";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(amount);
};

const isVariantAvailable = (variant?: MedusaProductVariant) => {
  if (!variant) return false;
  if (!variant.manage_inventory) return true;
  // Check actual inventory quantity first
  // If inventory_quantity is undefined or null when inventory is managed,
  // treat as out of stock to prevent selling unavailable items
  if (variant.inventory_quantity === undefined || variant.inventory_quantity === null) {
    return false;
  }
  // Only in stock if there's actual quantity
  return variant.inventory_quantity > 0;
};

/**
 * Check if product has meaningful variations or just a default variant
 * Returns true if product should show options/variations UI
 */
const hasProductVariations = (product?: MedusaProduct) => {
  if (!product?.variants?.length) return false;

  // If product has multiple variants, it has variations
  if (product.variants.length > 1) return true;

  // If product has only 1 variant, check if it's a "Default Title" variant
  const singleVariant = product.variants[0];
  const variantTitle = singleVariant.title?.toLowerCase().trim();

  // Hide options if the only variant is "Default Title"
  if (variantTitle === 'default title') return false;

  // Hide options when every option has only a single value (no real choice to make)
  const options = product.options || [];
  const allOptionsSingleVal = options.length > 0 && options.every((opt) => (opt.values?.length || 0) <= 1);
  if (allOptionsSingleVal) {
    return false;
  }

  // Show options if variant has a meaningful title or any option offers multiple values
  return true;
};

const ProductDetail: React.FC = () => {
  const { handle: handleParam, slug } = useParams<{ handle?: string; slug?: string }>();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const handle = (handleParam ?? slug ?? "").toLowerCase();

  // Query-string-conditional redirects (managed in the admin Redirects table).
  // The path-only redirect engine (RedirectHandler / redirect-checker.js) cannot
  // handle these: it never runs on real /products/:handle routes and ignores
  // query strings. So a variant URL like
  //   /products/vnsh-holster?size=Regular&color=American+Flag → /products/vnsh-holster-flag
  // must be resolved here. We check before rendering the product to avoid showing
  // the wrong page, then hard-navigate so the destination loads fresh.
  const [isRedirecting, setIsRedirecting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // No query string → nothing for the query-aware redirect to match.
    if (!location.search || location.search === "?") {
      return;
    }

    findRedirectByPathAndQuery(location.pathname, location.search)
      .then((redirect) => {
        if (cancelled || !redirect) return;
        setIsRedirecting(true);
        // destination_path may be an internal path or an absolute URL; both work
        // with location.replace, and replace() avoids leaving the variant URL in
        // history (consistent with a 301's intent).
        window.location.replace(redirect.destination_path);
      })
      .catch((err) => {
        console.error("Product redirect check failed:", err);
      });

    return () => {
      cancelled = true;
    };
  }, [location.pathname, location.search]);
  const { addItem } = useCart();
  const { customer } = useCustomer();
  const isMobile = useIsMobile();
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [isAdding, setIsAdding] = useState(false);
  const [initializedFromUrl, setInitializedFromUrl] = useState(false);

  const {
    data: product,
    isLoading,
    error,
  } = useQuery<MedusaProduct | null>({
    queryKey: ["product", handle],
    enabled: Boolean(handle),
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (!handle) return null;
      return getProductByHandle(handle);
    },
  });

  const productContent = useMemo(
    () => getProductContent(handle, product?.metadata as Record<string, unknown> | undefined),
    [handle, product?.metadata]
  );

  // Build and order all PDP sections
  // Note: 'faq' sections are now managed as 'custom' type via metadata.pdp_sections
  interface PDPSection {
    id: string;
    type: 'hero_video' | 'value_props' | 'features' | 'specs' | 'custom' | 'guarantee' | 'testimonials';
    order: number;
    enabled: boolean;
    customIndex?: number;
  }

  const pdpSections = useMemo(() => {
    const sections: PDPSection[] = [];
    const metadata = product?.metadata as Record<string, unknown> | undefined;
    const customSections = (metadata?.pdp_sections as any[] | undefined) || [];
    const metadataSections = customSections.map((section, index) => ({ section, index }));
    const filteredCustomSections = productContent.features?.length
      ? metadataSections.filter(({ section }) => section.type !== 'image_with_text')
      : metadataSections;

    let order = 1;

    // Add hardcoded marketing sections if they have data
    if (productContent.heroVideoUrl) {
      sections.push({
        id: 'hero_video',
        type: 'hero_video',
        order: order++,
        enabled: true,
      });
    }

    if (productContent.valueProps?.length) {
      sections.push({
        id: 'value_props',
        type: 'value_props',
        order: order++,
        enabled: true,
      });
    }

    if (productContent.features?.length) {
      sections.push({
        id: 'features',
        type: 'features',
        order: order++,
        enabled: true,
      });
    }

    if (productContent.specList?.length || productContent.bulletFeatures?.length) {
      sections.push({
        id: 'specs',
        type: 'specs',
        order: order++,
        enabled: true,
      });
    }

    // Add custom PDP sections from metadata with deduplication
    const seenSections = new Set<string>();
    filteredCustomSections.forEach(({ section, index }) => {
      // Create a unique key based on section content to detect duplicates
      const sectionKey = JSON.stringify({
        type: section.type,
        title: section.title,
        body_html: section.body_html,
        image: section.image,
        url: section.url,
        html: section.html,
      });

      // Only add section if we haven't seen this exact content before
      if (!seenSections.has(sectionKey)) {
        seenSections.add(sectionKey);
        sections.push({
          id: `custom_${index}`,
          type: 'custom',
          order: order++,
          enabled: true,
          customIndex: index,
        });
      }
    });

    // Add special sections if they have data
    if (productContent.guarantee) {
      sections.push({
        id: 'guarantee',
        type: 'guarantee',
        order: order++,
        enabled: true,
      });
    }

    if (productContent.testimonials?.length) {
      sections.push({
        id: 'testimonials',
        type: 'testimonials',
        order: order++,
        enabled: true,
      });
    }

    // FAQs are now managed exclusively via Admin UI in metadata.pdp_sections
    // No fallback static FAQ section - all FAQs come from the 'custom' section type

    return sections;
  }, [product?.metadata, productContent]);

  // Update SEO metadata in document head
  useEffect(() => {
    if (!product) return;

    const metadata = product.metadata as Record<string, unknown> | undefined;
    const seoTitle = (metadata?.shopify_seo as any)?.title || product.title;
    const seoDescription = (metadata?.shopify_seo as any)?.description || product.description || '';
    const productImage = product.thumbnail || product.images?.[0]?.url || '';
    const productUrl = `https://vnsh.com/products/${product.handle}`;

    // Helper to set or create a meta tag
    const setMeta = (attr: string, key: string, content: string) => {
      let el = document.querySelector(`meta[${attr}="${key}"]`);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    // Update document title
    document.title = `${seoTitle} - VNSH`;

    // Standard meta
    setMeta('name', 'description', seoDescription);

    // Open Graph
    setMeta('property', 'og:title', `${seoTitle} - VNSH`);
    setMeta('property', 'og:description', seoDescription);
    setMeta('property', 'og:type', 'product');
    setMeta('property', 'og:url', productUrl);
    if (productImage) {
      setMeta('property', 'og:image', productImage.startsWith('http') ? productImage : `https://vnsh.com${productImage}`);
    }

    // Product-specific OG tags (used by Facebook/Pinterest for shopping)
    const firstVariant = product.variants?.[0];
    if (firstVariant) {
      const price = firstVariant.calculated_price?.calculated_amount ?? firstVariant.prices?.[0]?.amount;
      const currency = firstVariant.calculated_price?.currency_code ?? firstVariant.prices?.[0]?.currency_code ?? 'USD';
      if (price !== undefined) {
        setMeta('property', 'product:price:amount', price.toFixed(2));
        setMeta('property', 'product:price:currency', currency.toUpperCase());
      }

      const inStock = !firstVariant.manage_inventory ||
        (firstVariant.inventory_quantity !== undefined && firstVariant.inventory_quantity !== null && firstVariant.inventory_quantity > 0);
      setMeta('property', 'product:availability', inStock ? 'in stock' : 'out of stock');
    }

    // Twitter Card
    setMeta('name', 'twitter:title', `${seoTitle} - VNSH`);
    setMeta('name', 'twitter:description', seoDescription);
    if (productImage) {
      setMeta('name', 'twitter:image', productImage.startsWith('http') ? productImage : `https://vnsh.com${productImage}`);
    }

    // Canonical URL (no query params — variant params are UI state, not separate pages)
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', productUrl);
  }, [product]);

  // Calculate selected variant (must be before useEffects that use it)
  const selectedVariant = useMemo(() => {
    if (!product?.variants?.length) return undefined;
    const matchingVariant = product.variants.find((variant) => {
      const variantOptions = variant.options ?? [];
      return product.options?.every((option) => {
        const variantValue = variantOptions.find((opt) => opt.option_id === option.id)?.value;
        if (!variantValue) return true;
        return selectedOptions[option.id] === variantValue;
      });
    });

    return matchingVariant ?? product.variants[0];
  }, [product?.variants, product?.options, selectedOptions]);

  const selectedVariantAvailable = isVariantAvailable(selectedVariant);

  // Track product view when product is loaded
  useEffect(() => {
    if (product && selectedVariant) {
      trackProductView({
        id: product.id,
        title: product.title,
        price: selectedVariant.calculated_price || 0,
        category: product.collection?.title || undefined,
        variant_id: selectedVariant.id,
        // Only include image_url if we have a value (Attentive best practice: avoid empty strings)
        image_url: product.thumbnail || product.images?.[0]?.url || undefined,
        // customer_id (when signed in) drives the server-side
        // /store/products/:id/track-view → Attentive "Product Viewed"
        // custom event so the trigger matches the other 3 server-side
        // events (Added to Cart / Started Checkout / Order Placed).
        customer_id: customer?.id || undefined,
      });
    }
  }, [product?.id, selectedVariant?.id, customer?.id]);

  // Initialize options from URL parameters or fall back to first values
  useEffect(() => {
    if (!product?.options?.length || initializedFromUrl) return;

    const urlOptions: Record<string, string> = {};

    // Support ?variant_id=xxx for direct variant linking by ID
    const variantIdParam = searchParams.get('variant_id');
    if (variantIdParam) {
      const variant = product.variants?.find(v => v.id === variantIdParam);
      if (variant?.options) {
        variant.options.forEach(opt => {
          urlOptions[opt.option_id] = opt.value;
        });
      }
    } else {
      // Support ?size=Small&color=Black format (option title as key)
      product.options.forEach((option) => {
        // Try lowercase version of option title (e.g., ?size=Small)
        const urlValue = searchParams.get(option.title.toLowerCase());
        if (urlValue) {
          // Find matching value (case-insensitive)
          const matchingValue = option.values?.find(
            v => v.value.toLowerCase() === urlValue.toLowerCase()
          );
          if (matchingValue) {
            urlOptions[option.id] = matchingValue.value;
          }
        }
      });
    }

    // Check if we found any URL options
    const hasUrlOptions = Object.keys(urlOptions).length > 0;

    setSelectedOptions((prev) => {
      const next: Record<string, string> = { ...prev };
      product.options.forEach((option) => {
        // Priority: URL param > existing selection > first value
        if (urlOptions[option.id]) {
          next[option.id] = urlOptions[option.id];
        } else if (!next[option.id] && option.values?.length) {
          next[option.id] = option.values[0].value;
        }
      });
      return next;
    });

    if (hasUrlOptions) {
      setInitializedFromUrl(true);
    }
  }, [product?.options, product?.variants, searchParams, initializedFromUrl]);

  useEffect(() => {
    if (!product?.images?.length) return;
    if (selectedImage >= product.images.length) {
      setSelectedImage(0);
    }
  }, [product?.images, selectedImage]);

  // Reset selected image when variant changes (for variant-specific images)
  const previousVariantId = useRef<string | undefined>(undefined);
  useEffect(() => {
    // Only reset if variant actually changed (not on initial load)
    if (previousVariantId.current && selectedVariant?.id !== previousVariantId.current) {
      // Check if the new variant has different images than the previous variant
      const variantHasImages = selectedVariant?.images && selectedVariant.images.length > 0;
      if (variantHasImages) {
        setSelectedImage(0);
      }
    }
    previousVariantId.current = selectedVariant?.id;
  }, [selectedVariant?.id, selectedVariant?.images]);

  // Sync URL when variant selection changes (for shareable links)
  useEffect(() => {
    if (!product?.options?.length || !initializedFromUrl) return;

    // Build new URL params from current selections
    const newParams = new URLSearchParams();

    // Update URL with current option selections
    product.options.forEach((option) => {
      const selectedValue = selectedOptions[option.id];
      const paramKey = option.title.toLowerCase();
      if (selectedValue) {
        newParams.set(paramKey, selectedValue);
      }
    });

    // Use replaceState to avoid adding to browser history on every change
    const newUrl = newParams.toString()
      ? `${window.location.pathname}?${newParams.toString()}`
      : window.location.pathname;

    window.history.replaceState({}, '', newUrl);
  }, [selectedOptions, product?.options, initializedFromUrl]);

  // Handle deep linking to FAQ questions
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1);
      if (hash) {
        setTimeout(() => {
          const element = document.getElementById(hash);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
            // If it's an FAQ question, open the accordion
            const accordionTrigger = element.closest('[data-state]');
            if (accordionTrigger && accordionTrigger.getAttribute('data-state') === 'closed') {
              (element as HTMLElement).click();
            }
          }
        }, 100);
      }
    };

    // Handle initial hash on page load
    if (window.location.hash) {
      handleHashChange();
    }

    // Listen for hash changes
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [productContent.faq]);

  const metadata = (product?.metadata as Record<string, unknown> | undefined) ?? undefined;
  const shopifyImageMap = metadata?.shopify_image_map as Record<string, string> | undefined;

  const galleryImages = useMemo(() => {
    // Priority 1: Use variant-specific images if the selected variant has them (Medusa 2.12+)
    // Put the variant thumbnail first if it exists
    const variantImages = selectedVariant?.images;
    const variantThumbnail = selectedVariant?.thumbnail;
    if (variantImages && variantImages.length > 0) {
      const transformedImages = variantImages.map((image) => transformCdnUrl(image.url));

      // If variant has a thumbnail, ensure it's shown first
      if (variantThumbnail) {
        const thumbnailUrl = transformCdnUrl(variantThumbnail);
        // Remove thumbnail from its current position (if present) and put it first
        const imagesWithoutThumbnail = transformedImages.filter((url) => url !== thumbnailUrl);
        return [thumbnailUrl, ...imagesWithoutThumbnail];
      }

      return transformedImages;
    }

    // Priority 2: Use product-level images from Medusa
    const medusaImages = product?.images?.map((image) => transformCdnUrl(image.url)) ?? [];
    if (medusaImages.length > 0) {
      return medusaImages;
    }

    // Priority 3: Use Shopify image map from metadata (legacy/migration support)
    if (shopifyImageMap && Object.keys(shopifyImageMap).length > 0) {
      return Object.keys(shopifyImageMap)
        .sort()
        .map((key) => transformCdnUrl(shopifyImageMap[key]))
        .filter(Boolean);
    }

    // Priority 4: Use product thumbnail
    if (product?.thumbnail) {
      return [transformCdnUrl(product.thumbnail)];
    }

    // Priority 5: Use feature images as last resort
    const fallback = (productContent.features ?? [])
      .map((feature) => feature.image ? transformCdnUrl(feature.image) : null)
      .filter((image): image is string => Boolean(image));

    return fallback.length ? fallback : [];
  }, [selectedVariant?.images, selectedVariant?.thumbnail, product?.images, product?.thumbnail, productContent.features, shopifyImageMap]);

  const productMetadata = (product?.metadata as Record<string, unknown> | undefined) ?? undefined;
  const yotpoProductId = typeof productMetadata?.shopify_product_id === "string"
    ? (productMetadata.shopify_product_id as string)
    : undefined;

  const descriptionHtml = useMemo(
    () => {
      const contentDescription = typeof productContent.descriptionHtml === "string"
        ? productContent.descriptionHtml.trim()
        : "";

      const metadataDescriptionHtml = typeof productMetadata?.description_html === "string"
        ? (productMetadata.description_html as string).trim()
        : "";

      const metadataDescription = typeof productMetadata?.description === "string"
        ? (productMetadata.description as string).trim()
        : "";

      const productDescription = typeof product?.description === "string"
        ? product.description.trim()
        : "";

      // Admin/Medusa sources take priority over static generated content
      let raw = metadataDescriptionHtml
        || metadataDescription
        || productDescription
        || contentDescription
        || "";

      if (!raw) return "";

      // Decode HTML entities in case Medusa escaped the HTML tags
      if (raw.includes("&lt;") || raw.includes("&gt;")) {
        const el = document.createElement("textarea");
        el.innerHTML = raw;
        raw = el.value;
      }

      // If the description contains HTML tags, return as-is for dangerouslySetInnerHTML.
      // If it looks like plain text (no tags), wrap in <p> so prose styling applies.
      if (/<[a-z][\s\S]*>/i.test(raw)) return raw;
      return `<p>${raw}</p>`;
    },
    [product?.description, productContent.descriptionHtml, productMetadata?.description, productMetadata?.description_html]
  );

  // Check if product has meaningful variations (not just "Default Title")
  const showVariations = useMemo(() => hasProductVariations(product), [product]);

  // Sort option values (sizes in natural order, custom order from metadata)
  const sortedOptions = useMemo(
    () => sortProductOptions(product?.options ?? [], productMetadata),
    [product?.options, productMetadata]
  );

  // Broadcast Yotpo product ID to ReviewsStickyTab
  useEffect(() => {
    if (yotpoProductId) {
      // Store globally for the reviews drawer to access
      window.__vnsh_yotpo_product_id = yotpoProductId;
      window.__vnsh_yotpo_product_name = product?.title || handle;
      window.__vnsh_yotpo_product_url = `https://vnsh.com/products/${handle}`;

      // Dispatch event for components listening
      window.dispatchEvent(new CustomEvent('vnsh:yotpo-product-change', {
        detail: {
          productId: yotpoProductId,
          productName: product?.title || handle,
          productUrl: `https://vnsh.com/products/${handle}`
        }
      }));
    } else {
      // Clear when no product
      window.__vnsh_yotpo_product_id = undefined;
    }
  }, [yotpoProductId, product?.title, handle]);

  const availableOptions = useMemo(() => {
    if (!product?.options?.length || !product?.variants?.length) return {};

    const availabilityMap: Record<string, string[]> = {};

    product.options.forEach((option) => {
      const otherOptionIds = product.options
        .filter((opt) => opt.id !== option.id)
        .map((opt) => opt.id);

      const allowedValues = new Set<string>();

      product.variants.forEach((variant) => {
        if (!isVariantAvailable(variant)) return;
        const variantOptions = variant.options ?? [];

        const matchesOtherSelections = otherOptionIds.every((otherOptionId) => {
          const selectedValue = selectedOptions[otherOptionId];
          if (!selectedValue) return true;
          const variantValue = variantOptions.find((opt) => opt.option_id === otherOptionId)?.value;
          return variantValue === selectedValue;
        });

        if (!matchesOtherSelections) return;

        const value = variantOptions.find((opt) => opt.option_id === option.id)?.value;
        if (value) {
          allowedValues.add(value);
        }
      });

      if (allowedValues.size === 0 && option.values) {
        option.values.forEach((value) => allowedValues.add(value.value));
      }

      availabilityMap[option.id] = Array.from(allowedValues);
    });

    return availabilityMap;
  }, [product?.options, product?.variants, selectedOptions]);

  const priceInfo = useMemo(() => {
    if (!selectedVariant) {
      return { current: 0, original: 0, currency: "USD" };
    }

    const currency =
      selectedVariant.calculated_price?.currency_code ??
      selectedVariant.prices?.[0]?.currency_code ??
      "USD";

    const current =
      selectedVariant.calculated_price?.calculated_amount ??
      selectedVariant.prices?.[0]?.amount ??
      0;

    const original =
      selectedVariant.calculated_price?.original_amount ??
      selectedVariant.prices?.[0]?.amount ??
      current;

    return { current, original, currency };
  }, [selectedVariant]);

  const handleOptionChange = (optionId: string, value: string) => {
    setSelectedOptions((prev) => ({ ...prev, [optionId]: value }));
  };

  const incrementQuantity = () => setQuantity((prev) => prev + 1);
  const decrementQuantity = () => setQuantity((prev) => (prev > 1 ? prev - 1 : prev));

  const handleQuantityInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(event.target.value);
    if (!Number.isNaN(value) && value > 0) {
      setQuantity(value);
    }
  };

  const handleAddToCart = async () => {
    if (!selectedVariant || !selectedVariantAvailable) return;

    try {
      setIsAdding(true);
      await addItem(selectedVariant.id, quantity);
    } finally {
      setIsAdding(false);
    }
  };

  const handleNextImage = () => {
    if (!galleryImages.length) return;
    setSelectedImage((prev) => (prev + 1) % galleryImages.length);
  };

  const handlePrevImage = () => {
    if (!galleryImages.length) return;
    setSelectedImage((prev) => (prev - 1 + galleryImages.length) % galleryImages.length);
  };

  // A query-conditional redirect matched — render a blank screen while the
  // hard navigation to the destination completes (prevents a flash of the
  // wrong product page).
  if (isRedirecting) {
    return <div style={{ minHeight: "100vh", backgroundColor: "#ffffff" }} />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <Navbar />
        <main className="flex-grow flex items-center justify-center">
          <div className="flex flex-col items-center text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-vnsh-red" />
            <p className="text-gray-600">Loading product…</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <Navbar />
        <main className="flex-grow flex items-center justify-center">
          <div className="text-center space-y-4">
            <Info className="h-10 w-10 mx-auto text-gray-400" />
            <h1 className="text-2xl font-semibold text-gray-900">Product not found</h1>
            <p className="text-gray-600 max-w-md mx-auto">
              We couldn’t find the product you were looking for. Please explore our collections to discover more gear.
            </p>
            <Button asChild>
              <Link to="/collections/products">Browse all products</Link>
            </Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const subtotalDisplay = currencyFormatter(priceInfo.current * quantity, priceInfo.currency);
  const subtotalAmount = priceInfo.current * quantity;
  const priceDisplay = currencyFormatter(priceInfo.current, priceInfo.currency);
  const compareAtDisplay = priceInfo.original > priceInfo.current
    ? currencyFormatter(priceInfo.original, priceInfo.currency)
    : null;

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <ProductSeo product={product} selectedVariant={selectedVariant} productContent={productContent} />
      <Navbar />
      <main className="flex-grow w-full max-w-full overflow-x-hidden">
        <section className="bg-white border-b border-gray-100">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="grid gap-4 md:gap-8 lg:gap-12 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] items-start">
              <ProductMediaGallery
                images={galleryImages}
                selectedIndex={selectedImage}
                onSelect={setSelectedImage}
                onNext={handleNextImage}
                onPrev={handlePrevImage}
              />

              <aside className="space-y-8 lg:sticky lg:top-24">
                <HeroBadges badges={productContent.heroBadges} variant="inline" />

                <header className="space-y-3">
                  <div className="space-y-2">
                    <h1
                      className="uppercase text-2xl md:text-3xl lg:text-[40px] leading-tight md:leading-[1.15] tracking-[0.6px] text-[#121212]"
                      style={{ marginBottom: 0 }}
                    >
                      {product.title}
                    </h1>
                    <div className="flex items-baseline gap-4">
                      <span
                        className="text-base md:text-lg text-vnsh-red"
                        style={{
                          fontWeight: '300'
                        }}
                      >
                        {priceDisplay}
                      </span>
                      {compareAtDisplay ? (
                        <span className="text-base md:text-lg text-gray-400 line-through">{compareAtDisplay}</span>
                      ) : null}
                    </div>
                    <p className="text-sm text-gray-600">Shipping calculated at checkout.</p>
                  </div>

                  {/* Yotpo Star Ratings Widget - matches production placement */}
                  {yotpoProductId && (
                    <div
                      className="yotpo-widget-instance"
                      data-yotpo-instance-id="470984"
                      data-yotpo-product-id={yotpoProductId}
                      data-yotpo-section-id="product"
                      data-testid="yotpo-summary"
                    />
                  )}
                </header>

                <div className="space-y-6">
                  {descriptionHtml ? (
                    <div
                      className="prose prose-sm max-w-none text-gray-700 [&>p]:mb-4 [&>p:last-child]:mb-0 [&>strong]:font-semibold [&>em]:italic"
                      dangerouslySetInnerHTML={{ __html: descriptionHtml }}
                    />
                  ) : null}

                  <HeroHighlights highlights={productContent.heroHighlights} />

                  <div className="space-y-6">
                    {/* Desktop/Large layout */}
                    <div className="hidden md:block space-y-6">
                      {showVariations && (
                        <VariantSelector
                          options={sortedOptions}
                          selectedOptions={selectedOptions}
                          availableOptions={availableOptions}
                          onOptionChange={handleOptionChange}
                        />
                      )}

                      <div className="space-y-3">
                        <div>
                          <span className="text-sm font-semibold uppercase tracking-wide text-gray-900">Quantity</span>
                          <div className="mt-3 flex items-center gap-4">
                            <div className="inline-flex items-center rounded-full border border-gray-300 bg-white px-2">
                              <button
                                type="button"
                                onClick={decrementQuantity}
                                className="h-10 w-10 text-lg font-semibold text-gray-700"
                                aria-label="Decrease quantity"
                              >
                                <Minus className="mx-auto h-4 w-4" />
                              </button>
                              <Input
                                id="quantity"
                                type="number"
                                min={1}
                                value={quantity}
                                onChange={handleQuantityInput}
                                className="w-16 border-0 text-center text-lg font-semibold focus-visible:ring-0"
                              />
                              <button
                                type="button"
                                onClick={incrementQuantity}
                                className="h-10 w-10 text-lg font-semibold text-gray-700"
                                aria-label="Increase quantity"
                              >
                                <Plus className="mx-auto h-4 w-4" />
                              </button>
                            </div>
                            <span className="text-sm text-gray-500">Subtotal: {subtotalDisplay}</span>
                          </div>
                        </div>

                        <AddToCartButton
                          onClick={handleAddToCart}
                          disabled={!selectedVariantAvailable}
                          isLoading={isAdding}
                          isSoldOut={!selectedVariantAvailable}
                          price={subtotalAmount}
                          showPrice={false}
                          size="lg"
                          fullWidth={true}
                        />
                      </div>
                    </div>



                    {productContent.faq?.length ? (
                      <div className="mt-4">
                        <button
                          type="button"
                          className="hover:opacity-80 transition-opacity cursor-pointer"
                          onClick={() => {
                            const faqSection = document.getElementById('faq');
                            if (faqSection) {
                              faqSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                              if (typeof window !== 'undefined' && window.gtag) {
                                window.gtag('event', 'faq_button_click', {
                                  event_category: 'Product',
                                  event_label: product.title,
                                  page_title: document.title
                                });
                              }
                            }
                          }}
                        >
                          <img
                            src={faqIcon}
                            alt="see FAQ"
                            className="block"
                            style={{ width: "51px", height: "auto" }}
                          />
                        </button>
                      </div>
                    ) : null}
                  </div>

                  <HeroBadges badges={productContent.heroBadges} variant="grid" />

                  <IncludedItems items={productContent.includedItems} />
                </div>
              </aside>
            </div>
          </div>
        </section>

        {/* Render all PDP sections in order from pdpSections array */}
        {pdpSections
          .filter((section) => section.enabled)
          .sort((a, b) => a.order - b.order)
          .map((section) => {
            switch (section.type) {
              case 'hero_video':
                return <HeroVideo key={section.id} videoUrl={productContent.heroVideoUrl} />;

              case 'value_props':
                return <ValueProps key={section.id} props={productContent.valueProps} />;

              case 'features':
                return <Features key={section.id} features={productContent.features} />;

              case 'specs':
                return (
                  <ProductSpecs
                    key={section.id}
                    specs={productContent.specList}
                    bulletFeatures={productContent.bulletFeatures}
                  />
                );

              case 'custom': {
                const customSection = product?.metadata?.pdp_sections?.[section.customIndex!];
                if (!customSection) return null;

                if (customSection.type === 'image_with_text') {
                  return (
                    <section
                      key={section.id}
                      className={`${section.order % 2 === 0 ? 'bg-white' : 'bg-[#f9f6f1]'} py-16`}
                    >
                      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div
                          className={`grid grid-cols-1 lg:grid-cols-2 gap-12 items-center ${
                            customSection.align === 'right' ? 'lg:flex-row-reverse' : ''
                          }`}
                        >
                          {customSection.image ? (
                            <div
                              className={`${customSection.align === 'right' ? 'lg:order-2' : ''}`}
                            >
                              <img
                                src={transformCdnUrl(customSection.image)}
                                alt={customSection.title || 'Section image'}
                                className="w-full rounded-2xl object-cover shadow-xl"
                              />
                            </div>
                          ) : null}
                          <div
                            className={`${
                              customSection.align === 'right' ? 'lg:order-1' : ''
                            } space-y-4`}
                          >
                            {customSection.title ? (
                              <h2
                                className="uppercase text-2xl md:text-3xl lg:text-[40px] leading-tight md:leading-[1.2] tracking-[0.6px] text-[#121212]"
                              >
                                {customSection.title}
                              </h2>
                            ) : null}
                            {customSection.body_html ? (
                              <div
                                className="text-lg text-gray-700 leading-relaxed [&>p]:mb-4 [&>p:last-child]:mb-0"
                                dangerouslySetInnerHTML={{ __html: customSection.body_html }}
                              />
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </section>
                  );
                } else if (customSection.type === 'video') {
                  // Skip rendering if this video URL matches the heroVideoUrl (prevent duplicates)
                  if (customSection.url === productContent.heroVideoUrl) {
                    return null;
                  }
                  return (
                    <section key={section.id} className="bg-[#f9f6f1] py-12">
                      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="aspect-video rounded-2xl overflow-hidden shadow-lg border border-gray-200">
                          <iframe
                            title={customSection.title || `Section ${section.order} video`}
                            src={customSection.url}
                            className="w-full h-full"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            allowFullScreen
                          />
                        </div>
                      </div>
                    </section>
                  );
                } else if (customSection.type === 'html') {
                  return (
                    <section key={section.id} className="bg-white py-16">
                      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div
                          className="prose prose-lg max-w-none"
                          dangerouslySetInnerHTML={{ __html: customSection.html }}
                        />
                      </div>
                    </section>
                  );
                } else if (customSection.type === 'faq') {
                  const faqItems = customSection.items || [];
                  return faqItems.length ? (
                    <section key={section.id} className="bg-[#121212] py-9" id="faq">
                      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="text-center mb-8 space-y-2">
                          <p className="uppercase tracking-[1.3px] text-xl font-light text-white/75">{product.title}</p>
                          <h2
                            className="uppercase text-2xl md:text-3xl lg:text-[40px] leading-tight md:leading-[1.2] tracking-[0.6px] text-white font-normal"
                          >
                            {customSection.title || 'Frequently Asked Questions'}
                          </h2>
                        </div>
                        <Accordion type="single" collapsible className="">
                          {faqItems.map((item: any, index: number) => {
                            const questionText = item.question?.trim() || '';
                            const answerText = item.answer?.trim() || '';
                            const hasQPrefix = /^Q[.:]/i.test(questionText);
                            const hasAPrefix = /^A[.:]/i.test(answerText);
                            return (
                              <AccordionItem
                                key={index}
                                value={`item-${index}`}
                                className={`border-0 border-t border-white/10 px-0 ${index === faqItems.length - 1 ? 'border-b' : ''}`}
                              >
                                <AccordionTrigger className="hover:no-underline py-4 text-white [&>svg]:text-white">
                                  <span className="text-left text-lg font-normal text-white">{hasQPrefix ? questionText : `Q. ${questionText}`}</span>
                                </AccordionTrigger>
                                <AccordionContent className="text-white/75 text-xl font-light pb-4 px-1.5">
                                  {hasAPrefix ? answerText : `A. ${answerText}`}
                                </AccordionContent>
                              </AccordionItem>
                            );
                          })}
                        </Accordion>
                      </div>
                    </section>
                  ) : null;
                }
                return null;
              }

              case 'guarantee':
                return productContent.guarantee ? (
                  <section key={section.id} className="bg-white py-16">
                    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-center">
                      <div className="rounded-2xl border border-gray-200 p-6 space-y-4 bg-[#f9f6f1] max-w-2xl w-full">
                        <div className="flex items-center gap-3">
                          <ShieldCheck className="h-6 w-6 text-vnsh-red" />
                          <h3 className="text-xl font-semibold uppercase tracking-wide text-gray-900">
                            {productContent.guarantee.title}
                          </h3>
                        </div>
                        <div className="space-y-3 text-sm text-gray-700">
                          {productContent.guarantee.paragraphs.map((paragraph) => (
                            <p key={paragraph}>{paragraph}</p>
                          ))}
                        </div>
                      </div>
                    </div>
                  </section>
                ) : null;

              case 'testimonials':
                return productContent.testimonials?.length ? (
                  <section key={section.id} className="bg-[#0b0b0d] py-16 text-white">
                    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                      <div className="text-center mb-12 space-y-3">
                        <p className="uppercase tracking-[0.3em] text-sm text-white/60">Testimonials</p>
                        <h2
                          className="uppercase text-2xl md:text-3xl lg:text-[40px] leading-tight md:leading-[1.2] tracking-[0.6px] text-white"
                        >
                          Real Carriers. Real Reviews.
                        </h2>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {productContent.testimonials.map((testimonial) => (
                          <div
                            key={`${testimonial.author}-${testimonial.text}`}
                            className="rounded-2xl bg-white/10 backdrop-blur border border-white/20 p-6 space-y-4"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 rounded-full bg-white/20" />
                              <div>
                                <p className="font-semibold">{testimonial.author}</p>
                                <p className="text-sm text-white/60">{testimonial.title}</p>
                              </div>
                            </div>
                            <p className="text-sm leading-relaxed">{testimonial.text}</p>
                            <div className="flex gap-1">
                              {[...Array(testimonial.rating || 5)].map((_, i) => (
                                <Star
                                  key={i}
                                  className="h-4 w-4 fill-yellow-400 text-yellow-400"
                                />
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>
                ) : null;

              // Note: 'faq' type sections are now only rendered via the 'custom' case above
              // when section.type === 'faq' from metadata.pdp_sections

              default:
                return null;
            }
          })}

        {/* Yotpo Reviews Main Widget - Full reviews section at bottom of PDP */}
        {yotpoProductId && (
          <section className="bg-white py-16" id="reviews">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center mb-12 space-y-3">
                <p className="uppercase tracking-[0.3em] text-sm text-gray-600">Reviews</p>
                <h2 className="uppercase text-2xl md:text-3xl lg:text-[40px] leading-tight md:leading-[1.2] tracking-[0.6px] text-[#121212]">
                  Customer Reviews
                </h2>
              </div>
              <div
                className="yotpo-widget-instance"
                data-yotpo-instance-id="470985"
                data-yotpo-product-id={yotpoProductId}
                data-yotpo-name={product?.title || ''}
                data-yotpo-url={`https://vnsh.com/products/${handle}`}
              />
            </div>
          </section>
        )}
      </main>

      <Footer />

      {isMobile && selectedVariant && (
        <MobileStickyVariations
          productName={product.title}
          price={priceInfo.current}
          productImage={galleryImages[0] || ""}
          options={showVariations ? sortedOptions : []}
          selectedOptions={selectedOptions}
          availableOptions={availableOptions}
          quantity={quantity}
          onOptionChange={handleOptionChange}
          onQuantityChange={setQuantity}
          onAddToCart={handleAddToCart}
          disabled={!selectedVariantAvailable || isAdding}
          isLoading={isAdding}
          isSoldOut={!selectedVariantAvailable}
        />
      )}
    </div>
  );
};

export default ProductDetail;
