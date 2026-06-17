import type { OmnicartProduct, OmnicartProductVariant } from '@/services/omnicart/products';
import type { ProductContent } from '@/lib/content/productContent';
import type { ReviewSummary } from '@/services/omnicart/reviews';

const SITE_URL = 'https://vnsh.com';
const BRAND_NAME = 'VNSH Holster';
const LOGO_URL = `${SITE_URL}/lovable-uploads/3fdac295-cd6c-45d0-80f6-0c5f1b3e35ec.png`;

function resolveImageUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('http')) return url;
  return `${SITE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}

/**
 * Product + Offer structured data for Google Rich Results.
 * Generates schema.org/Product with Offer or AggregateOffer.
 */
export function generateProductJsonLd(
  product: OmnicartProduct,
  selectedVariant?: OmnicartProductVariant,
  productContent?: ProductContent,
  reviewSummary?: ReviewSummary | null
): Record<string, unknown> {
  const productUrl = `${SITE_URL}/products/${product.handle}`;
  const description = product.description
    ? stripHtml(product.description)
    : productContent?.descriptionHtml
      ? stripHtml(productContent.descriptionHtml)
      : undefined;

  // Collect all images
  const images = product.images?.map(img => resolveImageUrl(img.url)).filter(Boolean) ?? [];
  if (!images.length && product.thumbnail) {
    const thumb = resolveImageUrl(product.thumbnail);
    if (thumb) images.push(thumb);
  }

  // Build offers from variants
  const offers = product.variants
    ?.map((variant) => {
      const price =
        variant.calculated_price?.calculated_amount ??
        variant.prices?.[0]?.amount ??
        0;
      const currency =
        variant.calculated_price?.currency_code ??
        variant.prices?.[0]?.currency_code ??
        'USD';

      // Match storefront logic: when inventory is managed,
      // null/undefined quantity = out of stock (API didn't expose it)
      let inStock = true;
      if (variant.manage_inventory) {
        if (variant.inventory_quantity === undefined || variant.inventory_quantity === null) {
          inStock = false;
        } else {
          inStock = variant.inventory_quantity > 0;
        }
      }

      const offer: Record<string, unknown> = {
        '@type': 'Offer',
        url: productUrl,
        priceCurrency: currency.toUpperCase(),
        price: price.toFixed(2),
        availability: inStock
          ? 'https://schema.org/InStock'
          : 'https://schema.org/OutOfStock',
        seller: {
          '@type': 'Organization',
          name: BRAND_NAME,
        },
      };

      if (variant.sku) {
        offer.sku = variant.sku;
      }

      return offer;
    })
    .filter(Boolean) ?? [];

  // Use single Offer if only one variant, otherwise AggregateOffer
  let offersSchema: Record<string, unknown>;
  if (offers.length === 1) {
    offersSchema = offers[0];
  } else if (offers.length > 1) {
    const prices = offers.map((o) => parseFloat(o.price as string));
    const lowPrice = Math.min(...prices);
    const highPrice = Math.max(...prices);
    const currency = (offers[0].priceCurrency as string) || 'USD';

    offersSchema = {
      '@type': 'AggregateOffer',
      lowPrice: lowPrice.toFixed(2),
      highPrice: highPrice.toFixed(2),
      priceCurrency: currency,
      offerCount: offers.length,
      offers,
    };
  } else {
    offersSchema = {
      '@type': 'Offer',
      url: productUrl,
      priceCurrency: 'USD',
      price: '0.00',
      availability: 'https://schema.org/OutOfStock',
    };
  }

  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    url: productUrl,
    brand: {
      '@type': 'Brand',
      name: BRAND_NAME,
    },
    offers: offersSchema,
  };

  if (description) {
    jsonLd.description = description;
  }

  if (images.length) {
    jsonLd.image = images;
  }

  // Add SKU from selected variant or first variant
  const sku = selectedVariant?.sku ?? product.variants?.[0]?.sku;
  if (sku) {
    jsonLd.sku = sku;
  }

  // Add category from collection
  if (product.collection?.title) {
    jsonLd.category = product.collection.title;
  }

  // Add aggregate rating from review summary
  if (reviewSummary && reviewSummary.total_reviews > 0) {
    jsonLd.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: reviewSummary.average_rating.toFixed(1),
      reviewCount: reviewSummary.total_reviews,
      bestRating: '5',
      worstRating: '1',
    };
  }

  return jsonLd;
}

/**
 * BreadcrumbList structured data.
 * Uses `item` as `@id` URL so the Rich Results Test can resolve each entry.
 */
export function generateBreadcrumbJsonLd(
  items: Array<{ name: string; url?: string }>
): Record<string, unknown> {
  const valid = items.filter(i => i.name?.trim());
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: valid.map((item, index) => {
      const entry: Record<string, unknown> = {
        '@type': 'ListItem',
        position: index + 1,
        name: item.name,
      };
      if (item.url) {
        entry.item = item.url;
      }
      return entry;
    }),
  };
}

/**
 * FAQPage structured data from product FAQ content.
 * Filters out items with empty question/answer to avoid "unnamed item" in
 * the Rich Results Test.
 */
export function generateFaqJsonLd(
  faqItems: Array<{ question: string; answer: string }>
): Record<string, unknown> | null {
  const valid = faqItems.filter(
    (item) => item.question?.trim() && item.answer?.trim()
  );
  if (!valid.length) return null;

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: valid.map((item) => ({
      '@type': 'Question',
      name: item.question.trim(),
      acceptedAnswer: {
        '@type': 'Answer',
        text: stripHtml(item.answer),
      },
    })),
  };
}

/**
 * CollectionPage / ItemList structured data for collection pages.
 */
export function generateCollectionJsonLd(
  title: string,
  handle: string,
  products: Array<{ title: string; handle: string; thumbnail?: string | null; position?: number }>
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: title,
    url: `${SITE_URL}/collections/${handle}`,
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: products.map((product, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        url: `${SITE_URL}/products/${product.handle}`,
        name: product.title,
        ...(product.thumbnail ? { image: resolveImageUrl(product.thumbnail) } : {}),
      })),
    },
  };
}

/**
 * WebSite structured data with SearchAction for sitelinks search box.
 */
export function generateWebSiteJsonLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: BRAND_NAME,
    url: SITE_URL,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE_URL}/search?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

/**
 * Enhanced Organization structured data.
 */
export function generateOrganizationJsonLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: BRAND_NAME,
    url: SITE_URL,
    logo: LOGO_URL,
    description: 'Precision-engineered holsters designed for reliability, comfort, and quick draw. Trusted by law enforcement and military professionals.',
    brand: {
      '@type': 'Brand',
      name: BRAND_NAME,
    },
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      url: `${SITE_URL}/contact`,
    },
    sameAs: [],
  };
}
