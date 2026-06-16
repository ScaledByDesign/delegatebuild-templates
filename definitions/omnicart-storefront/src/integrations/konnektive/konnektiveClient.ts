import type { KonnektiveMedusaConfig } from "./config"

export interface KonnektiveCustomer {
  customerId: string
  firstName: string
  lastName: string
  emailAddress: string
  phoneNumber?: string
  companyName?: string
  address1: string
  address2?: string
  city: string
  state: string
  country: string
  postalCode: string
  dateCreated: string
  dateUpdated: string
  gender?: string
  dateOfBirth?: string
  campaignId?: string
  affiliateId?: string
  subAffiliateId?: string
  sourceValue1?: string
  sourceValue2?: string
  sourceValue3?: string
  emailOptIn?: boolean
  smsOptIn?: boolean
  marketingOptIn?: boolean
  custom1?: string
  custom2?: string
  custom3?: string
  custom4?: string
  custom5?: string
}

export interface KonnektiveProduct {
  productId: string
  productName: string
  productSku?: string
  productPrice?: number
  stockQuantity?: number
  productDescription?: string
  productCategory?: string
  productType?: string
  weight?: number
  dimensions?: string
  trackInventory?: boolean
  allowBackorders?: boolean
  dateCreated: string
  custom1?: string
  custom2?: string
  custom3?: string
  // Product variations/options
  variants?: KonnektiveProductVariant[]
  options?: KonnektiveProductOption[]
}

export interface KonnektiveProductVariant {
  variantDetailId: string
  variantName?: string
  variantSku?: string
  variantPrice?: number
  stockQuantity?: number
  weight?: number
  dimensions?: string
  optionValues?: Record<string, string> // e.g., { "Size": "Large", "Color": "Red" }
  isDefault?: boolean
}

export interface KonnektiveProductOption {
  optionName: string
  optionValues: string[]
}

export interface KonnektiveOrder {
  orderId: string
  customerId: string
  campaignId: string
  orderStatus: string
  orderType: string
  totalAmount: number
  taxAmount?: number
  shippingAmount?: number
  discountAmount?: number
  currency: string
  dateCreated: string
  dateUpdated: string
  ipAddress?: string
  salesUrl?: string
  affiliateId?: string
  sourceValue1?: string
  sourceValue2?: string
  sourceValue3?: string
  custom1?: string
  custom2?: string
  custom3?: string
  custom4?: string
  custom5?: string
  billingAddress: KonnektiveAddress
  shippingAddress?: KonnektiveAddress
  items: KonnektiveOrderItem[]
}

export interface KonnektiveAddress {
  firstName: string
  lastName: string
  companyName?: string
  address1: string
  address2?: string
  city: string
  state: string
  country: string
  postalCode: string
}

export interface KonnektiveOrderItem {
  productId: string
  quantity: number
  price: number
  shipPrice?: number
  variantId?: string
}

export interface KonnektiveTransaction {
  transactionId: string
  orderId: string
  customerId: string
  transactionAmount: number
  currency: string
  transactionType: string
  transactionStatus: string
  transactionDate: string
  paymentMethod?: string
  cardType?: string
  cardLast4?: string
  gatewayId?: string
  gatewayTransactionId?: string
  authCode?: string
  responseCode?: string
  reasonCode?: string
}

export interface KonnektiveApiResponse<T = any> {
  result: "SUCCESS" | "ERROR"
  message: T | string
}

export interface KonnektiveQueryParams {
  loginId: string
  password: string
  [key: string]: any
}

export class KonnektiveApiClient {
  private baseUrl: string
  private loginId: string
  private password: string
  private timeout: number

  constructor(config: KonnektiveMedusaConfig) {
    this.baseUrl = config.konnektiveApiUrl
    this.loginId = config.konnektiveLoginId
    this.password = config.konnektivePassword
    this.timeout = config.requestTimeoutMs
  }

