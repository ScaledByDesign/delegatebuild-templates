import { KonnektiveApiClient } from "./konnektiveClient"
import { KonnektiveMedusaAdminClient } from "./medusaAdminClient"
import { loadConfig } from "./config"
import {
  buildCustomerUpsertPayload,
  buildProductUpsertPayload,
  buildVariantUpsertPayload,
  buildOrderUpsertPayload,
  generateHandle,
} from "./mappers"
import type {
  KonnektiveCustomer,
  KonnektiveProduct,
  KonnektiveOrder,
} from "./konnektiveClient"

export interface SyncOptions {
  dryRun?: boolean
  syncCustomers?: boolean
  syncProducts?: boolean
  syncOrders?: boolean
  batchSize?: number
  startDate?: string
  endDate?: string
  campaignId?: string
}

export interface SyncResult {
  success: boolean
  customersProcessed: number
  productsProcessed: number
  ordersProcessed: number
  errors: string[]
  warnings: string[]
}

export class KonnektiveSync {
  private konnektiveClient: KonnektiveApiClient
  private medusaClient: KonnektiveMedusaAdminClient
  private config: ReturnType<typeof loadConfig>

  constructor() {
    this.config = loadConfig()
    this.konnektiveClient = new KonnektiveApiClient(this.config)
    this.medusaClient = new KonnektiveMedusaAdminClient(this.config)
  }

  /**
   * Main sync orchestration method
   */
  async sync(options: SyncOptions = {}): Promise<SyncResult> {
    const {
      dryRun = false,
      syncCustomers = true,
      syncProducts = true,
      syncOrders = true,
      batchSize = this.config.batchSize,
      startDate,
      endDate,
      campaignId = this.config.konnektiveCampaignId,
    } = options

    console.log("🚀 Starting Konnektive → Medusa sync...")
    console.log(`📊 Mode: ${dryRun ? "DRY RUN" : "LIVE SYNC"}`)
    console.log(`📅 Date range: ${startDate || "all"} to ${endDate || "all"}`)
    console.log(`🏷️  Campaign ID: ${campaignId || "all"}`)

    const result: SyncResult = {
      success: true,
      customersProcessed: 0,
      productsProcessed: 0,
      ordersProcessed: 0,
      errors: [],
      warnings: [],
    }

    try {
      // Sync products first (needed for orders)
      if (syncProducts) {
        console.log("\n📦 Syncing products...")
        const productResult = await this.syncProducts({
          dryRun,
          batchSize,
          campaignId,
        })
        result.productsProcessed = productResult.processed
        result.errors.push(...productResult.errors)
        result.warnings.push(...productResult.warnings)
      }

      // Sync customers (needed for orders)
      if (syncCustomers) {
        console.log("\n👥 Syncing customers...")
        const customerResult = await this.syncCustomers({
          dryRun,
          batchSize,
          startDate,
          endDate,
        })
        result.customersProcessed = customerResult.processed
        result.errors.push(...customerResult.errors)
        result.warnings.push(...customerResult.warnings)
      }

      // Sync orders last
      if (syncOrders) {
        console.log("\n📋 Syncing orders...")
        const orderResult = await this.syncOrders({
          dryRun,
          batchSize,
          startDate,
          endDate,
          campaignId,
        })
        result.ordersProcessed = orderResult.processed
        result.errors.push(...orderResult.errors)
        result.warnings.push(...orderResult.warnings)
      }

      console.log("\n✅ Sync completed successfully!")
      console.log(`📊 Summary:`)
      console.log(`   - Products: ${result.productsProcessed}`)
      console.log(`   - Customers: ${result.customersProcessed}`)
      console.log(`   - Orders: ${result.ordersProcessed}`)
      console.log(`   - Errors: ${result.errors.length}`)
      console.log(`   - Warnings: ${result.warnings.length}`)

    } catch (error) {
      console.error("❌ Sync failed:", error)
      result.success = false
      result.errors.push(`Sync failed: ${error instanceof Error ? error.message : String(error)}`)
    }

    return result
  }

