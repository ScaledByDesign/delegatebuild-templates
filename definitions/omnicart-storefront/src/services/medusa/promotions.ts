import { medusaClient } from "../../lib/medusa-client"
import medusaError from "../../lib/util/medusa-error"
import { getAuthHeaders } from "../../lib/util/cookies"

export interface Promotion {
  id: string
  code?: string
  type: string
  value: number
  is_automatic: boolean
  is_disabled: boolean
  application_method: {
    id: string
    type: string
    target_type: string
    allocation?: string
    value?: number
    max_quantity?: number
    buy_rules_min_quantity?: number
  }
  rules: {
    id: string
    attribute: string
    operator: string
    values: string[]
  }[]
  created_at: string
  updated_at: string
}

export interface PromotionsResponse {
  promotions: Promotion[]
}

/**
 * Apply promotion codes to cart
 */
export const applyPromotionCodes = async (
  cartId: string,
  codes: string[]
): Promise<any> => {
  try {
    const headers = getAuthHeaders()
    
    const response = await medusaClient.fetch(
      `/store/carts/${cartId}/promotions`,
      {
        method: "POST",
        body: JSON.stringify({
          promo_codes: codes,
        }),
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
      }
    )

    return response
  } catch (error) {
    console.error('Error applying promotion codes:', error)
    throw medusaError(error)
  }
}

/**
 * Remove promotion codes from cart
 */
export const removePromotionCodes = async (
  cartId: string,
  codes: string[]
): Promise<any> => {
  try {
    const headers = getAuthHeaders()
    
    const response = await medusaClient.fetch(
      `/store/carts/${cartId}/promotions`,
      {
        method: "DELETE",
        body: JSON.stringify({
          promo_codes: codes,
        }),
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
      }
    )

    return response
  } catch (error) {
    console.error('Error removing promotion codes:', error)
    throw medusaError(error)
  }
}

/**
 * Validate promotion code
 */
export const validatePromotionCode = async (
  code: string,
  cartId?: string
): Promise<{ valid: boolean; promotion?: Promotion; error?: string }> => {
  try {
    const headers = getAuthHeaders()
    
    const query: any = { code }
    if (cartId) {
      query.cart_id = cartId
    }
    
    const response = await medusaClient.fetch<{ promotion: Promotion }>(
      "/store/promotions/validate",
      {
        method: "GET",
        query,
        headers,
      }
    )

    return {
      valid: true,
      promotion: response.promotion,
    }
  } catch (error: any) {
    console.error('Error validating promotion code:', error)
    return {
      valid: false,
      error: error.message || 'Invalid promotion code',
    }
  }
}

/**
 * List available promotions
 */
export const listPromotions = async (params?: {
  limit?: number
  offset?: number
  is_automatic?: boolean
}): Promise<{ promotions: Promotion[]; count: number }> => {
  try {
    const headers = getAuthHeaders()
    
    const response = await medusaClient.fetch<PromotionsResponse & { count: number }>(
      "/store/promotions",
      {
        method: "GET",
        query: {
          limit: params?.limit || 50,
          offset: params?.offset || 0,
          is_automatic: params?.is_automatic,
        },
        headers,
        cache: "force-cache",
      }
    )

    return {
      promotions: response.promotions || [],
      count: response.count || 0,
    }
  } catch (error) {
    console.error('Error fetching promotions:', error)
    return { promotions: [], count: 0 }
  }
}

/**
 * Get promotion by code
 */
export const getPromotionByCode = async (code: string): Promise<Promotion | null> => {
  try {
    const { promotions } = await listPromotions()
    return promotions.find(promotion => promotion.code === code) || null
  } catch (error) {
    console.error('Error fetching promotion by code:', error)
    return null
  }
}
