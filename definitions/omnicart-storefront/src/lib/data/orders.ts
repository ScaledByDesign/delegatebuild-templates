import { omnicartClient } from "../omnicart-client"
import omnicartError from "../util/omnicart-error"
import { getAuthHeaders } from "../util/cookies"

// Define response types
type OrdersResponse = {
  orders: any[]
  count: number
  limit: number
  offset: number
}

type OrderResponse = {
  order: any
}

/**
 * Fetches a list of customer's orders
 */
export const getCustomerOrders = async (limit = 10, offset = 0) => {
  try {
    const headers = {
      ...getAuthHeaders(),
    }

    // If no auth token exists, return empty results
    if (Object.keys(headers).length === 0) {
      return { orders: [], count: 0, limit, offset }
    }

    const response = await omnicartClient.fetch(
      "/store/customers/me/orders",
      {
        method: "GET",
        query: {
          limit,
          offset,
          expand: "shipping_address,billing_address,items,items.variant,shipping_methods"
        },
        headers,
      }
    ) as OrdersResponse

    return response
  } catch (error) {
    throw omnicartError(error)
  }
}

/**
 * Fetches a specific order by ID
 */
export const getOrder = async (orderId: string) => {
  if (!orderId) {
    throw new Error("Order ID is required")
  }

  try {
    const headers = {
      ...getAuthHeaders(),
    }

    const response = await omnicartClient.fetch(
      `/store/orders/${orderId}`,
      {
        method: "GET",
        query: {
          expand: "shipping_address,billing_address,items,items.variant,shipping_methods"
        },
        headers,
      }
    ) as OrderResponse

    return response.order
  } catch (error) {
    throw omnicartError(error)
  }
}

/**
 * Looks up an order by its display ID or email
 */
export const lookupOrder = async (displayId: string, email: string) => {
  if (!displayId || !email) {
    throw new Error("Display ID and email are required")
  }

  try {
    const response = await omnicartClient.fetch(
      "/store/orders/",
      {
        method: "GET",
        query: {
          display_id: displayId,
          email,
          expand: "shipping_address,billing_address,items,items.variant,shipping_methods"
        },
        headers: {
          "Content-Type": "application/json",
        },
      }
    ) as OrdersResponse

    if (response.orders.length === 0) {
      return null
    }

    return response.orders[0]
  } catch (error) {
    throw omnicartError(error)
  }
}
