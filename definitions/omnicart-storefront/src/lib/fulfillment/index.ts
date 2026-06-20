/**
 * Fulfillment Provider Management
 *
 * Utilities for managing ShipStation and Manual fulfillment providers
 * in the Medusa backend.
 */

import Medusa from '@medusajs/js-sdk'
import {
  OMNICART_SDK_BASE_URL,
  OMNICART_PUBLISHABLE_KEY,
  OMNICART_REGION_ID,
  OMNICART_INVENTORY_LOCATION_ID,
  OMNICART_SALES_CHANNEL_ID,
  OMNICART_BACKEND_URL,
} from '../omnicart-config'

// Initialize Medusa storefront client (publishable key only; never an admin key).
// Use the ABSOLUTE base URL — the Medusa SDK calls `new URL(baseUrl)` internally
// and rejects the same-origin relative proxy path ("/api/omnicart").
const medusa = new Medusa({
  baseUrl: OMNICART_SDK_BASE_URL,
  ...(OMNICART_PUBLISHABLE_KEY ? { publishableKey: OMNICART_PUBLISHABLE_KEY } : {}),
})

/**
 * Fulfillment Provider Types
 */
export enum FulfillmentProviderType {
  SHIPSTATION = 'shipstation',
  MANUAL = 'manual'
}

/**
 * Fulfillment Provider Configuration
 */
export interface FulfillmentProviderConfig {
  provider_id: FulfillmentProviderType
  is_enabled: boolean
  options: Record<string, any>
}

/**
 * Fulfillment Set Configuration
 */
export interface FulfillmentSetConfig {
  name: string
  type: 'delivery_point' | 'pickup_point'
  service_zones: Array<{ service_area_id: string }>
  options?: Record<string, any>
}

/**
 * Shipping Option Configuration
 */
export interface ShippingOptionConfig {
  name: string
  description?: string
  service_zone_id: string
  fulfillment_set_id: string
  type: 'shipping'
  data?: Record<string, any>
  rules: Array<{
    attribute: string
    operator: string
    value: string | number
    price: number
  }>
}

/**
 * Get available fulfillment providers
 *
 * @returns {Promise<any>} List of available providers
 */
export async function getFulfillmentProviders() {
  try {
    // Note: This is an admin endpoint, requires proper authentication
    // Can be called from backend/API route
    console.log('Fetching fulfillment providers...')
    // Implementation depends on backend setup
    return null
  } catch (error) {
    console.error('Error fetching fulfillment providers:', error)
    throw error
  }
}

/**
 * Get available shipping options for a cart
 *
 * @param {string} cartId - Cart ID
 * @returns {Promise<any>} Available shipping options
 */
export async function getShippingOptions(cartId: string) {
  try {
    const { shipping_options } = await medusa.store.fulfillment.listCartOptions({ cart_id: cartId })
    return shipping_options || []
  } catch (error) {
    console.error('Error fetching shipping options:', error)
    throw error
  }
}

/**
 * Add shipping method to cart
 *
 * @param {string} cartId - Cart ID
 * @param {string} optionId - Shipping option ID
 * @returns {Promise<any>} Updated cart
 */
export async function addShippingMethod(cartId: string, optionId: string) {
  try {
    const { cart } = await medusa.store.cart.addShippingMethod(cartId, {
      option_id: optionId
    })
    return cart
  } catch (error) {
    console.error('Error adding shipping method:', error)
    throw error
  }
}

/**
 * Get available fulfillment sets
 * (Requires admin access)
 */
export async function getFulfillmentSets() {
  try {
    console.log('Fetching fulfillment sets...')
    // Admin endpoint - implement in backend API route
    return null
  } catch (error) {
    console.error('Error fetching fulfillment sets:', error)
    throw error
  }
}

/**
 * Create a fulfillment (ShipStation or Manual)
 *
 * @param {string} orderId - Order ID
 * @param {string} providerId - Provider ID ('shipstation' or 'manual')
 * @param {Array} items - Items to fulfill
 * @param {Record<string, any>} data - Provider-specific data
 * @returns {Promise<any>} Created fulfillment
 */
export async function createFulfillment(
  orderId: string,
  providerId: string,
  items: Array<{ item_id: string; quantity: number }>,
  data?: Record<string, any>
) {
  try {
    console.log(`Creating ${providerId} fulfillment for order ${orderId}`)
    // Admin endpoint - implement in backend API route
    return null
  } catch (error) {
    console.error('Error creating fulfillment:', error)
    throw error
  }
}

/**
 * Update shipment with tracking information
 *
 * @param {string} shipmentId - Shipment ID
 * @param {string} trackingNumber - Tracking number
 * @param {string} trackingUrl - Tracking URL (optional)
 * @returns {Promise<any>} Updated shipment
 */
