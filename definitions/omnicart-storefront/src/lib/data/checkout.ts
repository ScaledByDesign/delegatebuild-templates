import { omnicartClient } from "../omnicart-client"
import omnicartError from "../util/omnicart-error"
import { getAuthHeaders, getCartId } from "../util/cookies"
import { listCartShippingOptions } from "../../services/omnicart/shipping"
import { listPaymentProviders, initializePaymentSessions, setPaymentSession, authorizePaymentSession } from "../../services/omnicart/payment"
import { mergeAttributionToCart } from "./cart"
import { OMNICART_PUBLISHABLE_KEY } from "@/lib/omnicart-config"

const getStoreHeaders = () => ({
  ...getAuthHeaders(),
  'x-publishable-api-key': OMNICART_PUBLISHABLE_KEY,
})

// Types for checkout process
export interface ShippingAddress {
  first_name: string
  last_name: string
  address_1: string
  address_2?: string
  city: string
  country_code: string
  province?: string
  postal_code: string
  phone?: string
}

export interface BillingAddress extends ShippingAddress {
  email?: string
}

export interface ShippingOption {
  id: string
  name: string
  price_incl_tax: number
  provider_id: string
  data?: any
}

export interface PaymentSession {
  id: string
  provider_id: string
  amount: number
  status: string
  data?: any
}

export interface CheckoutCart {
  id: string
  email?: string
  shipping_address?: ShippingAddress
  billing_address?: BillingAddress
  shipping_methods?: any[]
  payment_sessions?: PaymentSession[]
  items: any[]
  subtotal: number
  total: number
  tax_total: number
  shipping_total: number
  discount_total: number
}

/**
 * Update cart with customer email
 */
export const updateCartEmail = async (cartId: string, email: string) => {
  if (!cartId || !email) {
    throw new Error("Cart ID and email are required")
  }

  try {
    const headers = getStoreHeaders()

    const response = await omnicartClient.fetch(
      `/store/carts/${cartId}`,
      {
        method: "POST",
        body: JSON.stringify({ email }),
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
      }
    )

    return response
  } catch (error) {
    throw omnicartError(error)
  }
}

/**
 * Opt-in to SMS marketing via Attentive
 * Called when user checks the "Get 10% off" checkbox
 */
export const optInToSms = async (data: {
  phone: string
  email?: string
  cartId?: string
  firstName?: string
  lastName?: string
}) => {
  if (!data.phone) {
    throw new Error("Phone number is required for SMS opt-in")
  }

  try {
    const headers = getStoreHeaders()

    const response = await omnicartClient.fetch(
      `/store/attentive/opt-in`,
      {
        method: "POST",
        body: JSON.stringify(data),
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
      }
    )

    return response as { success: boolean; syncedPhone?: string; isNew?: boolean; error?: string }
  } catch (error) {
    throw omnicartError(error)
  }
}

/**
 * Update cart shipping address
 */
export const updateShippingAddress = async (
  cartId: string, 
  address: ShippingAddress
) => {
  if (!cartId || !address) {
    throw new Error("Cart ID and shipping address are required")
  }

  try {
    const headers = getStoreHeaders()

    const response = await omnicartClient.fetch(
      `/store/carts/${cartId}`,
      {
        method: "POST",
        body: JSON.stringify({ shipping_address: address }),
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
      }
    )

    return response
  } catch (error) {
    throw omnicartError(error)
  }
}

/**
 * Update cart billing address
 */
export const updateBillingAddress = async (
  cartId: string, 
  address: BillingAddress
) => {
  if (!cartId || !address) {
    throw new Error("Cart ID and billing address are required")
  }

  try {
    const headers = getStoreHeaders()

    const response = await omnicartClient.fetch(
      `/store/carts/${cartId}`,
      {
        method: "POST",
        body: JSON.stringify({ billing_address: address }),
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
      }
    )

    return response
  } catch (error) {
    throw omnicartError(error)
  }
}

/**
 * Get available shipping options for cart
 */
export const getCartShippingOptions = async (cartId: string): Promise<ShippingOption[]> => {
  if (!cartId) {
    throw new Error("Cart ID is required")
  }

  try {
    const shippingOptions = await listCartShippingOptions(cartId)

    // Transform to our expected format
    return shippingOptions.map(option => ({
      id: option.id,
      name: option.name,
      price_incl_tax: option.price_incl_tax,
      provider_id: option.provider_id,
      data: option.data
    }))
  } catch (error) {
    throw omnicartError(error)
  }
}

/**
 * Add shipping method to cart
 */
export const addCartShippingMethod = async (
  cartId: string,
  shippingOptionId: string
) => {
  if (!cartId || !shippingOptionId) {
    throw new Error("Cart ID and shipping option ID are required")
  }

  try {
    const headers = getStoreHeaders()

    const response = await omnicartClient.fetch(
      `/store/carts/${cartId}/shipping-methods`,
      {
        method: "POST",
        body: JSON.stringify({ option_id: shippingOptionId }),
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
      }
    )

    return response
  } catch (error) {
    throw omnicartError(error)
  }
}

/**
 * Create payment sessions for cart
 */
