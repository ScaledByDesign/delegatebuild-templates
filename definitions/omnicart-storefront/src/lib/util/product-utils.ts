import { OmnicartProduct, OmnicartProductVariant } from '@/services/omnicart/products'

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

  const prices = product.variants
    .map(variant => variant.prices?.[0]?.amount)
    .filter(price => price !== undefined)

  if (prices.length === 0) return null

  const cheapestAmount = Math.min(...prices)
  const cheapestVariant = product.variants.find(
    variant => variant.prices?.[0]?.amount === cheapestAmount
  )

  return {
    amount: cheapestAmount,
    currency_code: cheapestVariant?.prices?.[0]?.currency_code || 'USD',
    formatted: formatPrice(cheapestAmount, cheapestVariant?.prices?.[0]?.currency_code || 'USD')
  }
}

/**
 * Get price for a specific variant
 */
export const getVariantPrice = (variant: OmnicartProductVariant | undefined) => {
  if (!variant || !variant.prices || variant.prices.length === 0) {
    return null
  }

  const price = variant.prices[0]
  return {
    amount: price.amount,
    currency_code: price.currency_code,
    formatted: formatPrice(price.amount, price.currency_code)
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
  const cheapestVariant = variants.reduce((best, variant) => {
    const variantPrice = variant.prices?.[0]?.amount ?? Number.POSITIVE_INFINITY
    const bestPrice = best?.prices?.[0]?.amount ?? Number.POSITIVE_INFINITY
    return variantPrice < bestPrice ? variant : best
  }, variants[0])
  
  return {
    id: medusaProduct.id,
    name: medusaProduct.title,
    description: medusaProduct.description || '',
    price: cheapestPrice ? cheapestPrice.amount : 0,
    image: medusaProduct.thumbnail || medusaProduct.images?.[0]?.url || '',
    category: medusaProduct.collection?.handle || '',
    slug: medusaProduct.handle,
    rating: 4.5, // Default rating
    defaultVariantId: cheapestVariant?.id || null,
  }
}
