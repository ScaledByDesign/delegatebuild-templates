import { medusaClient } from "../../lib/medusa-client"
import medusaError from "../../lib/util/medusa-error"
import { getAuthHeaders } from "../../lib/util/cookies"
import { OMNICART_PUBLISHABLE_KEY } from "@/lib/omnicart-config"

const getStoreHeaders = () => ({
  ...getAuthHeaders(),
  'x-publishable-api-key': OMNICART_PUBLISHABLE_KEY,
})

/**
 * Price rule for conditional pricing (e.g., free shipping for orders over $50)
 */
export interface PriceRule {
  id: string
  attribute: string
  operator: 'gt' | 'lt' | 'eq' | 'lte' | 'gte'
  value: string
}

/**
 * Calculated price with conditional pricing applied
 */
export interface CalculatedPrice {
  id: string
  calculated_amount: number | null
  original_amount: number | null
  currency_code: string
  is_calculated_price_tax_inclusive?: boolean
}

/**
 * Shipping option with full pricing information including conditional prices
 */
export interface ShippingOption {
  id: string
  name: string
  price_type: 'flat' | 'calculated'
  /** The shipping option's amount (base price before conditional rules) */
  amount?: number
  /** Calculated price after applying conditional rules (e.g., free shipping for $50+) */
  calculated_price?: CalculatedPrice
  /** Array of prices with their rules */
  prices?: Array<{
    id: string
    currency_code: string
    amount: number
    min_quantity?: number
    max_quantity?: number
    price_rules?: PriceRule[]
  }>
  provider_id: string
  shipping_profile_id?: string
  service_zone_id?: string
  service_zone?: {
    id: string
    name: string
    fulfillment_set?: {
      id: string
      name: string
      type: string
      location?: {
        id: string
        name: string
        address?: {
          address_1: string
          address_2?: string
          city: string
          country_code: string
          province?: string
          postal_code: string
        }
      }
    }
  }
  data?: Record<string, any>
  metadata?: Record<string, any>
  /** @deprecated Use calculated_price.calculated_amount instead */
  price_incl_tax?: number
}

export interface ShippingOptionsResponse {
  shipping_options: ShippingOption[]
}

/**
 * Get the effective shipping amount from a shipping option
 * Uses calculated_price if available (respects conditional pricing rules),
 * otherwise falls back to the base amount
 */
export const getShippingAmount = (option: ShippingOption): number => {
  // First try calculated_price.calculated_amount (includes conditional pricing)
  if (option.calculated_price?.calculated_amount != null) {
    return option.calculated_price.calculated_amount
  }
  // Fallback to base amount
  if (option.amount != null) {
    return option.amount
  }
  // Legacy fallback
  if (option.price_incl_tax != null) {
    return option.price_incl_tax
  }
  return 0
}

/**
 * List shipping options for a cart with calculated prices
 *
 * The Medusa API returns shipping options with calculated_price that respects
 * conditional pricing rules (e.g., free shipping for orders over $50).
 * The cart's item_total is used to determine which price rule applies.
 */
export const listCartShippingOptions = async (cartId: string): Promise<ShippingOption[]> => {
  try {
    const headers = getStoreHeaders()

    // Note: The default response already includes calculated_price and prices with rules
    // Adding custom fields like prices.price_rules causes a 500 error in Medusa v2
    const response = await medusaClient.fetch<ShippingOptionsResponse>(
      "/store/shipping-options",
      {
        method: "GET",
        query: {
          cart_id: cartId,
        },
        headers,
        cache: "no-store",
      }
    )

    const options = response.shipping_options || []

    // Log shipping options with their calculated prices for debugging
    options.forEach(opt => {
      const effectiveAmount = getShippingAmount(opt)
      console.log(`📦 Shipping option "${opt.name}": $${effectiveAmount.toFixed(2)} (calculated_price: ${opt.calculated_price?.calculated_amount}, base: ${opt.amount})`)
    })

    return options
  } catch (error) {
    console.error('Error fetching shipping options:', error)
    return []
  }
}

/**
 * List shipping options for a region
 */
export const listRegionShippingOptions = async (regionId: string): Promise<ShippingOption[]> => {
  try {
    const headers = getStoreHeaders()

    const response = await medusaClient.fetch<ShippingOptionsResponse>(
      "/store/shipping-options",
      {
        method: "GET",
        query: {
          region_id: regionId,
          fields: "+service_zone.fulfillment_set.type,*service_zone.fulfillment_set.location.address",
        },
        headers,
        cache: "force-cache",
      }
    )

    return response.shipping_options || []
  } catch (error) {
    console.error('Error fetching region shipping options:', error)
    return []
  }
}

/**
 * Get shipping option by ID
 */
export const getShippingOption = async (optionId: string): Promise<ShippingOption | null> => {
  try {
    const headers = getStoreHeaders()

    const response = await medusaClient.fetch<{ shipping_option: ShippingOption }>(
      `/store/shipping-options/${optionId}`,
      {
        method: "GET",
        headers,
        cache: "force-cache",
      }
    )

    return response.shipping_option
  } catch (error) {
    console.error('Error fetching shipping option:', error)
    return null
  }
}

/**
 * Calculate shipping for cart
 */
export const calculateShipping = async (
  cartId: string,
  shippingAddress: {
    country_code: string
    province?: string
    postal_code: string
  }
): Promise<ShippingOption[]> => {
  try {
    const headers = getStoreHeaders()

    const response = await medusaClient.fetch<ShippingOptionsResponse>(
      "/store/shipping-options",
      {
        method: "GET",
        query: {
          cart_id: cartId,
          country_code: shippingAddress.country_code,
          province: shippingAddress.province,
          postal_code: shippingAddress.postal_code,
        },
        headers,
        cache: "no-store",
      }
    )

    return response.shipping_options || []
  } catch (error) {
    console.error('Error calculating shipping:', error)
    return []
  }
}
