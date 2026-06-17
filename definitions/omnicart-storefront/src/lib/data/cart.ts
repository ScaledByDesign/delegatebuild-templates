import { omnicartClient } from "../omnicart-client"
import omnicartError from "../util/omnicart-error"
import { getAuthHeaders, getCartId, removeCartId, setCartId } from "../util/cookies"
import { Cart, CartItem } from "@/hooks/useCart"
import { getStoredAttribution } from "@/hooks/useAttributionCapture"
import { OMNICART_PUBLISHABLE_KEY, OMNICART_SALES_CHANNEL_ID, OMNICART_REGION_ID } from "@/lib/omnicart-config"

/**
 * Detects the Medusa error that occurs when a cart mutation tries to delete or
 * re-initialize a payment session whose Stripe PaymentIntent is already in a
 * terminal state (succeeded/canceled).
 *
 * This is the root cause of "charged but order stuck pending": once the customer
 * pays, the PaymentIntent is `succeeded` and Medusa can no longer delete the
 * payment session, so any post-payment cart mutation (email/address/tax sync) or
 * the `/complete` call itself throws "Could not delete all payment sessions".
 */
export const isTerminalPaymentSessionError = (error: any): boolean => {
  const message = error?.message || error?.body?.message || ''
  return (
    message.includes('Could not delete all payment sessions') ||
    message.includes('payment session') ||
    message.includes('UNEXPECTED_STATE')
  )
}

const getEnvVar = (key: string): string | undefined => {
  if (typeof window !== 'undefined' && (import.meta as any)?.env) {
    const value = (import.meta as any).env[key]
    if (typeof value === 'string' && value.length > 0) {
      return value
    }
  }

  if (typeof process !== 'undefined' && process.env) {
    const value = process.env[key]
    if (typeof value === 'string' && value.length > 0) {
      return value
    }
  }

  return undefined
}

// Primary region for the storefront, resolved from config (no hardcoded id).
// Empty when unconfigured; the backend then resolves the region from the cart.
const DEFAULT_REGION_ENV_ID =
  getEnvVar('VITE_OMNICART_DEFAULT_REGION_ID') ||
  getEnvVar('OMNICART_DEFAULT_REGION_ID') ||
  OMNICART_REGION_ID

let cachedRegionId: string | undefined = undefined

const persistRegionId = (regionId: string) => {
  cachedRegionId = regionId
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem('medusa_region_id', regionId)
    } catch (error) {
      console.warn('Unable to persist region id to localStorage', error)
    }
  }
}

const loadRegionIdFromStorage = (): string | undefined => {
  if (typeof window === 'undefined') {
    return undefined
  }

  try {
    const stored = window.localStorage.getItem('medusa_region_id') || undefined
    if (stored) {
      cachedRegionId = stored
      return stored
    }
  } catch (error) {
    console.warn('Unable to read region id from localStorage', error)
  }

  return undefined
}

const resolveRegionId = async (explicitRegionId?: string): Promise<string | undefined> => {
  if (explicitRegionId) {
    persistRegionId(explicitRegionId)
    return explicitRegionId
  }

  if (cachedRegionId) {
    return cachedRegionId
  }

  const storedRegionId = loadRegionIdFromStorage()
  if (storedRegionId) {
    return storedRegionId
  }

  if (DEFAULT_REGION_ENV_ID) {
    persistRegionId(DEFAULT_REGION_ENV_ID)
    return DEFAULT_REGION_ENV_ID
  }

  try {
    const headers = getStoreHeaders()
    const response = await omnicartClient.get<{ regions?: Array<{ id: string }> }>('/store/regions', {
      headers,
    })

    const firstRegionId = response.regions?.[0]?.id
    if (firstRegionId) {
      persistRegionId(firstRegionId)
      return firstRegionId
    }
  } catch (error) {
    console.warn('Unable to resolve region id from Medusa store', error)
  }

  return undefined
}

const getStoreHeaders = () => ({
  ...getAuthHeaders(),
  'x-publishable-api-key': OMNICART_PUBLISHABLE_KEY,
})

// Define types for API responses
type CartResponse = {
  cart: Cart
}

type ShippingOptionsResponse = {
  shipping_options: Array<{
    id: string;
    name: string;
    price_incl_tax: number;
    provider_id: string;
    data?: Record<string, unknown>;
  }>
}

type OrderResponse = {
  order: Record<string, unknown>
  data?: Record<string, unknown>
}

/**
 * Retrieves a cart by ID or from cookies if no ID provided
 */
