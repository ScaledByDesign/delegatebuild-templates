import { OmnicartProduct, OmnicartProductVariant } from '@/services/omnicart/products'
import { transformCdnUrl } from '@/lib/util/image-url'

/**
 * Resolve a product image straight from the product record. Routes the raw
 * thumbnail/first-image through transformCdnUrl (which repairs Medusa-orphaned
 * `undefined/<file>` / bare-filename URLs to the public-assets bucket and maps
 * Shopify/CDN URLs to local paths). Falls back to the inline placeholder when
 * the product has no usable image (e.g. sandbox seed data).
 */
export const resolveProductImage = (medusaProduct: OmnicartProduct): string => {
  const raw = medusaProduct.thumbnail || medusaProduct.images?.[0]?.url || ''
  if (!raw) return PRODUCT_IMAGE_PLACEHOLDER
  const resolved = transformCdnUrl(raw)
  return resolved || PRODUCT_IMAGE_PLACEHOLDER
}

/**
 * Inline SVG placeholder for products with no thumbnail/images (e.g. sandbox
 * seed data). Renders as a neutral "No image" tile instead of a broken <img>.
 */
export const PRODUCT_IMAGE_PLACEHOLDER =
  "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='400'%20height='400'%20viewBox='0%200%20400%20400'%3E%3Crect%20width='400'%20height='400'%20fill='%23f1f1f1'/%3E%3Cg%20fill='%23bbb'%3E%3Crect%20x='140'%20y='150'%20width='120'%20height='90'%20rx='8'/%3E%3Ccircle%20cx='172'%20cy='180'%20r='12'%20fill='%23f1f1f1'/%3E%3Cpath%20d='M150%20230l34-34%2026%2026%2030-30%2020%2020v18z'%20fill='%23f1f1f1'/%3E%3C/g%3E%3Ctext%20x='200'%20y='280'%20font-family='sans-serif'%20font-size='20'%20fill='%23999'%20text-anchor='middle'%3ENo%20image%3C/text%3E%3C/svg%3E"

/**
 * Convert variant options to a key-value map
 */
export const optionsAsKeymap = (
  variantOptions: OmnicartProductVariant["options"]
): Record<string, string> => {
  return variantOptions?.reduce((acc: Record<string, string>, varopt) => {
    acc[varopt.option_id] = varopt.value
    return acc
  }, {}) || {}
}

/**
 * Find a variant based on selected options
 */
export const findVariantByOptions = (
  product: OmnicartProduct,
  selectedOptions: Record<string, string>
): OmnicartProductVariant | undefined => {
  if (!product.variants || product.variants.length === 0) {
    return undefined
  }

  if (product.variants.length === 1) {
    return product.variants[0]
  }

  return product.variants.find((variant) => {
    const variantOptions = optionsAsKeymap(variant.options)
    return Object.entries(selectedOptions).every(([key, value]) => {
      return variantOptions[key] === value
    })
  })
}

/**
 * Get the cheapest price from all variants
 */
export const getCheapestPrice = (product: OmnicartProduct) => {
  if (!product.variants || product.variants.length === 0) {
    return null
  }

  // Store API returns price under `calculated_price`; admin/seed data uses
  // `prices[0]`. Prefer calculated_price, fall back to prices[0].
  const amountOf = (variant: OmnicartProductVariant): number | undefined =>
    variant.calculated_price?.calculated_amount ?? variant.prices?.[0]?.amount
  const currencyOf = (variant?: OmnicartProductVariant): string =>
    variant?.calculated_price?.currency_code || variant?.prices?.[0]?.currency_code || 'USD'

  const prices = product.variants
    .map(amountOf)
    .filter((price): price is number => price !== undefined)

  if (prices.length === 0) return null

  const cheapestAmount = Math.min(...prices)
  const cheapestVariant = product.variants.find(
    variant => amountOf(variant) === cheapestAmount
  )

  return {
    amount: cheapestAmount,
    currency_code: currencyOf(cheapestVariant),
    formatted: formatPrice(cheapestAmount, currencyOf(cheapestVariant))
  }
}

/**
 * Get price for a specific variant
 */
export const getVariantPrice = (variant: OmnicartProductVariant | undefined) => {
  if (!variant) return null

  // Store API returns price under `calculated_price`; admin/seed data uses
  // `prices[0]`. Prefer calculated_price, fall back to prices[0].
  const amount = variant.calculated_price?.calculated_amount ?? variant.prices?.[0]?.amount
  if (amount === undefined) return null

  const currency_code =
    variant.calculated_price?.currency_code || variant.prices?.[0]?.currency_code || 'USD'

  return {
    amount,
    currency_code,
    formatted: formatPrice(amount, currency_code)
  }
}

/**
 * Format price amount to currency string
 */
export const formatPrice = (amount: number, currencyCode: string): string => {
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode.toUpperCase(),
    minimumFractionDigits: 2,
  })

  // API sends prices in dollars, no conversion needed
  return formatter.format(amount)
}

/**
 * Check if a variant is in stock
 */