  private async makeRequest<T>(
    endpoint: string,
    params: Record<string, any> = {},
    method: "GET" | "POST" = "POST"
  ): Promise<KonnektiveApiResponse<T>> {
    const queryParams: KonnektiveQueryParams = {
      loginId: this.loginId,
      password: this.password,
      ...params,
    }

    const url = `${this.baseUrl}${endpoint}`
    
    try {
      let response: Response

      if (method === "GET") {
        const urlParams = new URLSearchParams()
        Object.entries(queryParams).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            urlParams.append(key, String(value))
          }
        })
        response = await fetch(`${url}?${urlParams.toString()}`, {
          method: "GET",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          signal: AbortSignal.timeout(this.timeout),
        })
      } else {
        const formData = new URLSearchParams()
        Object.entries(queryParams).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            formData.append(key, String(value))
          }
        })

        response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: formData.toString(),
          signal: AbortSignal.timeout(this.timeout),
        })
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      return data as KonnektiveApiResponse<T>
    } catch (error) {
      console.error(`Konnektive API request failed for ${endpoint}:`, error)
      throw error
    }
  }

  /**
   * Query customers from Konnektive
   */
  async queryCustomers(params: {
    startDate?: string
    endDate?: string
    customerId?: string
    emailAddress?: string
    resultsPerPage?: number
    page?: number
  } = {}): Promise<KonnektiveCustomer[]> {
    const response = await this.makeRequest<{ data: KonnektiveCustomer[] }>(
      "/customer/query/",
      {
        startDate: params.startDate,
        endDate: params.endDate,
        customerId: params.customerId,
        emailAddress: params.emailAddress,
        resultsPerPage: params.resultsPerPage || 100,
        page: params.page || 1,
      }
    )

    if (response.result === "ERROR") {
      throw new Error(`Konnektive API error: ${response.message}`)
    }

    return Array.isArray(response.message) ? response.message : 
           (response.message as any)?.data || []
  }

  /**
   * Query products from Konnektive
   */
  async queryProducts(params: {
    campaignId?: string
    productId?: string
    resultsPerPage?: number
    page?: number
  } = {}): Promise<KonnektiveProduct[]> {
    const response = await this.makeRequest<{ data: KonnektiveProduct[] }>(
      "/product/query/",
      {
        campaignId: params.campaignId,
        productId: params.productId,
        resultsPerPage: params.resultsPerPage || 100,
        page: params.page || 1,
      }
    )

    if (response.result === "ERROR") {
      throw new Error(`Konnektive API error: ${response.message}`)
    }

    const products = Array.isArray(response.message) ? response.message :
                    (response.message as any)?.data || []

    // Enrich products with variant information
    for (const product of products) {
      try {
        product.variants = await this.queryProductVariants(product.productId)
        product.options = this.extractProductOptions(product.variants || [])
      } catch (error) {
        console.warn(`Failed to fetch variants for product ${product.productId}:`, error)
        // Fallback: create a default variant from the product data
        product.variants = [{
          variantDetailId: `${product.productId}-default`,
          variantName: product.productName,
          variantSku: product.productSku,
          variantPrice: product.productPrice,
          stockQuantity: product.stockQuantity,
          weight: product.weight,
          isDefault: true,
        }]
        product.options = []
      }
    }

    return products
  }

  /**
   * Query product variants from Konnektive
   * Note: This may need to be implemented based on actual Konnektive API endpoints
   */
  async queryProductVariants(productId: string): Promise<KonnektiveProductVariant[]> {
    // This is a placeholder - actual implementation depends on Konnektive's variant API
    // For now, we'll return a default variant based on the product
    try {
      const response = await this.makeRequest<{ data: any[] }>(
        "/product/variant/query/",
        { productId }
      )

      if (response.result === "ERROR") {
        throw new Error(`Konnektive API error: ${response.message}`)
      }

      const variants = Array.isArray(response.message) ? response.message :
                      (response.message as any)?.data || []

      return variants.map(variant => ({
        variantDetailId: variant.variantDetailId || `${productId}-${variant.id}`,
        variantName: variant.variantName || variant.name,
        variantSku: variant.variantSku || variant.sku,
        variantPrice: variant.variantPrice || variant.price,
        stockQuantity: variant.stockQuantity || variant.inventory,
        weight: variant.weight,
        dimensions: variant.dimensions,
        optionValues: variant.optionValues || {},
        isDefault: variant.isDefault || false,
      }))
    } catch (error) {
      // If variant API doesn't exist, return empty array
      // The calling function will create a default variant
      return []
    }
  }

  /**
   * Extract product options from variants
   */
  private extractProductOptions(variants: KonnektiveProductVariant[]): KonnektiveProductOption[] {
    const optionsMap = new Map<string, Set<string>>()

    // Extract all option names and values from variants
    for (const variant of variants) {
      if (variant.optionValues) {
        for (const [optionName, optionValue] of Object.entries(variant.optionValues)) {
          if (!optionsMap.has(optionName)) {
            optionsMap.set(optionName, new Set())
          }
          optionsMap.get(optionName)!.add(optionValue)
        }
      }
    }

    // Convert to options array
    return Array.from(optionsMap.entries()).map(([optionName, valuesSet]) => ({
      optionName,
      optionValues: Array.from(valuesSet).sort(),
    }))
  }

  /**
   * Query orders from Konnektive
   */
  async queryOrders(params: {
    startDate?: string
    endDate?: string
    orderId?: string
    customerId?: string
    campaignId?: string
    orderStatus?: string
    resultsPerPage?: number
    page?: number
  } = {}): Promise<KonnektiveOrder[]> {
    const response = await this.makeRequest<{ data: KonnektiveOrder[] }>(
      "/order/query/",
      {
        startDate: params.startDate,
        endDate: params.endDate,
        orderId: params.orderId,
        customerId: params.customerId,
        campaignId: params.campaignId,
        orderStatus: params.orderStatus,
        resultsPerPage: params.resultsPerPage || 100,
        page: params.page || 1,
      }
    )

    if (response.result === "ERROR") {
      throw new Error(`Konnektive API error: ${response.message}`)
    }

    return Array.isArray(response.message) ? response.message : 
           (response.message as any)?.data || []
  }

  /**
   * Query transactions from Konnektive
   */
  async queryTransactions(params: {
    startDate?: string
    endDate?: string
    transactionId?: string
    orderId?: string
    customerId?: string
    resultsPerPage?: number
    page?: number
  } = {}): Promise<KonnektiveTransaction[]> {
    const response = await this.makeRequest<{ data: KonnektiveTransaction[] }>(
      "/transaction/query/",
      {
        startDate: params.startDate,
        endDate: params.endDate,
        transactionId: params.transactionId,
        orderId: params.orderId,
        customerId: params.customerId,
        resultsPerPage: params.resultsPerPage || 100,
        page: params.page || 1,
      }
    )

    if (response.result === "ERROR") {
      throw new Error(`Konnektive API error: ${response.message}`)
    }

    return Array.isArray(response.message) ? response.message : 
           (response.message as any)?.data || []
  }

  /**
   * Import/Create a lead in Konnektive
   */
  async importLead(leadData: Partial<KonnektiveCustomer> & {
    campaignId: string
    products?: Array<{
      productId: string
      quantity?: number
      price?: number
      shipPrice?: number
    }>
  }): Promise<{ orderId: string; customerId: string }> {
    const response = await this.makeRequest<{
      orderId: string
      customerId: string
    }>("/leads/import/", leadData)

    if (response.result === "ERROR") {
      throw new Error(`Konnektive API error: ${response.message}`)
    }

    return response.message as { orderId: string; customerId: string }
  }

  /**
   * Import/Create an order in Konnektive
   */
  async importOrder(orderData: Partial<KonnektiveOrder> & {
    campaignId: string
    paySource: string
    products: Array<{
      productId: string
      quantity?: number
      price?: number
      shipPrice?: number
    }>
  }): Promise<{ orderId: string; customerId: string }> {
    // Transform products array to Konnektive format
    const productParams: Record<string, any> = {}
    orderData.products.forEach((product, index) => {
      const i = index + 1
      productParams[`product${i}_id`] = product.productId
      if (product.quantity) productParams[`product${i}_qty`] = product.quantity
      if (product.price) productParams[`product${i}_price`] = product.price
      if (product.shipPrice) productParams[`product${i}_shipPrice`] = product.shipPrice
    })

    const { products, ...orderParams } = orderData
    const requestData = { ...orderParams, ...productParams }

    const response = await this.makeRequest<{
      orderId: string
      customerId: string
    }>("/order/import/", requestData)

    if (response.result === "ERROR") {
      throw new Error(`Konnektive API error: ${response.message}`)
    }

    return response.message as { orderId: string; customerId: string }
  }
}