  /**
   * Sync products from Konnektive to Medusa
   */
  private async syncProducts(options: {
    dryRun: boolean
    batchSize: number
    campaignId?: string
  }): Promise<{ processed: number; errors: string[]; warnings: string[] }> {
    const { dryRun, batchSize, campaignId } = options
    const result = { processed: 0, errors: [], warnings: [] }

    try {
      let page = 1
      let hasMore = true

      while (hasMore) {
        console.log(`📦 Fetching products page ${page}...`)
        
        const products = await this.konnektiveClient.queryProducts({
          campaignId,
          resultsPerPage: batchSize,
          page,
        })

        if (products.length === 0) {
          hasMore = false
          break
        }

        for (const product of products) {
          try {
            await this.syncSingleProduct(product, dryRun)
            result.processed++
            console.log(`✅ Product synced: ${product.productName} (${product.productId})`)
          } catch (error) {
            const errorMsg = `Failed to sync product ${product.productId}: ${error instanceof Error ? error.message : String(error)}`
            console.error(`❌ ${errorMsg}`)
            result.errors.push(errorMsg)
          }
        }

        page++
        hasMore = products.length === batchSize
      }

    } catch (error) {
      const errorMsg = `Failed to fetch products: ${error instanceof Error ? error.message : String(error)}`
      console.error(`❌ ${errorMsg}`)
      result.errors.push(errorMsg)
    }

    return result
  }

  /**
   * Sync customers from Konnektive to Medusa
   */
  private async syncCustomers(options: {
    dryRun: boolean
    batchSize: number
    startDate?: string
    endDate?: string
  }): Promise<{ processed: number; errors: string[]; warnings: string[] }> {
    const { dryRun, batchSize, startDate, endDate } = options
    const result = { processed: 0, errors: [], warnings: [] }

    try {
      let page = 1
      let hasMore = true

      while (hasMore) {
        console.log(`👥 Fetching customers page ${page}...`)
        
        const customers = await this.konnektiveClient.queryCustomers({
          startDate,
          endDate,
          resultsPerPage: batchSize,
          page,
        })

        if (customers.length === 0) {
          hasMore = false
          break
        }

        for (const customer of customers) {
          try {
            await this.syncSingleCustomer(customer, dryRun)
            result.processed++
            console.log(`✅ Customer synced: ${customer.firstName} ${customer.lastName} (${customer.customerId})`)
          } catch (error) {
            const errorMsg = `Failed to sync customer ${customer.customerId}: ${error instanceof Error ? error.message : String(error)}`
            console.error(`❌ ${errorMsg}`)
            result.errors.push(errorMsg)
          }
        }

        page++
        hasMore = customers.length === batchSize
      }

    } catch (error) {
      const errorMsg = `Failed to fetch customers: ${error instanceof Error ? error.message : String(error)}`
      console.error(`❌ ${errorMsg}`)
      result.errors.push(errorMsg)
    }

    return result
  }

  /**
   * Sync orders from Konnektive to Medusa
   */
  private async syncOrders(options: {
    dryRun: boolean
    batchSize: number
    startDate?: string
    endDate?: string
    campaignId?: string
  }): Promise<{ processed: number; errors: string[]; warnings: string[] }> {
    const { dryRun, batchSize, startDate, endDate, campaignId } = options
    const result = { processed: 0, errors: [], warnings: [] }

    try {
      let page = 1
      let hasMore = true

      while (hasMore) {
        console.log(`📋 Fetching orders page ${page}...`)
        
        const orders = await this.konnektiveClient.queryOrders({
          startDate,
          endDate,
          campaignId,
          resultsPerPage: batchSize,
          page,
        })

        if (orders.length === 0) {
          hasMore = false
          break
        }

        for (const order of orders) {
          try {
            await this.syncSingleOrder(order, dryRun)
            result.processed++
            console.log(`✅ Order synced: ${order.orderId} (${order.totalAmount})`)
          } catch (error) {
            const errorMsg = `Failed to sync order ${order.orderId}: ${error instanceof Error ? error.message : String(error)}`
            console.error(`❌ ${errorMsg}`)
            result.errors.push(errorMsg)
          }
        }

        page++
        hasMore = orders.length === batchSize
      }

    } catch (error) {
      const errorMsg = `Failed to fetch orders: ${error instanceof Error ? error.message : String(error)}`
      console.error(`❌ ${errorMsg}`)
      result.errors.push(errorMsg)
    }

    return result
  }