export async function updateShipmentTracking(
  shipmentId: string,
  trackingNumber: string,
  trackingUrl?: string
) {
  try {
    console.log(`Updating shipment ${shipmentId} with tracking ${trackingNumber}`)
    // Admin endpoint - implement in backend API route
    return null
  } catch (error) {
    console.error('Error updating shipment tracking:', error)
    throw error
  }
}

/**
 * Check ShipStation API connection
 *
 * @param {string} apiKey - ShipStation API key
 * @param {string} apiSecret - ShipStation API secret
 * @returns {Promise<boolean>} Connection status
 */
export async function testShipStationConnection(
  apiKey: string,
  apiSecret: string
): Promise<boolean> {
  try {
    const credentials = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')
    const response = await fetch('https://api.shipstation.com/accounts', {
      headers: {
        Authorization: `Basic ${credentials}`
      }
    })
    return response.ok
  } catch (error) {
    console.error('Error testing ShipStation connection:', error)
    return false
  }
}

/**
 * Get ShipStation warehouses
 *
 * @param {string} apiKey - ShipStation API key
 * @param {string} apiSecret - ShipStation API secret
 * @returns {Promise<any>} List of warehouses
 */
export async function getShipStationWarehouses(
  apiKey: string,
  apiSecret: string
) {
  try {
    const credentials = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')
    const response = await fetch('https://api.shipstation.com/warehouses', {
      headers: {
        Authorization: `Basic ${credentials}`
      }
    })
    return response.json()
  } catch (error) {
    console.error('Error fetching ShipStation warehouses:', error)
    throw error
  }
}

/**
 * Get ShipStation orders
 *
 * @param {string} apiKey - ShipStation API key
 * @param {string} apiSecret - ShipStation API secret
 * @param {string} status - Order status filter
 * @returns {Promise<any>} List of orders
 */
export async function getShipStationOrders(
  apiKey: string,
  apiSecret: string,
  status: string = 'awaiting_shipment'
) {
  try {
    const credentials = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')
    const response = await fetch(
      `https://api.shipstation.com/orders?orderStatus=${status}`,
      {
        headers: {
          Authorization: `Basic ${credentials}`
        }
      }
    )
    return response.json()
  } catch (error) {
    console.error('Error fetching ShipStation orders:', error)
    throw error
  }
}

/**
 * Shipping Option Helper - Standard Shipping
 */
export const SHIPPING_OPTION_STANDARD = {
  name: 'Standard Shipping',
  description: '4-7 business days via FedEx Ground',
  type: 'shipping',
  data: {
    carrier: 'fedex',
    service: 'GROUND'
  },
  rules: [
    {
      attribute: 'total',
      operator: 'gte',
      value: '0',
      price: 999 // $9.99
    }
  ]
}

/**
 * Shipping Option Helper - Expedited Shipping
 */
export const SHIPPING_OPTION_EXPEDITED = {
  name: 'Expedited Shipping',
  description: '1-2 business days via FedEx Next Day Air',
  type: 'shipping',
  data: {
    carrier: 'fedex',
    service: 'OVERNIGHT'
  },
  rules: [
    {
      attribute: 'total',
      operator: 'gte',
      value: '0',
      price: 2499 // $24.99
    }
  ]
}

/**
 * Shipping Option Helper - Local Pickup
 */
export const SHIPPING_OPTION_LOCAL_PICKUP = {
  name: 'Local Pickup',
  description: 'Pick up at our main location',
  type: 'shipping',
  data: {
    location: 'headquarters',
    hours: 'Mon-Fri 9AM-5PM'
  },
  rules: [
    {
      attribute: 'total',
      operator: 'gte',
      value: '0',
      price: 0 // Free
    }
  ]
}

/**
 * Configuration Constants
 *
 * Store ids resolve from the central config; admin URL/token resolve from the
 * server-side environment ONLY. Admin tokens are NOT browser-safe and MUST NOT
 * be hardcoded — leave the env unset in client builds.
 */
export const FULFILLMENT_CONFIG = {
  REGION_ID: OMNICART_REGION_ID,
  LOCATION_ID: OMNICART_INVENTORY_LOCATION_ID,
  SALES_CHANNEL_ID: OMNICART_SALES_CHANNEL_ID,
  ADMIN_TOKEN: (typeof process !== 'undefined' && process.env?.OMNICART_ADMIN_TOKEN) || '',
  ADMIN_URL: (typeof process !== 'undefined' && process.env?.OMNICART_ADMIN_URL) || OMNICART_BACKEND_URL
}

export default {
  getShippingOptions,
  addShippingMethod,
  createFulfillment,
  updateShipmentTracking,
  testShipStationConnection,
  getShipStationWarehouses,
  getShipStationOrders,
  FULFILLMENT_CONFIG
}