export const retrieveCart = async (cartId?: string) => {
  const id = cartId || getCartId()

  if (!id) {
    return null
  }

  try {
    const headers = getStoreHeaders()

    const response = await omnicartClient.get<CartResponse>(
      `/store/carts/${id}`,
      {
        query: {
          // Include inventory fields for stock checking per Medusa v2 docs
          // https://docs.medusajs.com/resources/storefront-development/products/inventory
          // Also include promotions for discount code validation
          // CRITICAL: Include computed totals (+tax_total, +total, etc.) for tax calculation and validation
          // CRITICAL: Include shipping_address for tax region verification
          fields: "*items, *items.product, *items.variant, *items.thumbnail, *items.metadata, +items.total, +items.variant.inventory_quantity, +items.variant.manage_inventory, *promotions, +tax_total, +total, +subtotal, +item_subtotal, +shipping_total, +discount_total, *shipping_address, *billing_address, *shipping_methods, *payment_collection, *payment_collection.payment_sessions",
        },
        headers,
        cache: "no-store",
      }
    )

    // Check if the cart is already completed - if so, clear it and return null
    if ((response.cart as any)?.completed_at) {
      removeCartId()
      return null
    }

    return response.cart
  } catch (error) {
    // If cart is not found, remove the cart ID cookie
    if (error instanceof Response && error.status === 404) {
      removeCartId()
      return null
    }
    // For other errors, just return null
    return null
  }
}

/**
 * Creates a new cart
 */
export const createCart = async (regionId?: string) => {
  try {
    const headers = getStoreHeaders()

    const body: Record<string, unknown> = {
      ...(OMNICART_SALES_CHANNEL_ID ? { sales_channel_id: OMNICART_SALES_CHANNEL_ID } : {}),
    }
    const resolvedRegionId = await resolveRegionId(regionId)
    if (resolvedRegionId) {
      body.region_id = resolvedRegionId
      persistRegionId(resolvedRegionId)
    }

    // Attach attribution data to cart metadata at creation time
    const attribution = getStoredAttribution()
    if (attribution) {
      const metadata: Record<string, unknown> = { attribution }
      if (attribution._raclid) {
        metadata._raclid = attribution._raclid
      }
      body.metadata = metadata
    }

    const response = await omnicartClient.post<CartResponse>(
      "/store/carts",
      body,
      {
        headers,
      }
    )

    setCartId(response.cart.id)
    return await retrieveCart(response.cart.id)
  } catch (error: any) {
    try {
      const resp = error?.response as Response | undefined
      if (resp) {
        const text = await resp.text()
        console.error('createCart response body:', text)
      }
    } catch {
      // ignore
    }
    throw omnicartError(error)
  }
}

/**
 * Gets an existing cart or creates a new one
 */
export const getOrCreateCart = async (regionId?: string) => {
  const existingCart = await retrieveCart()

  // Return existing cart even if it's empty (session carts should be preserved)
  if (existingCart) {
    return existingCart
  }

  return createCart(regionId)
}

/**
 * Updates a cart with new data
 */
export const updateCart = async (cartId: string, data: Record<string, unknown>) => {
  if (!cartId) {
    throw new Error("Cart ID is required to update the cart")
  }

  try {
    const headers = getStoreHeaders()

    await omnicartClient.post<CartResponse>(
      `/store/carts/${cartId}`,
      data,
      {
        headers,
      }
    )

    return await retrieveCart(cartId)
  } catch (error) {
    // Post-payment syncs (email/shipping/billing) call updateCart AFTER the
    // PaymentIntent has already succeeded. Medusa writes the cart fields but then
    // fails trying to re-initialize the now-terminal payment session, throwing
    // "Could not delete all payment sessions". The field update itself still
    // landed, so treat this as non-fatal: refetch and return the cart so order
    // completion can proceed instead of leaving the customer charged but pending.
    if (isTerminalPaymentSessionError(error)) {
      console.warn('[updateCart] Terminal payment session during update — field update persisted, continuing with refetched cart')
      return await retrieveCart(cartId)
    }
    throw omnicartError(error)
  }
}

/**
 * Adds a line item to the cart
 */
export const addToCart = async (
  variantId: string,
  quantity: number = 1
) => {
  if (!variantId) {
    throw new Error("Variant ID is required")
  }

  const cart = await getOrCreateCart()

  if (!cart) {
    throw new Error("Failed to create or retrieve cart")
  }

  try {
    const headers = getStoreHeaders()

    await omnicartClient.post<CartResponse>(
      `/store/carts/${cart.id}/line-items`,
      {
        variant_id: variantId,
        quantity,
      },
      {
        headers,
      }
    )

    return await retrieveCart(cart.id)
  } catch (error: any) {
    try {
      const resp = error?.response as Response | undefined
      if (resp) {
        const text = await resp.text()
        console.error('addToCart response body:', text)
      }
    } catch {
      // ignore
    }
    throw omnicartError(error)
  }
}

/**
 * Updates a line item quantity
 *
 * If the update fails due to terminal payment sessions (e.g., Stripe PaymentIntent
 * in succeeded/canceled state), this function will automatically recreate the cart
 * with the updated quantities.
 */