export const isVariantInStock = (variant: OmnicartProductVariant | undefined): boolean => {
  if (!variant) return false

  // If inventory is not managed, assume it's in stock
  if (!variant.manage_inventory) {
    return true
  }

  // Check actual inventory quantity first
  // If inventory_quantity is undefined or null, treat as out of stock
  // to prevent selling items that may not be available
  if (variant.inventory_quantity === undefined || variant.inventory_quantity === null) {
    return false
  }

  // If there's actual stock, it's in stock
  if (variant.inventory_quantity > 0) {
    return true
  }

  // No stock available - out of stock regardless of backorder setting
  // Products with allow_backorder should be configured with proper inventory
  // if they're meant to be purchasable
  return false
}

/**
 * Get all available option values for a specific option
 */
export const getAvailableOptionValues = (
  product: OmnicartProduct,
  optionId: string,
  selectedOptions: Record<string, string>
): string[] => {
  if (!product.variants) return []

  // Get all variants that match the currently selected options (excluding the current option)
  const otherSelectedOptions = { ...selectedOptions }
  delete otherSelectedOptions[optionId]

  const matchingVariants = product.variants.filter(variant => {
    const variantOptions = optionsAsKeymap(variant.options)
    return Object.entries(otherSelectedOptions).every(([key, value]) => {
      return variantOptions[key] === value
    })
  })

  // Extract unique values for the current option from matching variants
  const availableValues = new Set<string>()
  matchingVariants.forEach(variant => {
    const variantOptions = optionsAsKeymap(variant.options)
    if (variantOptions[optionId]) {
      availableValues.add(variantOptions[optionId])
    }
  })

  return Array.from(availableValues)
}

/**
 * Known size ordering for automatic sorting of size-related options.
 * Values not in this map will be sorted alphabetically after known sizes.
 */
const SIZE_ORDER: Record<string, number> = {
  'xxs': 1, '2xs': 1,
  'xs': 2,
  's': 3, 'small': 3, 'sm': 3,
  'm': 4, 'medium': 4, 'med': 4,
  'l': 5, 'large': 5, 'lg': 5,
  'xl': 6,
  '2xl': 7, 'xxl': 7,
  '3xl': 8, 'xxxl': 8,
  '4xl': 9,
  '5xl': 10,
}

const SIZE_OPTION_TITLES = ['size', 'sizes'];

/**
 * Sort option values for display. Handles:
 * 1. Custom order from product metadata (variant_option_order)
 * 2. Automatic size ordering for size-related options
 * 3. Original order for everything else
 */
export const sortProductOptions = (
  options: Array<{ id: string; title: string; values: Array<{ id: string; value: string; metadata?: Record<string, unknown> }> }>,
  productMetadata?: Record<string, unknown>
): typeof options => {
  // Check for custom ordering in metadata: { "variant_option_order": { "Size": ["Small", "Medium", "Large", "XL", "2XL"] } }
  const customOrder = productMetadata?.variant_option_order as Record<string, string[]> | undefined;

  return options.map((option) => {
    // 1. Custom order from metadata (exact match by option title)
    const customValues = customOrder?.[option.title];
    if (customValues?.length) {
      const orderMap = new Map(customValues.map((v, i) => [v.toLowerCase(), i]));
      const sorted = [...option.values].sort((a, b) => {
        const aIdx = orderMap.get(a.value.toLowerCase()) ?? Infinity;
        const bIdx = orderMap.get(b.value.toLowerCase()) ?? Infinity;
        return aIdx - bIdx;
      });
      return { ...option, values: sorted };
    }

    // 2. Auto-sort size options
    if (SIZE_OPTION_TITLES.includes(option.title.toLowerCase())) {
      const sorted = [...option.values].sort((a, b) => {
        const aOrder = SIZE_ORDER[a.value.toLowerCase()] ?? Infinity;
        const bOrder = SIZE_ORDER[b.value.toLowerCase()] ?? Infinity;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return a.value.localeCompare(b.value);
      });
      return { ...option, values: sorted };
    }

    // 3. No sorting for other option types
    return option;
  });
};

/**
 * Transform Medusa product to UI-compatible format
 */
export const transformOmnicartProductForUI = (medusaProduct: OmnicartProduct) => {
  const cheapestPrice = getCheapestPrice(medusaProduct)
  const variants = medusaProduct.variants || []
  const amountOf = (v?: OmnicartProductVariant) =>
    v?.calculated_price?.calculated_amount ?? v?.prices?.[0]?.amount ?? Number.POSITIVE_INFINITY
  const cheapestVariant = variants.reduce((best, variant) => {
    return amountOf(variant) < amountOf(best) ? variant : best
  }, variants[0])
  
  return {
    id: medusaProduct.id,
    name: medusaProduct.title,
    description: medusaProduct.description || '',
    price: cheapestPrice ? cheapestPrice.amount : 0,
    currency_code: cheapestPrice ? cheapestPrice.currency_code : 'USD',
    image: resolveProductImage(medusaProduct),
    category: medusaProduct.collection?.handle || '',
    slug: medusaProduct.handle,
    rating: 4.5, // Default rating
    defaultVariantId: cheapestVariant?.id || null,
  }
}
