import type {
  KonnektiveCustomer,
  KonnektiveProduct,
  KonnektiveProductVariant,
  KonnektiveProductOption,
  KonnektiveOrder,
  KonnektiveOrderItem,
  KonnektiveAddress,
  KonnektiveTransaction,
} from "./konnektiveClient"
import type {
  OmnicartProduct,
  OmnicartProductVariant,
  OmnicartCustomer,
  OmnicartOrder,
} from "./omnicartAdminClient"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

// Load entity mappings configuration
const entityMappingsPath = resolve(__dirname, "entity-mappings.json")
const entityMappings = JSON.parse(readFileSync(entityMappingsPath, "utf8"))

export interface ProductUpsertPayload {
  title: string
  handle: string
  description?: string
  status: "draft" | "published"
  thumbnail?: string
  images?: Array<{ url: string }>
  collection_id?: string
  sales_channels?: Array<{ id: string }>
  categories?: Array<{ id: string }>
  tags?: Array<{ value: string }>
  type?: { value: string }
  metadata?: Record<string, any>
  weight?: number
  length?: number
  height?: number
  width?: number
  hs_code?: string
  origin_country?: string
  material?: string
  // Product options for variants
  options?: Array<{
    title: string
    values: Array<{ value: string }>
  }>
}

export interface VariantUpsertPayload {
  title: string
  sku?: string
  barcode?: string
  ean?: string
  upc?: string
  inventory_quantity?: number
  allow_backorder?: boolean
  manage_inventory?: boolean
  weight?: number
  length?: number
  height?: number
  width?: number
  hs_code?: string
  origin_country?: string
  material?: string
  metadata?: Record<string, any>
  prices?: Array<{
    currency_code: string
    amount: number
    region_id?: string
  }>
  options?: Array<{
    option_id: string
    value: string
  }>
}

export interface CustomerUpsertPayload {
  first_name?: string
  last_name?: string
  email: string
  phone?: string
  metadata?: Record<string, any>
  billing_address?: {
    first_name?: string
    last_name?: string
    company?: string
    address_1?: string
    address_2?: string
    city?: string
    province?: string
    postal_code?: string
    country_code?: string
    phone?: string
  }
  shipping_addresses?: Array<{
    first_name?: string
    last_name?: string
    company?: string
    address_1?: string
    address_2?: string
    city?: string
    province?: string
    postal_code?: string
    country_code?: string
    phone?: string
  }>
}

export interface OrderUpsertPayload {
  status: "pending" | "completed" | "archived" | "canceled" | "requires_action"
  email: string
  currency_code: string
  region_id: string
  sales_channel_id?: string
  customer_id?: string
  billing_address: {
    first_name?: string
    last_name?: string
    company?: string
    address_1?: string
    address_2?: string
    city?: string
    province?: string
    postal_code?: string
    country_code?: string
    phone?: string
  }
  shipping_address?: {
    first_name?: string
    last_name?: string
    company?: string
    address_1?: string
    address_2?: string
    city?: string
    province?: string
    postal_code?: string
    country_code?: string
    phone?: string
  }
  items: Array<{
    variant_id: string
    quantity: number
    unit_price: number
    title?: string
  }>
  shipping_methods?: Array<{
    option_id: string
    price: number
  }>
  metadata?: Record<string, any>
}

/**
 * Generate a URL-friendly handle from a title
 */
export function generateHandle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
}

/**
 * Map Konnektive customer to Medusa customer payload
 */