export const updateLineItem = async (
  cartId: string,
  lineId: string,
  quantity: number
) => {
  if (!cartId || !lineId) {
    throw new Error("Cart ID and Line item ID are required")
  }

  try {
    const headers = getStoreHeaders()

    const response = await omnicartClient.post<CartResponse>(
      `/store/carts/${cartId}/line-items/${lineId}`,
      { quantity },
      {
        headers,
      }
    )

    return response.cart
  } catch (error: any) {
    // Check if error is due to terminal payment sessions
    if (isTerminalPaymentSessionError(error)) {
      console.warn('[updateLineItem] Payment session blocking cart modification, recreating cart...')

      try {
        // Get current cart to preserve items
        const currentCart = await retrieveCart(cartId)

        if (!currentCart?.items?.length) {
          throw new Error('No items in cart to update')
        }

        // Create a new cart
        const newCart = await createCart(currentCart.region?.id)

        if (!newCart) {
          throw new Error('Failed to create new cart')
        }

        // Add all items back with updated quantity for the target item
        for (const item of currentCart.items) {
          if (item.variant?.id) {
            const itemQuantity = item.id === lineId ? quantity : item.quantity
            await omnicartClient.post<CartResponse>(
              `/store/carts/${newCart.id}/line-items`,
              {
                variant_id: item.variant.id,
                quantity: itemQuantity,
              },
              {
                headers: getStoreHeaders(),
              }
            )
          }
        }

        console.log('[updateLineItem] Successfully recreated cart with updated quantities')

        // Return the updated cart
        const updatedCart = await retrieveCart(newCart.id)
        if (!updatedCart) {
          throw new Error('Failed to retrieve recreated cart')
        }
        return updatedCart
      } catch (recreateError) {
        console.error('[updateLineItem] Failed to recreate cart:', recreateError)
        throw recreateError
      }
    }

    throw omnicartError(error)
  }
}

/**
 * Removes a line item from the cart
 *
 * If the removal fails due to terminal payment sessions (e.g., Stripe PaymentIntent
 * in succeeded/canceled state), this function will automatically recreate the cart
 * with the remaining items.
 */
export const removeLineItem = async (cartId: string, lineId: string): Promise<Cart | null> => {
  if (!cartId || !lineId) {
    throw new Error("Cart ID and Line item ID are required")
  }

  try {
    const headers = getStoreHeaders()

    const response = await omnicartClient.delete<Partial<CartResponse>>(
      `/store/carts/${cartId}/line-items/${lineId}`,
      {
        headers,
      }
    )

    if (response && 'cart' in response && response.cart) {
      return response.cart
    }

    // Some deployments return an empty body or omit the cart payload after deletions.
    // In that case we refetch to keep local state consistent.
    return await retrieveCart(cartId)
  } catch (error: any) {
    // Check if error is due to terminal payment sessions
    // This happens when Stripe PaymentIntent is in succeeded/canceled state
    if (isTerminalPaymentSessionError(error)) {
      console.warn('[removeLineItem] Payment session blocking cart modification, recreating cart...')

      try {
        // Get current cart to preserve items
        const currentCart = await retrieveCart(cartId)

        if (!currentCart?.items?.length) {
          // No items to preserve, just clear the cart
          removeCartId()
          return null
        }

        // Filter out the item being removed
        const itemsToPreserve = currentCart.items.filter(item => item.id !== lineId)

        if (itemsToPreserve.length === 0) {
          // All items removed, clear the cart
          removeCartId()
          return null
        }

        // Create a new cart
        const newCart = await createCart(currentCart.region?.id)

        if (!newCart) {
          throw new Error('Failed to create new cart')
        }

        // Add preserved items back to the new cart
        for (const item of itemsToPreserve) {
          if (item.variant?.id) {
            await omnicartClient.post<CartResponse>(
              `/store/carts/${newCart.id}/line-items`,
              {
                variant_id: item.variant.id,
                quantity: item.quantity,
              },
              {
                headers: getStoreHeaders(),
              }
            )
          }
        }

        console.log('[removeLineItem] Successfully recreated cart with remaining items')

        // Return the updated cart
        return await retrieveCart(newCart.id)
      } catch (recreateError) {
        console.error('[removeLineItem] Failed to recreate cart:', recreateError)
        throw recreateError
      }
    }

    throw omnicartError(error)
  }
}

/**
 * Adds a shipping method to the cart
 */
export const addShippingMethod = async (
  cartId: string,
  shippingOptionId: string
) => {
  if (!cartId || !shippingOptionId) {
    throw new Error("Cart ID and shipping option ID are required")
  }

  try {
    const headers = getStoreHeaders()

    const response = await omnicartClient.post<CartResponse>(
      `/store/carts/${cartId}/shipping-methods`,
      { option_id: shippingOptionId },
      {
        headers,
      }
    )

    return response.cart
  } catch (error) {
    throw omnicartError(error)
  }
}

