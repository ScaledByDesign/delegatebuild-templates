import { medusaClient } from "../../lib/medusa-client"
import medusaError from "../../lib/util/medusa-error"
import { getAuthHeaders } from "../../lib/util/cookies"

// Ensure publishable key is sent with store requests
const OMNICART_PUBLISHABLE_KEY = (typeof window !== 'undefined' && (import.meta as any)?.env?.VITE_OMNICART_PUBLISHABLE_KEY)
  || (typeof process !== 'undefined' ? process.env.VITE_OMNICART_PUBLISHABLE_KEY : undefined)
  || 'pk_bfeb37dbcbc6e9cd7d9dc3e44a2dc89160c74de9c8cd1d4fb38c88d30cda1d20'

const getStoreHeaders = () => ({
  ...getAuthHeaders(),
  'x-publishable-api-key': OMNICART_PUBLISHABLE_KEY,
})

export interface PaymentProvider {
  id: string
  is_enabled: boolean
}

export interface PaymentSession {
  id: string
  provider_id: string
  amount: number
  status: string
  data?: Record<string, any>
  created_at: string
  updated_at: string
}

export interface PaymentProvidersResponse {
  payment_providers: PaymentProvider[]
}

export interface PaymentSessionsResponse {
  payment_sessions: PaymentSession[]
}

/**
 * List payment providers for a region
 */
export const listPaymentProviders = async (regionId: string): Promise<PaymentProvider[]> => {
  try {
    const headers = getStoreHeaders()

    const response = await medusaClient.fetch<PaymentProvidersResponse>(
      "/store/payment-providers",
      {
        method: "GET",
        query: {
          region_id: regionId,
        },
        headers,
        cache: "force-cache",
      }
    )

    return response.payment_providers?.sort((a, b) => a.id.localeCompare(b.id)) || []
  } catch (error) {
    console.error('Error fetching payment providers:', error)
    return []
  }
}

/**
 * Initialize payment sessions for a cart
 */
export const initializePaymentSessions = async (cartId: string): Promise<PaymentSession[]> => {
  try {
    const headers = getStoreHeaders()

    const response = await medusaClient.fetch<PaymentSessionsResponse>(
      `/store/carts/${cartId}/payment-sessions`,
      {
        method: "POST",
        headers,
      }
    )

    return response.payment_sessions || []
  } catch (error) {
    console.error('Error initializing payment sessions:', error)
    throw medusaError(error)
  }
}

/**
 * Set payment session for a cart
 */
export const setPaymentSession = async (
  cartId: string,
  providerId: string
): Promise<any> => {
  try {
    const headers = getStoreHeaders()

    const response = await medusaClient.fetch(
      `/store/carts/${cartId}/payment-session`,
      {
        method: "POST",
        body: JSON.stringify({
          provider_id: providerId,
        }),
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
      }
    )

    return response
  } catch (error) {
    console.error('Error setting payment session:', error)
    throw medusaError(error)
  }
}

/**
 * Update payment session
 */
export const updatePaymentSession = async (
  cartId: string,
  providerId: string,
  data: Record<string, any>
): Promise<any> => {
  try {
    const headers = getStoreHeaders()

    const response = await medusaClient.fetch(
      `/store/carts/${cartId}/payment-sessions/${providerId}`,
      {
        method: "POST",
        body: JSON.stringify(data),
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
      }
    )

    return response
  } catch (error) {
    console.error('Error updating payment session:', error)
    throw medusaError(error)
  }
}

/**
 * Authorize payment session
 */
export const authorizePaymentSession = async (
  cartId: string,
  providerId: string
): Promise<any> => {
  try {
    const headers = getStoreHeaders()

    const response = await medusaClient.fetch(
      `/store/carts/${cartId}/payment-sessions/${providerId}/authorize`,
      {
        method: "POST",
        headers,
      }
    )

    return response
  } catch (error) {
    console.error('Error authorizing payment session:', error)
    throw medusaError(error)
  }
}