export function buildCustomerUpsertPayload(
  konnektiveCustomer: KonnektiveCustomer,
  regionId: string
): CustomerUpsertPayload {
  const mappings = entityMappings.entityMappings.customer.fieldMappings

  const payload: CustomerUpsertPayload = {
    email: konnektiveCustomer.emailAddress,
    first_name: konnektiveCustomer.firstName,
    last_name: konnektiveCustomer.lastName,
    phone: konnektiveCustomer.phoneNumber,
    metadata: {
      konnektive_customer_id: konnektiveCustomer.customerId,
      konnektive_date_created: konnektiveCustomer.dateCreated,
      konnektive_date_updated: konnektiveCustomer.dateUpdated,
      konnektive_campaign_id: konnektiveCustomer.campaignId,
      konnektive_affiliate_id: konnektiveCustomer.affiliateId,
      konnektive_sub_affiliate_id: konnektiveCustomer.subAffiliateId,
      konnektive_source_value_1: konnektiveCustomer.sourceValue1,
      konnektive_source_value_2: konnektiveCustomer.sourceValue2,
      konnektive_source_value_3: konnektiveCustomer.sourceValue3,
      konnektive_email_opt_in: konnektiveCustomer.emailOptIn,
      konnektive_sms_opt_in: konnektiveCustomer.smsOptIn,
      konnektive_marketing_opt_in: konnektiveCustomer.marketingOptIn,
      konnektive_custom_1: konnektiveCustomer.custom1,
      konnektive_custom_2: konnektiveCustomer.custom2,
      konnektive_custom_3: konnektiveCustomer.custom3,
      konnektive_custom_4: konnektiveCustomer.custom4,
      konnektive_custom_5: konnektiveCustomer.custom5,
    },
  }

  // Add billing address if available
  if (konnektiveCustomer.address1) {
    payload.billing_address = {
      first_name: konnektiveCustomer.firstName,
      last_name: konnektiveCustomer.lastName,
      company: konnektiveCustomer.companyName,
      address_1: konnektiveCustomer.address1,
      address_2: konnektiveCustomer.address2,
      city: konnektiveCustomer.city,
      province: konnektiveCustomer.state,
      postal_code: konnektiveCustomer.postalCode,
      country_code: konnektiveCustomer.country?.toUpperCase() || "US",
      phone: konnektiveCustomer.phoneNumber,
    }
  }

  return payload
}

/**
 * Map Konnektive product to Medusa product payload
 */
export function buildProductUpsertPayload(
  konnektiveProduct: KonnektiveProduct,
  collectionId?: string,
  salesChannelId?: string
): ProductUpsertPayload {
  const handle = generateHandle(konnektiveProduct.productName)

  const payload: ProductUpsertPayload = {
    title: konnektiveProduct.productName,
    handle,
    description: konnektiveProduct.productDescription || "",
    status: "published",
    metadata: {
      konnektive_product_id: konnektiveProduct.productId,
      konnektive_sku: konnektiveProduct.productSku,
      konnektive_category: konnektiveProduct.productCategory,
      konnektive_type: konnektiveProduct.productType,
      konnektive_date_created: konnektiveProduct.dateCreated,
      konnektive_custom_1: konnektiveProduct.custom1,
      konnektive_custom_2: konnektiveProduct.custom2,
      konnektive_custom_3: konnektiveProduct.custom3,
    },
  }

  if (collectionId) {
    payload.collection_id = collectionId
  }

  if (salesChannelId) {
    payload.sales_channels = [{ id: salesChannelId }]
  }

  if (konnektiveProduct.weight) {
    payload.weight = konnektiveProduct.weight
  }

  if (konnektiveProduct.productType) {
    payload.type = { value: konnektiveProduct.productType }
  }

  if (konnektiveProduct.productCategory) {
    payload.tags = [{ value: konnektiveProduct.productCategory }]
  }

  return payload
}

/**
 * Map Konnektive product to Medusa variant payload
 */
export function buildVariantUpsertPayload(
  konnektiveProduct: KonnektiveProduct,
  regionId: string,
  currencyCode = "USD"
): VariantUpsertPayload {
  const payload: VariantUpsertPayload = {
    title: konnektiveProduct.productName,
    sku: konnektiveProduct.productSku,
    inventory_quantity: konnektiveProduct.stockQuantity || 0,
    allow_backorder: konnektiveProduct.allowBackorders || false,
    manage_inventory: konnektiveProduct.trackInventory !== false,
    metadata: {
      konnektive_product_id: konnektiveProduct.productId,
      konnektive_sku: konnektiveProduct.productSku,
    },
  }

  if (konnektiveProduct.weight) {
    payload.weight = konnektiveProduct.weight
  }

  if (konnektiveProduct.productPrice) {
    payload.prices = [
      {
        currency_code: currencyCode,
        amount: Math.round(konnektiveProduct.productPrice * 100), // Convert to cents
        region_id: regionId,
      },
    ]
  }

  return payload
}