  /**
   * Sync a single product from Konnektive to Medusa with SKU-based linking
   */
  private async syncSingleProduct(konnektiveProduct: KonnektiveProduct, dryRun: boolean): Promise<void> {
    console.log(`🔍 Processing Konnektive product: ${konnektiveProduct.productName} (${konnektiveProduct.productId})`)
    console.log(`   SKU: ${konnektiveProduct.productSku || 'No SKU'}`)

    // Step 1: Find matching Medusa product using enhanced matching
    const matchResult = await this.findMatchingMedusaProduct(konnektiveProduct)

    if (dryRun) {
      console.log(`[DRY RUN] Match result: ${matchResult.matchType} (confidence: ${matchResult.confidence})`)
      if (matchResult.medusaProduct) {
        console.log(`[DRY RUN] Would link to existing product: ${matchResult.medusaProduct.title}`)
        console.log(`[DRY RUN] Would add as variant with options:`, matchResult.suggestedOptions)
      } else {
        console.log(`[DRY RUN] Would create new product: ${konnektiveProduct.productName}`)
      }
      return
    }

    let medusaProduct: any

    if (matchResult.medusaProduct && matchResult.matchType !== 'none') {
      // Link to existing product as variant
      medusaProduct = matchResult.medusaProduct
      console.log(`🔗 Linking to existing product: ${medusaProduct.title} (${matchResult.matchType} match)`)

      // Add Konnektive product as variant to existing product
      await this.addKonnektiveProductAsVariant(medusaProduct, konnektiveProduct, matchResult, dryRun)
    } else {
      // Create new product (fallback)
      console.log(`🆕 Creating new product (no suitable match found)`)

      const productPayload = buildProductUpsertPayload(
        konnektiveProduct,
        this.config.medusaDefaultCollectionFallback,
        this.config.medusaSalesChannelId
      )

      medusaProduct = await this.medusaClient.createProduct(productPayload as unknown as Record<string, unknown>)
      console.log(`✅ Created new product: ${medusaProduct.title}`)

      // Add default variant
      await this.syncProductVariant(medusaProduct, konnektiveProduct, dryRun)
    }

    // Add to sales channel if specified
    if (this.config.medusaSalesChannelId && !dryRun) {
      try {
        await this.medusaClient.addProductToSalesChannel(medusaProduct.id, this.config.medusaSalesChannelId)
      } catch (error) {
        console.warn(`⚠️  Failed to add product to sales channel: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
  }

  /**
   * Sync product variant and inventory
   */
  private async syncProductVariant(medusaProduct: any, konnektiveProduct: KonnektiveProduct, dryRun: boolean): Promise<void> {
    const variantPayload = buildVariantUpsertPayload(
      konnektiveProduct,
      this.config.medusaDefaultRegionId
    )

    if (dryRun) {
      console.log(`[DRY RUN] Would sync variant for product: ${medusaProduct.title}`)
      return
    }

    // Check if variant exists (assuming one variant per product for simplicity)
    let variant: any
    if (medusaProduct.variants && medusaProduct.variants.length > 0) {
      // Update existing variant
      await this.medusaClient.updateVariant(
        medusaProduct.id,
        medusaProduct.variants[0].id,
        variantPayload as unknown as Record<string, unknown>
      )
    } else {
      // Create new variant
      await this.medusaClient.createVariant(medusaProduct.id, variantPayload as unknown as Record<string, unknown>)
    }

    // Update inventory if location is configured
    if (this.config.medusaInventoryLocationId && konnektiveProduct.stockQuantity !== undefined) {
      try {
        const inventoryItems = await this.medusaClient.listInventoryItems({ variant_id: variant.id })
        if (inventoryItems.length > 0) {
          await this.medusaClient.updateInventoryLevel(
            inventoryItems[0].id,
            this.config.medusaInventoryLocationId,
            konnektiveProduct.stockQuantity
          )
        }
      } catch (error) {
        console.warn(`⚠️  Failed to update inventory: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
  }

  /**
   * Sync a single customer from Konnektive to Medusa
   */
  private async syncSingleCustomer(konnektiveCustomer: KonnektiveCustomer, dryRun: boolean): Promise<void> {
    // Check if customer already exists in Medusa
    const existingCustomers = await this.medusaClient.listCustomersByKonnektiveId(konnektiveCustomer.customerId)

    const customerPayload = buildCustomerUpsertPayload(
      konnektiveCustomer,
      this.config.medusaDefaultRegionId
    )

    if (dryRun) {
      console.log(`[DRY RUN] Would ${existingCustomers.length > 0 ? 'update' : 'create'} customer:`, customerPayload.email)
      return
    }

    if (existingCustomers.length > 0) {
      // Update existing customer
      await this.medusaClient.updateCustomer(existingCustomers[0].id, customerPayload as unknown as Record<string, unknown>)
      console.log(`📝 Updated customer: ${customerPayload.email}`)
    } else {
      // Create new customer
      await this.medusaClient.createCustomer(customerPayload as unknown as Record<string, unknown>)
      console.log(`🆕 Created customer: ${customerPayload.email}`)
    }
  }

  /**
   * Sync a single order from Konnektive to Medusa
   */
  private async syncSingleOrder(konnektiveOrder: KonnektiveOrder, dryRun: boolean): Promise<void> {
    // Check if order already exists in Medusa
    const existingOrders = await this.medusaClient.listOrdersByKonnektiveId(konnektiveOrder.orderId)

    if (existingOrders.length > 0) {
      console.log(`⏭️  Order ${konnektiveOrder.orderId} already exists, skipping...`)
      return
    }

    // Find or create customer
    const customerPayload = await this.resolveCustomerForOrder(konnektiveOrder, dryRun)

    const orderPayload = buildOrderUpsertPayload(
      konnektiveOrder,
      this.config.medusaDefaultRegionId,
      customerPayload?.id,
      this.config.medusaSalesChannelId
    )

    if (dryRun) {
      console.log(`[DRY RUN] Would create order:`, konnektiveOrder.orderId)
      return
    }

    // Create new order
    await this.medusaClient.createOrder(orderPayload as unknown as Record<string, unknown>)
    console.log(`🆕 Created order: ${konnektiveOrder.orderId}`)
  }

  /**
   * Resolve customer for order (find existing or create new)
   */
  private async resolveCustomerForOrder(konnektiveOrder: KonnektiveOrder, dryRun: boolean): Promise<any | null> {
    // Try to find existing customer by Konnektive ID
    const existingCustomers = await this.medusaClient.listCustomersByKonnektiveId(konnektiveOrder.customerId)

    if (existingCustomers.length > 0) {
      return existingCustomers[0]
    }

    // Customer doesn't exist, we need to fetch it from Konnektive and create it
    try {
      const konnektiveCustomers = await this.konnektiveClient.queryCustomers({
        customerId: konnektiveOrder.customerId,
      })

      if (konnektiveCustomers.length > 0) {
        await this.syncSingleCustomer(konnektiveCustomers[0], dryRun)

        if (!dryRun) {
          // Fetch the newly created customer
          const newCustomers = await this.medusaClient.listCustomersByKonnektiveId(konnektiveOrder.customerId)
          return newCustomers.length > 0 ? newCustomers[0] : null
        }
      }
    } catch (error) {
      console.warn(`⚠️  Failed to resolve customer ${konnektiveOrder.customerId}: ${error instanceof Error ? error.message : String(error)}`)
    }

    return null
  }

  /**
   * Enhanced product matching using SKU-based linking
   */
  private async findMatchingMedusaProduct(konnektiveProduct: KonnektiveProduct): Promise<{
    matchType: 'exact' | 'pattern' | 'base' | 'none'
    medusaProduct?: any
    confidence: number
    suggestedOptions?: Record<string, string>
  }> {
    const sku = konnektiveProduct.productSku

    if (!sku) {
      return { matchType: 'none', confidence: 0 }
    }

    // Get all products for matching
    const allProducts = await this.medusaClient.listProducts(500, 0)

    // Step 1: Exact SKU match
    for (const product of allProducts) {
      for (const variant of product.variants || []) {
        if (variant.sku === sku) {
          console.log(`🎯 Exact SKU match found: ${product.title} (variant: ${variant.title})`)
          return {
            matchType: 'exact',
            medusaProduct: product,
            confidence: 1.0,
            suggestedOptions: this.extractOptionsFromSku(sku) || {}
          }
        }
      }
    }

    // Step 2: Pattern match (same product family)
    const skuPattern = this.extractSkuPattern(sku)
    if (skuPattern) {
      for (const product of allProducts) {
        for (const variant of product.variants || []) {
          if (variant.sku && this.extractSkuPattern(variant.sku) === skuPattern) {
            console.log(`🔍 Pattern match found: ${product.title} (pattern: ${skuPattern})`)
            return {
              matchType: 'pattern',
              medusaProduct: product,
              confidence: 0.8,
              suggestedOptions: this.extractOptionsFromSku(sku) || {}
            }
          }
        }
      }
    }

    // Step 3: Base product match (similar name or handle)
    const normalizedName = this.normalizeProductName(konnektiveProduct.productName)
    for (const product of allProducts) {
      const productNameNormalized = this.normalizeProductName(product.title)
      if (this.calculateSimilarity(normalizedName, productNameNormalized) > 0.7) {
        console.log(`📝 Name similarity match found: ${product.title}`)
        return {
          matchType: 'base',
          medusaProduct: product,
          confidence: 0.6,
          suggestedOptions: this.extractOptionsFromProductName(konnektiveProduct.productName) || {}
        }
      }
    }

    return { matchType: 'none', confidence: 0 }
  }

  /**
   * Extract SKU pattern (e.g., "HOLSTER-001-BLK-L" -> "HOLSTER-001")
   */
  private extractSkuPattern(sku: string): string | null {
    // Common patterns: PRODUCT-ID-COLOR-SIZE, PRODUCT-ID-VARIANT, etc.
    const patterns = [
      /^([A-Z]+-\d+)-/,  // HOLSTER-001-BLK-L -> HOLSTER-001
      /^([A-Z]+\d+)-/,   // HOLSTER1-BLK-L -> HOLSTER1
      /^([A-Z-]+)-\w+-\w+$/, // TACTICAL-HOLSTER-BLK-L -> TACTICAL-HOLSTER
    ]

    for (const pattern of patterns) {
      const match = sku.match(pattern)
      if (match) {
        return match[1]
      }
    }

    return null
  }

  /**
   * Extract options from SKU (e.g., "HOLSTER-001-BLK-L" -> {Color: "Black", Size: "Large"})
   */
  private extractOptionsFromSku(sku: string): Record<string, string> | null {
    const parts = sku.split('-')
    if (parts.length < 3) return null

    const options: Record<string, string> = {}

    // Common patterns
    if (parts.length >= 3) {
      const colorCode = parts[parts.length - 2]
      const sizeCode = parts[parts.length - 1]

      // Color mapping
      const colorMap: Record<string, string> = {
        'BLK': 'Black', 'BLACK': 'Black',
        'BRN': 'Brown', 'BROWN': 'Brown',
        'TAN': 'Tan', 'COYOTE': 'Coyote',
        'RED': 'Red', 'BLU': 'Blue', 'BLUE': 'Blue',
        'GRN': 'Green', 'GREEN': 'Green',
        'WHT': 'White', 'WHITE': 'White',
      }

      // Size mapping
      const sizeMap: Record<string, string> = {
        'XS': 'Extra Small', 'S': 'Small', 'M': 'Medium',
        'L': 'Large', 'XL': 'Extra Large', 'XXL': '2X Large',
        'SM': 'Small', 'MD': 'Medium', 'LG': 'Large',
      }

      if (colorMap[colorCode.toUpperCase()]) {
        options['Color'] = colorMap[colorCode.toUpperCase()]
      }

      if (sizeMap[sizeCode.toUpperCase()]) {
        options['Size'] = sizeMap[sizeCode.toUpperCase()]
      }
    }

    return Object.keys(options).length > 0 ? options : null
  }

  /**
   * Extract options from product name
   */
  private extractOptionsFromProductName(productName: string): Record<string, string> | null {
    const options: Record<string, string> = {}
    const name = productName.toLowerCase()

    // Color extraction
    const colors = ['black', 'brown', 'tan', 'coyote', 'red', 'blue', 'green', 'white']
    for (const color of colors) {
      if (name.includes(color)) {
        options['Color'] = color.charAt(0).toUpperCase() + color.slice(1)
        break
      }
    }

    // Size extraction
    const sizes = ['extra small', 'small', 'medium', 'large', 'extra large', 'xs', 's', 'm', 'l', 'xl', 'xxl']
    for (const size of sizes) {
      if (name.includes(size)) {
        options['Size'] = size.charAt(0).toUpperCase() + size.slice(1)
        break
      }
    }

    return Object.keys(options).length > 0 ? options : null
  }

  /**
   * Normalize product name for comparison
   */
  private normalizeProductName(name: string): string {
    return name.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  }

  /**
   * Calculate string similarity (simple Levenshtein-based)
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2
    const shorter = str1.length > str2.length ? str2 : str1

    if (longer.length === 0) return 1.0

    const distance = this.levenshteinDistance(longer, shorter)
    return (longer.length - distance) / longer.length
  }

  /**
   * Calculate Levenshtein distance
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null))

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        )
      }
    }

    return matrix[str2.length][str1.length]
  }

  /**
   * Add Konnektive product as variant to existing Medusa product
   */
  private async addKonnektiveProductAsVariant(
    medusaProduct: any,
    konnektiveProduct: KonnektiveProduct,
    matchResult: any,
    dryRun: boolean
  ): Promise<void> {
    console.log(`🔗 Adding Konnektive product as variant to: ${medusaProduct.title}`)

    // Check if variant already exists
    const existingVariant = medusaProduct.variants?.find((v: any) =>
      v.metadata?.konnektive_product_id === konnektiveProduct.productId ||
      v.sku === konnektiveProduct.productSku
    )

    if (existingVariant) {
      console.log(`⚠️  Variant already exists, updating: ${existingVariant.title}`)
      if (!dryRun) {
        await this.updateExistingVariant(medusaProduct, existingVariant, konnektiveProduct)
      }
      return
    }

    // Ensure product has proper options structure
    await this.ensureProductOptions(medusaProduct, matchResult.suggestedOptions || {}, dryRun)

    // Create variant payload
    const variantPayload = this.buildKonnektiveVariantPayload(
      konnektiveProduct,
      medusaProduct,
      matchResult.suggestedOptions || {}
    )

    if (dryRun) {
      console.log(`[DRY RUN] Would create variant:`, variantPayload)
      return
    }

    // Handle SKU conflicts
    let finalSku = variantPayload.sku
    if (finalSku) {
      const skuConflict = await this.checkVariantSKUConflict(finalSku, medusaProduct.id)
      if (skuConflict) {
        console.log(`⚠️  SKU conflict detected: "${finalSku}" already exists`)
        finalSku = `${finalSku}-konnektive`
        variantPayload.sku = finalSku
        console.log(`   Modified SKU to: ${finalSku}`)
      }
    }

    try {
      await this.medusaClient.createVariant(medusaProduct.id, variantPayload as unknown as Record<string, unknown>)
      console.log(`✅ Created variant for product: ${medusaProduct.title}`)

      // Update inventory if needed
      if (konnektiveProduct.stockQuantity !== undefined) {
        await this.updateVariantInventory({ id: 'temp-variant' }, konnektiveProduct.stockQuantity)
      }
    } catch (error) {
      console.error(`❌ Failed to create variant: ${error instanceof Error ? error.message : String(error)}`)
      throw error
    }
  }

  /**
   * Ensure product has proper options structure for variants
   */
  private async ensureProductOptions(
    medusaProduct: any,
    suggestedOptions: Record<string, string>,
    dryRun: boolean
  ): Promise<void> {
    const existingOptions = medusaProduct.options || []
    const existingOptionTitles = existingOptions.map((opt: any) => opt.title)

    const requiredOptions = Object.keys(suggestedOptions)
    const missingOptions = requiredOptions.filter(opt => !existingOptionTitles.includes(opt))

    if (missingOptions.length === 0) {
      return // All required options already exist
    }

    console.log(`🔧 Adding missing options to product: ${missingOptions.join(', ')}`)

    if (dryRun) {
      console.log(`[DRY RUN] Would add options:`, missingOptions)
      return
    }

    // Add missing options to product
    for (const optionTitle of missingOptions) {
      try {
        await this.medusaClient.addProductOption(medusaProduct.id, {
          title: optionTitle,
          values: [{ value: suggestedOptions[optionTitle] }]
        })
        console.log(`✅ Added option: ${optionTitle}`)
      } catch (error) {
        console.warn(`⚠️  Failed to add option ${optionTitle}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }

    // Refresh product data to get updated options
    const updatedProduct = await this.medusaClient.getProduct(medusaProduct.id)
    Object.assign(medusaProduct, updatedProduct)
  }

  /**
   * Build variant payload for Konnektive product
   */
  private buildKonnektiveVariantPayload(
    konnektiveProduct: KonnektiveProduct,
    medusaProduct: any,
    suggestedOptions: Record<string, string>
  ): any {
    const metadata = {
      konnektive_product_id: konnektiveProduct.productId,
      konnektive_product_name: konnektiveProduct.productName,
      konnektive_category: konnektiveProduct.productCategory,
      konnektive_type: konnektiveProduct.productType,
      konnektive_custom1: konnektiveProduct.custom1,
      konnektive_custom2: konnektiveProduct.custom2,
      konnektive_custom3: konnektiveProduct.custom3,
      konnektive_synced_at: new Date().toISOString(),
    }

    // Build option mapping for variant
    const options: Record<string, string> = {}

    // Use suggested options from matching
    Object.entries(suggestedOptions).forEach(([optionName, optionValue]) => {
      options[optionName] = optionValue
    })

    // If no options suggested, create default
    if (Object.keys(options).length === 0) {
      options['Title'] = 'Default Title'
    }

    const payload = {
      title: konnektiveProduct.productName,
      sku: konnektiveProduct.productSku || `KON-${konnektiveProduct.productId}`,
      manage_inventory: true,
      allow_backorder: konnektiveProduct.allowBackorders || false,
      weight: konnektiveProduct.weight,
      length: konnektiveProduct.dimensions ? parseInt(konnektiveProduct.dimensions.split('x')[0]) : undefined,
      height: konnektiveProduct.dimensions ? parseInt(konnektiveProduct.dimensions.split('x')[1]) : undefined,
      width: konnektiveProduct.dimensions ? parseInt(konnektiveProduct.dimensions.split('x')[2]) : undefined,
      metadata,
      options,
    }

    // Add pricing if available (remove prices property as it's not supported in this payload type)
    // Note: Pricing should be handled separately via price updates after variant creation

    return payload
  }

  /**
   * Check for SKU conflicts
   */
  private async checkVariantSKUConflict(sku: string, currentProductId: string): Promise<boolean> {
    try {
      const allProducts = await this.medusaClient.listProducts(500, 0)

      for (const product of allProducts) {
        if (product.id === currentProductId) continue // Skip current product

        for (const variant of product.variants || []) {
          if (variant.sku === sku) {
            return true // Conflict found
          }
        }
      }

      return false // No conflict
    } catch (error) {
      console.warn(`⚠️  Error checking SKU conflict: ${error instanceof Error ? error.message : String(error)}`)
      return false
    }
  }

  /**
   * Update existing variant with Konnektive data
   */
  private async updateExistingVariant(medusaProduct: any, existingVariant: any, konnektiveProduct: KonnektiveProduct): Promise<void> {
    const updatePayload = {
      title: konnektiveProduct.productName,
      weight: konnektiveProduct.weight,
      metadata: {
        ...existingVariant.metadata,
        konnektive_product_id: konnektiveProduct.productId,
        konnektive_synced_at: new Date().toISOString(),
      }
    }

    try {
      await this.medusaClient.updateVariant(medusaProduct.id, existingVariant.id, updatePayload as unknown as Record<string, unknown>)
      console.log(`✅ Updated existing variant: ${existingVariant.title}`)

      // Update inventory if needed
      if (konnektiveProduct.stockQuantity !== undefined) {
        await this.updateVariantInventory(existingVariant, konnektiveProduct.stockQuantity)
      }
    } catch (error) {
      console.error(`❌ Failed to update variant: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Update variant inventory levels
   */
  private async updateVariantInventory(variant: any, stockQuantity: number): Promise<void> {
    try {
      // This would need to be implemented based on your inventory management setup
      console.log(`📦 Would update inventory for variant ${variant.id}: ${stockQuantity} units`)
      // await this.medusaClient.updateInventoryLevel(variant.id, stockQuantity)
    } catch (error) {
      console.warn(`⚠️  Failed to update inventory: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
}
