// @ts-nocheck
import { setTimeout as delay } from "timers/promises"
import type { ShopifyOmnicartConfig } from "./config.ts"

interface RequestOptions {
  method?: string
  body?: unknown
  query?: Record<string, string | number | undefined>
  headers?: Record<string, string>
  attempt?: number
  skipRetry?: boolean
}

export interface OmnicartProduct {
  id: string
  title: string
  handle: string
  description: string | null
  status: string
  thumbnail: string | null
  options: Array<{ id: string; title: string; values: Array<{ id: string; value: string }> }>
  variants: Array<{
    id: string
    title: string
    sku: string | null
    allow_backorder: boolean
    manage_inventory: boolean
    inventory_quantity: number
    options: Array<{ id: string; option_id: string; value: string }>
    prices: Array<{ id: string; amount: number; currency_code: string }>
    metadata?: Record<string, unknown>
  }>
  images: Array<{ id: string; url: string }>
  metadata?: Record<string, unknown>
  collection?: { id: string; title: string }
  collection_id?: string | null
  sales_channels?: Array<{ id: string; name: string }>
  created_at: string
  updated_at: string
}

export interface OmnicartCollection {
  id: string
  title: string
  handle: string
}

export interface OmnicartSalesChannel {
  id: string
  name: string
  description?: string
  is_disabled: boolean
}

export interface OmnicartStockLocation {
  id: string
  name: string
  address: {
    address_1: string
    address_2?: string
    city: string
    country_code: string
    province?: string
    postal_code: string
    phone?: string
  }
  metadata?: Record<string, unknown>
}

export interface OmnicartInventoryItem {
  id: string
  sku?: string
  origin_country?: string
  hs_code?: string
  mid_code?: string
  material?: string
  weight?: number
  length?: number
  height?: number
  width?: number
  requires_shipping: boolean
  metadata?: Record<string, unknown>
}

export interface OmnicartProductVariant {
  id: string
  title: string
  sku: string | null
  allow_backorder: boolean
  manage_inventory: boolean
  inventory_quantity: number
  options: Array<{ id: string; option_id: string; value: string }>
  prices: Array<{ id: string; amount: number; currency_code: string }>
  metadata?: Record<string, unknown>
}

export interface OmnicartCustomer {
  id: string
  email: string
  first_name?: string
  last_name?: string
  phone?: string
  billing_address?: any
  shipping_addresses?: any[]
  metadata?: Record<string, unknown>
}

export interface OmnicartOrder {
  id: string
  display_id: number
  status: string
  customer_id?: string
  customer?: OmnicartCustomer
  email?: string
  currency_code: string
  total: number
  subtotal: number
  tax_total: number
  shipping_total: number
  items: Array<{
    id: string
    title: string
    quantity: number
    unit_price: number
    total: number
    variant_id?: string
    variant?: OmnicartProductVariant
  }>
  billing_address?: any
  shipping_address?: any
  metadata?: Record<string, unknown>
}

export class OmnicartAdminClient {
  private readonly baseUrl: string
  private readonly token: string
  private readonly timeout: number
  private readonly salesChannelId?: string

  constructor(config: ShopifyOmnicartConfig) {
    this.baseUrl = `${config.medusaAdminUrl}/admin`
    this.token = config.medusaAdminToken
    this.timeout = config.requestTimeoutMs
    this.salesChannelId = config.medusaSalesChannelId
  }