export const createCartPaymentSessions = async (cartId: string) => {
  if (!cartId) {
    throw new Error("Cart ID is required")
  }

  try {
    const paymentSessions = await initializePaymentSessions(cartId)
    return { payment_sessions: paymentSessions }
  } catch (error) {
    throw omnicartError(error)
  }
}

/**
 * Set payment session for cart
 */
export const setCartPaymentSession = async (
  cartId: string,
  providerId: string
) => {
  if (!cartId || !providerId) {
    throw new Error("Cart ID and provider ID are required")
  }

  try {
    return await setPaymentSession(cartId, providerId)
  } catch (error) {
    throw omnicartError(error)
  }
}

/**
 * Authorize payment session (for providers that don't require client-side collection, e.g., manual)
 */
export const authorizeCartPaymentSession = async (
  cartId: string,
  providerId: string
) => {
  if (!cartId || !providerId) {
    throw new Error("Cart ID and provider ID are required")
  }
  try {
    return await authorizePaymentSession(cartId, providerId)
  } catch (error) {
    throw omnicartError(error)
  }
}

/**
 * Complete cart checkout and create order
 */
export const completeCartCheckout = async (cartId: string) => {
  if (!cartId) {
    throw new Error("Cart ID is required")
  }

  try {
    const headers = getStoreHeaders()

    // Merge attribution (Rumble _raclid + UTMs) into cart metadata before completion.
    // Helper never throws — safe to await.
    await mergeAttributionToCart(cartId)

    const response = await omnicartClient.fetch(
      `/store/carts/${cartId}/complete`,
      {
        method: "POST",
        headers,
      }
    )

    return response
  } catch (error) {
    throw omnicartError(error)
  }
}

/**
 * Calculate taxes for cart
 * Must be called after shipping address is set to ensure correct tax jurisdiction
 * Returns the updated cart with tax totals
 */
export const calculateCartTaxes = async (cartId: string) => {
  if (!cartId) {
    throw new Error("Cart ID is required")
  }

  try {
    const headers = getStoreHeaders()

    const response = await omnicartClient.fetch(
      `/store/carts/${cartId}/taxes`,
      {
        method: "POST",
        headers,
      }
    )

    // Return the cart from the response if available
    return (response as any)?.cart || response
  } catch (error) {
    throw omnicartError(error)
  }
}

/**
 * Update shipping address and calculate taxes in one optimized flow
 * Combines address update + tax calculation to reduce API roundtrips
 * Returns the updated cart with tax totals
 */
export const updateShippingAddressWithTaxes = async (
  cartId: string,
  address: ShippingAddress
) => {
  if (!cartId || !address) {
    throw new Error("Cart ID and shipping address are required")
  }

  try {
    const headers = getStoreHeaders()

    console.log('[updateShippingAddressWithTaxes] Updating cart:', cartId, 'with address:', JSON.stringify(address, null, 2));

    // Step 1: Update shipping address
    const addressResponse = await omnicartClient.fetch(
      `/store/carts/${cartId}`,
      {
        method: "POST",
        body: JSON.stringify({ shipping_address: address }),
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
      }
    )

    console.log('[updateShippingAddressWithTaxes] Address updated successfully');

    // Step 2: Calculate taxes (Medusa doesn't auto-calculate on address update)
    const taxResponse = await omnicartClient.fetch(
      `/store/carts/${cartId}/taxes`,
      {
        method: "POST",
        headers,
      }
    )

    console.log('[updateShippingAddressWithTaxes] Taxes calculated successfully');

    // Return the final cart with taxes calculated
    return (taxResponse as any)?.cart || (addressResponse as any)?.cart || taxResponse
  } catch (error) {
    console.error('[updateShippingAddressWithTaxes] ERROR:', error);
    console.error('[updateShippingAddressWithTaxes] Error details:', JSON.stringify(error, null, 2));
    throw omnicartError(error)
  }
}

/**
 * Get current cart for checkout
 */
export const getCheckoutCart = async (): Promise<CheckoutCart | null> => {
  const cartId = getCartId()
  
  if (!cartId) {
    return null
  }

  try {
    const headers = getStoreHeaders()

    const response = await omnicartClient.fetch(
      `/store/carts/${cartId}`,
      {
        method: "GET",
        headers,
      }
    )

    return (response as any)?.cart || null;
  } catch (error) {
    console.error("Error fetching checkout cart:", error)
    return null
  }
}

/**
 * Batch update cart - combines multiple updates into one API call
 * Optimizes checkout flow by reducing API roundtrips from 4-6 calls to 1 call
 * Replaces: updateCartEmail + updateShippingAddress + calculateCartTaxes + getCartShippingOptions
 */
export const batchUpdateCart = async (
  cartId: string,
  updates: {
    email?: string
    shipping_address?: ShippingAddress
    billing_address?: BillingAddress
    auto_calculate_taxes?: boolean
    include_shipping_options?: boolean
  }
) => {
  if (!cartId) {
    throw new Error("Cart ID is required")
  }

  try {
    const headers = getStoreHeaders()

    const response = await omnicartClient.fetch(
      `/store/carts/${cartId}/batch-update`,
      {
        method: "POST",
        body: JSON.stringify({
          auto_calculate_taxes: true,
          include_shipping_options: true,
          ...updates
        }),
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
      }
    )

    return response
  } catch (error) {
    throw omnicartError(error)
  }
}