/**
 * Gets available shipping options for a cart
 */
export const getShippingOptions = async (cartId: string) => {
  if (!cartId) {
    throw new Error("Cart ID is required")
  }

  try {
    const headers = getStoreHeaders()

    const response = await omnicartClient.get<ShippingOptionsResponse>(
      `/store/shipping-options/${cartId}`,
      {
        headers,
      }
    )

    return response.shipping_options
  } catch (error) {
    throw omnicartError(error)
  }
}

/**
 * Creates payment sessions for a cart
 */
export const createPaymentSessions = async (cartId: string) => {
  if (!cartId) {
    throw new Error("Cart ID is required")
  }

  try {
    const headers = getStoreHeaders()

    const response = await omnicartClient.post<CartResponse>(
      `/store/carts/${cartId}/payment-sessions`,
      {},
      {
        headers,
      }
    )

    return response.cart
  } catch (error) {
    throw omnicartError(error)
  }
}

/**
 * Sets the selected payment session for a cart
 */
export const setPaymentSession = async (
  cartId: string,
  providerId: string
) => {
  if (!cartId || !providerId) {
    throw new Error("Cart ID and provider ID are required")
  }

  try {
    const headers = getStoreHeaders()

    const response = await omnicartClient.post<CartResponse>(
      `/store/carts/${cartId}/payment-session`,
      { provider_id: providerId },
      {
        headers,
      }
    )

    return response.cart
  } catch (error) {
    throw omnicartError(error)
  }
}

/**
 * Merges any stored attribution (Rumble _raclid, UTM params, etc.) into the
 * cart's metadata. Must be called before cart completion so the order
 * inherits the attribution and the server can fire downstream conversions.
 *
 * Safe to call multiple times — Medusa merges metadata server-side and the
 * same _raclid would just be written again. Never throws: any failure is
 * logged and swallowed so it cannot block order completion.
 */
export const mergeAttributionToCart = async (cartId: string): Promise<void> => {
  if (!cartId) return

  const attribution = getStoredAttribution()
  if (!attribution) return

  const metadata: Record<string, unknown> = { attribution }
  if (attribution._raclid) {
    metadata._raclid = attribution._raclid
  }

  try {
    const headers = getStoreHeaders()
    await omnicartClient.post<CartResponse>(
      `/store/carts/${cartId}`,
      { metadata },
      { headers }
    )
  } catch (metaError) {
    console.warn('[mergeAttributionToCart] Failed to attach attribution metadata:', metaError)
  }
}

/**
 * Completes a cart and converts it to an order.
 * Before completing, we merge any stored attribution into cart metadata
 * so the server can fire a Rumble conversion on purchase.
 */
export const completeCart = async (cartId: string) => {
  if (!cartId) {
    throw new Error("Cart ID is required")
  }

  try {
    const headers = getStoreHeaders()

    // Merge attribution into cart metadata before completing
    await mergeAttributionToCart(cartId)

    let response: OrderResponse
    try {
      response = await omnicartClient.post<OrderResponse>(
        `/store/carts/${cartId}/complete`,
        {},
        {
          headers,
        }
      )
    } catch (completeError) {
      // The PaymentIntent has already succeeded at this point, so the cart IS
      // payable. Medusa can still throw "Could not delete all payment sessions"
      // while trying to reconcile the now-terminal session during completion.
      // Retrying /complete once lets Medusa authorize against the existing
      // succeeded session and create the order, instead of leaving the customer
      // charged but the order stuck pending.
      if (isTerminalPaymentSessionError(completeError)) {
        console.warn('[completeCart] Terminal payment session on complete — retrying once against the succeeded PaymentIntent...')
        response = await omnicartClient.post<OrderResponse>(
          `/store/carts/${cartId}/complete`,
          {},
          {
            headers,
          }
        )
      } else {
        throw completeError
      }
    }

    // Clear the cart after successful checkout
    removeCartId()

    // The response might have either an 'order' or a 'cart' property
    // depending on the payment status
    return response.order || response.data
  } catch (error) {
    throw omnicartError(error)
  }
}

/**
 * Applies promotion codes to a cart
 */
export const applyPromotions = async (codes: string[]) => {
  const cartId = getCartId()

  if (!cartId) {
    throw new Error("No existing cart found")
  }

  try {
    const headers = getStoreHeaders()

    // Update cart with promo codes - Medusa will apply them
    await omnicartClient.post<CartResponse>(
      `/store/carts/${cartId}`,
      { promo_codes: codes },
      {
        headers,
      }
    )

    // Return the updated cart
    return retrieveCart(cartId)
  } catch (error) {
    throw omnicartError(error)
  }
}