  private buildQuery(query?: RequestOptions["query"]): string {
    if (!query) return ""
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null) continue
      params.append(key, String(value))
    }
    const qs = params.toString()
    return qs ? `?${qs}` : ""
  }

  private async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const attempt = options.attempt ?? 0
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    try {
      const response = await fetch(`${this.baseUrl}${path}${this.buildQuery(options.query)}`, {
        method: options.method ?? "GET",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Basic ${Buffer.from(`${this.token}:`).toString("base64")}`,
          ...options.headers,
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      })

      if (response.status >= 500 && attempt < 3 && !options.skipRetry) {
        await delay(Math.pow(2, attempt) * 500)
        return this.request(path, { ...options, attempt: attempt + 1 })
      }

      if (!response.ok) {
        const text = await response.text()
        throw new Error(`Medusa admin error ${response.status}: ${text}`)
      }

      if (response.status === 204) {
        return undefined as T
      }

      const payload = (await response.json()) as T
      return payload
    } finally {
      clearTimeout(timeoutId)
    }
  }

  private filterProductsBySalesChannel(products: OmnicartProduct[] = []): OmnicartProduct[] {
    if (!this.salesChannelId) return products
    return products.filter((product) =>
      (product.sales_channels ?? []).some((channel) => channel.id === this.salesChannelId)
    )
  }

  async listProductsByShopifyId(shopifyProductId: string): Promise<OmnicartProduct[]> {
    // Note: Medusa API metadata filtering is broken, so we need to filter client-side
    const response = await this.request<{ products: OmnicartProduct[] }>("/products", {
      query: {
        fields: "*variants,*options,*variants.prices,*metadata,*images,*sales_channels",
        limit: 100, // Get more products to search through
      },
    })

    const scopedProducts = this.filterProductsBySalesChannel(response.products ?? [])

    // Filter client-side to find products with matching Shopify ID
    const matchingProducts = scopedProducts.filter(product =>
      product.metadata?.shopify_product_id === shopifyProductId
    )

    return matchingProducts
  }

  async retrieveProduct(productId: string): Promise<OmnicartProduct> {
    const response = await this.request<{ product: OmnicartProduct }>(`/products/${productId}`, {
      query: {
        fields: "*variants,*options,*variants.prices,*metadata,*images,*sales_channels",
      },
    })
    return response.product
  }

  async listProducts(limit: number = 100, offset: number = 0): Promise<OmnicartProduct[]> {
    const response = await this.request<{ products: OmnicartProduct[] }>(`/products`, {
      query: {
        limit: limit.toString(),
        offset: offset.toString(),
        fields: "*variants,*options,*variants.prices,*metadata,*images,*sales_channels",
      },
    })
    return this.filterProductsBySalesChannel(response.products ?? [])
  }

  async createProduct(payload: Record<string, unknown>): Promise<OmnicartProduct> {
    const response = await this.request<{ product: OmnicartProduct }>("/products", {
      method: "POST",
      body: payload,
    })
    return response.product
  }

  async updateProduct(productId: string, payload: Record<string, unknown>): Promise<OmnicartProduct> {
    const response = await this.request<{ product: OmnicartProduct }>(`/products/${productId}`, {
      method: "POST",
      body: payload,
    })
    return response.product
  }

  async createProductOption(productId: string, payload: { title: string; values?: string[] }): Promise<void> {
    await this.request(`/products/${productId}/options`, {
      method: "POST",
      body: {
        title: payload.title,
        values: payload.values || [],
      },
    })
  }

  async updateProductOption(productId: string, optionId: string, payload: { title: string; values?: string[] }): Promise<void> {
    await this.request(`/products/${productId}/options/${optionId}`, {
      method: "POST",
      body: {
        title: payload.title,
        values: payload.values || [],
      },
    })
  }

  async deleteProductOption(productId: string, optionId: string): Promise<void> {
    await this.request(`/products/${productId}/options/${optionId}`, {
      method: "DELETE",
    })
  }

  async createVariant(productId: string, payload: Record<string, unknown>): Promise<void> {
    await this.request(`/products/${productId}/variants`, {
      method: "POST",
      body: payload,
    })
  }

  async addProductToSalesChannel(productId: string, salesChannelId: string): Promise<void> {
    await this.request(`/sales-channels/${salesChannelId}/products`, {
      method: "POST",
      body: {
        add: [productId]
      },
    })
  }

  async validateOptionValues(productId: string, optionMapping: Record<string, string>): Promise<boolean> {
    try {
      const product = await this.retrieveProduct(productId)

      for (const [optionId, value] of Object.entries(optionMapping)) {
        const option = product.options.find(opt => opt.id === optionId)
        if (!option) {
          console.log(`❌ Option ${optionId} not found`)
          return false
        }

        const valueExists = option.values?.some(v => v.value === value)
        if (!valueExists) {
          console.log(`❌ Option value "${value}" not found for option "${option.title}" (${optionId})`)
          console.log(`Available values: [${option.values?.map(v => v.value).join(", ") || "none"}]`)
          return false
        }
      }

      console.log(`✅ All option values validated for variant`)
      return true
    } catch (error) {
      console.log(`❌ Error validating option values:`, error.message)
      return false
    }
  }

  async updateVariant(productId: string, variantId: string, payload: Record<string, unknown>): Promise<void> {
    await this.request(`/products/${productId}/variants/${variantId}`, {
      method: "POST",
      body: payload,
    })
  }

  async deleteVariant(productId: string, variantId: string): Promise<void> {
    await this.request(`/products/${productId}/variants/${variantId}`, {
      method: "DELETE",
    })
  }

  async createPrice(variantId: string, payload: Record<string, unknown>): Promise<void> {
    await this.request(`/variants/${variantId}/prices`, {
      method: "POST",
      body: payload,
    })
  }

  async updatePrice(priceId: string, payload: Record<string, unknown>): Promise<void> {
    await this.request(`/variants/prices/${priceId}`, {
      method: "POST",
      body: payload,
    })
  }

  async addProductImages(productId: string, imageUrls: string[]): Promise<void> {
    if (imageUrls.length === 0) return

    // Get current product to preserve existing images
    const currentProduct = await this.retrieveProduct(productId)
    const existingImages = currentProduct.images?.map(img => ({ url: img.url })) || []

    // Filter out duplicates
    const newImageUrls = imageUrls.filter(url =>
      !existingImages.some(existing => existing.url === url)
    )

    if (newImageUrls.length === 0) return

    // Add images one at a time to avoid server overload (503 errors)
    let successCount = 0
    for (let i = 0; i < newImageUrls.length; i++) {
      const imageUrl = newImageUrls[i]

      try {
        // Get current state for this image
        const currentState = await this.retrieveProduct(productId)
        const currentImages = currentState.images?.map(img => ({ url: img.url })) || []

        // Check if image was already added by a previous operation
        if (currentImages.some(img => img.url === imageUrl)) {
          continue
        }

        const allImages = [...currentImages, { url: imageUrl }]

        await this.request(`/products/${productId}`, {
          method: "POST",
          body: { images: allImages },
        })

        successCount++

        // Small delay between images to avoid overwhelming the server
        if (i < newImageUrls.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000))
        }

      } catch (error) {
        console.warn(`Failed to add image ${i + 1}/${newImageUrls.length} to product ${productId}:`, error instanceof Error ? error.message : error)
        // Continue with next image instead of failing completely
      }
    }

    if (successCount < newImageUrls.length) {
      console.warn(`Successfully added ${successCount}/${newImageUrls.length} images to product ${productId}`)
    }
  }

  async setProductThumbnail(productId: string, thumbnailUrl: string): Promise<void> {
    await this.request(`/products/${productId}`, {
      method: "POST",
      body: { thumbnail: thumbnailUrl },
    })
  }

  async uploadImage(fileBuffer: ArrayBuffer, fileName: string, mimeType: string): Promise<string> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    try {
      // Create FormData with File object as per Medusa API docs
      const formData = new FormData()
      const blob = new Blob([fileBuffer], { type: mimeType })
      const file = new File([blob], fileName, { type: mimeType })
      formData.append("files", file)

      const response = await fetch(`${this.baseUrl}/uploads`, {
        method: "POST",
        headers: {
          "Authorization": `Basic ${Buffer.from(`${this.token}:`).toString("base64")}`,
        },
        body: formData,
        signal: controller.signal,
      })

      if (!response.ok) {
        const text = await response.text()
        throw new Error(`Medusa upload failed ${response.status}: ${text}`)
      }

      const payload = (await response.json()) as { files: Array<{ id: string; url: string }> }
      const url = payload.files?.[0]?.url
      if (!url) {
        throw new Error("Medusa upload response missing URL")
      }

      // Rewrite localhost upload URLs to the configured public admin origin.
      const publicBase = this.baseUrl.replace(/\/admin$/, '')
      const fixedUrl = url.replace('http://localhost:9000', publicBase)
      return fixedUrl
    } finally {
      clearTimeout(timeoutId)
    }
  }

  async listCollections(): Promise<OmnicartCollection[]> {
    const response = await this.request<{ collections: OmnicartCollection[] }>("/collections", {
      query: { limit: 100 },
    })
    return response.collections ?? []
  }

  async createCollection(payload: { title: string; handle?: string }): Promise<OmnicartCollection> {
    const response = await this.request<{ collection: OmnicartCollection }>("/collections", {
      method: "POST",
      body: payload,
    })
    return response.collection
  }

  async listSalesChannels(): Promise<OmnicartSalesChannel[]> {
    const response = await this.request<{ sales_channels: OmnicartSalesChannel[] }>("/sales-channels", {
      query: { limit: 100 },
    })
    return response.sales_channels ?? []
  }

  async createSalesChannel(payload: { name: string; description?: string }): Promise<OmnicartSalesChannel> {
    const response = await this.request<{ sales_channel: OmnicartSalesChannel }>("/sales-channels", {
      method: "POST",
      body: payload,
    })
    return response.sales_channel
  }



  // Stock Location methods
  async listStockLocations(): Promise<OmnicartStockLocation[]> {
    const response = await this.request<{ stock_locations: OmnicartStockLocation[] }>("/stock-locations", {
      query: { limit: 100 },
    })
    return response.stock_locations ?? []
  }

  async createStockLocation(payload: {
    name: string
    address: any
    metadata?: Record<string, unknown>
  }): Promise<OmnicartStockLocation> {
    const response = await this.request<{ stock_location: OmnicartStockLocation }>("/stock-locations", {
      method: "POST",
      body: payload,
    })
    return response.stock_location
  }

  async updateStockLocation(id: string, payload: {
    name?: string
    address?: any
    metadata?: Record<string, unknown>
  }): Promise<OmnicartStockLocation> {
    const response = await this.request<{ stock_location: OmnicartStockLocation }>(`/stock-locations/${id}`, {
      method: "POST",
      body: payload,
    })
    return response.stock_location
  }

  // Inventory Item methods
  async listInventoryItems(params?: Record<string, unknown>): Promise<OmnicartInventoryItem[]> {
    const response = await this.request<{ inventory_items: OmnicartInventoryItem[] }>("/inventory-items", {
      query: params,
    })
    return response.inventory_items ?? []
  }

  async createInventoryItem(payload: {
    sku?: string | null
    title?: string
    description?: string
    origin_country?: string
    hs_code?: string
    mid_code?: string
    material?: string
    weight?: number
    length?: number
    height?: number
    width?: number
    requires_shipping?: boolean
    metadata?: Record<string, unknown>
  }): Promise<OmnicartInventoryItem> {
    const response = await this.request<{ inventory_item: OmnicartInventoryItem }>("/inventory-items", {
      method: "POST",
      body: payload,
    })
    return response.inventory_item
  }

  async updateInventoryLevel(
    inventoryItemId: string,
    locationId: string,
    quantity: number
  ): Promise<void> {
    // Try to update existing level first
    try {
      await this.request(`/inventory-items/${inventoryItemId}/location-levels/${locationId}`, {
        method: "POST",
        body: {
          stocked_quantity: quantity,
        },
      })
    } catch (error) {
      // If update fails, try to create new level
      await this.request(`/inventory-items/${inventoryItemId}/location-levels`, {
        method: "POST",
        body: {
          location_id: locationId,
          stocked_quantity: quantity,
        },
      })
    }
  }

  // Customer methods
  async listCustomers(limit: number = 100, offset: number = 0): Promise<OmnicartCustomer[]> {
    const response = await this.request<{ customers: OmnicartCustomer[] }>("/customers", {
      query: { limit: limit.toString(), offset: offset.toString() },
    })
    return response.customers ?? []
  }

  async createCustomer(payload: Record<string, unknown>): Promise<OmnicartCustomer> {
    const response = await this.request<{ customer: OmnicartCustomer }>("/customers", {
      method: "POST",
      body: payload,
    })
    return response.customer
  }

  async updateCustomer(customerId: string, payload: Record<string, unknown>): Promise<OmnicartCustomer> {
    const response = await this.request<{ customer: OmnicartCustomer }>(`/customers/${customerId}`, {
      method: "POST",
      body: payload,
    })
    return response.customer
  }

  // Order methods
  async listOrders(limit: number = 100, offset: number = 0): Promise<OmnicartOrder[]> {
    const response = await this.request<{ orders: OmnicartOrder[] }>("/orders", {
      query: { limit: limit.toString(), offset: offset.toString() },
    })
    return response.orders ?? []
  }

  async createOrder(payload: Record<string, unknown>): Promise<OmnicartOrder> {
    const response = await this.request<{ order: OmnicartOrder }>("/orders", {
      method: "POST",
      body: payload,
    })
    return response.order
  }

  async addProductOption(productId: string, payload: { title: string; values?: Array<{ value: string }> }): Promise<void> {
    await this.request(`/products/${productId}/options`, {
      method: "POST",
      body: payload,
    })
  }

  async getProduct(productId: string): Promise<OmnicartProduct> {
    return this.retrieveProduct(productId)
  }

  // Helper method to get products with Shopify metadata
  async listProductsWithShopifyMetadata(): Promise<OmnicartProduct[]> {
    const response = await this.request<{ products: OmnicartProduct[] }>("/products", {
      query: {
        limit: 100,
        expand: "variants,variants.prices",
      },
    })

    return this.filterProductsBySalesChannel(response.products ?? []).filter(product =>
      product.metadata?.shopify_product_id
    )
  }
}