/**
 * Map Konnektive address to Medusa address format
 */
export function mapKonnektiveAddress(address: KonnektiveAddress) {
  return {
    first_name: address.firstName,
    last_name: address.lastName,
    company: address.companyName,
    address_1: address.address1,
    address_2: address.address2,
    city: address.city,
    province: address.state,
    postal_code: address.postalCode,
    country_code: address.country?.toUpperCase() || "US",
  }
}

/**
 * Map Konnektive order to Medusa order payload
 */
export function buildOrderUpsertPayload(
  konnektiveOrder: KonnektiveOrder,
  regionId: string,
  customerId?: string,
  salesChannelId?: string
): OrderUpsertPayload {
  const payload: OrderUpsertPayload = {
    status: mapKonnektiveOrderStatus(konnektiveOrder.orderStatus),
    email: konnektiveOrder.customerId, // This should be resolved to actual email
    currency_code: konnektiveOrder.currency || "USD",
    region_id: regionId,
    billing_address: mapKonnektiveAddress(konnektiveOrder.billingAddress),
    items: konnektiveOrder.items.map(item => ({
      variant_id: item.variantId || item.productId, // This needs to be resolved to Medusa variant ID
      quantity: item.quantity,
      unit_price: Math.round(item.price * 100), // Convert to cents
      title: `Product ${item.productId}`, // This should be resolved to actual product title
    })),
    metadata: {
      konnektive_order_id: konnektiveOrder.orderId,
      konnektive_customer_id: konnektiveOrder.customerId,
      konnektive_campaign_id: konnektiveOrder.campaignId,
      konnektive_order_type: konnektiveOrder.orderType,
      konnektive_total_amount: konnektiveOrder.totalAmount,
      konnektive_tax_amount: konnektiveOrder.taxAmount,
      konnektive_shipping_amount: konnektiveOrder.shippingAmount,
      konnektive_discount_amount: konnektiveOrder.discountAmount,
      konnektive_date_created: konnektiveOrder.dateCreated,
      konnektive_date_updated: konnektiveOrder.dateUpdated,
      konnektive_ip_address: konnektiveOrder.ipAddress,
      konnektive_sales_url: konnektiveOrder.salesUrl,
      konnektive_affiliate_id: konnektiveOrder.affiliateId,
      konnektive_source_value_1: konnektiveOrder.sourceValue1,
      konnektive_source_value_2: konnektiveOrder.sourceValue2,
      konnektive_source_value_3: konnektiveOrder.sourceValue3,
      konnektive_custom_1: konnektiveOrder.custom1,
      konnektive_custom_2: konnektiveOrder.custom2,
      konnektive_custom_3: konnektiveOrder.custom3,
      konnektive_custom_4: konnektiveOrder.custom4,
      konnektive_custom_5: konnektiveOrder.custom5,
    },
  }

  if (customerId) {
    payload.customer_id = customerId
  }

  if (salesChannelId) {
    payload.sales_channel_id = salesChannelId
  }

  if (konnektiveOrder.shippingAddress) {
    payload.shipping_address = mapKonnektiveAddress(konnektiveOrder.shippingAddress)
  }

  return payload
}

/**
 * Map Konnektive order status to Medusa order status
 */
function mapKonnektiveOrderStatus(konnektiveStatus: string): OrderUpsertPayload["status"] {
  const statusMap: Record<string, OrderUpsertPayload["status"]> = {
    "COMPLETE": "completed",
    "PENDING": "pending",
    "CANCELLED": "canceled",
    "REFUNDED": "canceled",
    "PARTIAL": "requires_action",
    "ARCHIVED": "archived",
  }

  return statusMap[konnektiveStatus?.toUpperCase()] || "pending"
}
