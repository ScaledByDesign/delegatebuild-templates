// @ts-nocheck
import { resolve } from "node:path"
import { loadConfig, ShopifyMedusaConfig } from "./config.ts"
import { ShopifyWebScraper, type ScrapedProduct } from "./webScraper"
import { MedusaAdminClient, type MedusaCollection, type MedusaInventoryItem, type MedusaProduct } from "./medusaAdminClient"
import { DEFAULT_INVENTORY_QUANTITY, buildProductUpsertPayloadFromScrape, buildVariantUpsertPayloadFromScrape } from "./mappers"

interface WebSyncArgs {
  mode: "full" | "collection"
  collectionHandle?: string
  dryRun: boolean
  limit?: number
}

interface WebSyncSummary {
  processed: number
  created: number
  updated: number
  skipped: number
  variantCreated: number
  variantUpdated: number
  imageUploaded: number
}

let cachedInventoryLocationIds: string[] | null = null
const inventoryItemBySkuCache = new Map<string, MedusaInventoryItem | null>()

function normalizeSku(sku?: string | null): string | null {
  if (!sku) return null
  const normalized = sku.trim().toLowerCase()
  return normalized.length > 0 ? normalized : null
}

export async function runWebSync(rawArgs: string[] = process.argv.slice(2)) {
  const args = parseWebSyncArgs(rawArgs)
  const config = loadConfig()



  const scraper = new ShopifyWebScraper(config)
  const medusaClient = new MedusaAdminClient(config)

  const summary: WebSyncSummary = {
    processed: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    variantCreated: 0,
    variantUpdated: 0,
    imageUploaded: 0,
  }

  console.log(`Starting Shopify web scraping sync (mode=${args.mode}, dryRun=${args.dryRun})`)

  const collectionCache = await bootstrapCollections(medusaClient)

  let products: ScrapedProduct[] = []

  if (args.mode === "collection" && args.collectionHandle) {
    console.log(`Scraping collection: ${args.collectionHandle}`)
    const collection = await scraper.scrapeCollection(args.collectionHandle)
    products = collection.products

    // Ensure collection exists in Medusa
    await ensureCollection({
      medusaClient,
      cache: collectionCache,
      handle: collection.handle,
      title: collection.title,
      dryRun: args.dryRun,
    })
  } else {
    console.log("Scraping all products...")
    products = await scraper.scrapeAllProducts()
    await enrichScrapedProductsWithCollections({
      products,
      scraper,
    })
  }

  console.log(`Found ${products.length} products to sync`)

  // Support filtering by handles via INCLUDE_HANDLES env var
  const includeHandles = (process.env.INCLUDE_HANDLES || '')
    .split(',')
    .map((h) => h.trim())
    .filter(Boolean)

  for (const product of products) {
    if (args.limit && summary.processed >= args.limit) {
      break
    }

    // Skip products not in the include list (if specified)
    if (includeHandles.length && !includeHandles.includes(product.handle)) {
      console.log(`[skip] ${product.handle} (not in INCLUDE_HANDLES)`)
      continue
    }

    summary.processed += 1

    try {
      await syncScrapedProduct({
        scrapedProduct: product,
        medusaClient,
        collectionCache,
        dryRun: args.dryRun,
        summary,
        collectionHandle: args.collectionHandle,
        config,
      })
    } catch (error) {
      console.error(`Failed to sync product ${product.handle}:`, error)
      summary.skipped += 1
    }
  }

  console.log("Web sync complete", summary)
}

async function enrichScrapedProductsWithCollections(params: {
  products: ScrapedProduct[]
  scraper: ShopifyWebScraper
}): Promise<void> {
  const { products, scraper } = params

  if (products.length === 0) {
    return
  }

  const productMap = new Map<string, ScrapedProduct>()
  for (const product of products) {
    productMap.set(product.id, product)
  }

  try {
    const collections = await scraper.scrapeCollections()
    console.log(`Enriching ${products.length} products with ${collections.length} collection(s)`)

    for (const collection of collections) {
      try {
        const scrapedCollection = await scraper.scrapeCollection(collection.handle)
        const collectionMeta = {
          id: scrapedCollection.id,
          title: scrapedCollection.title,
          handle: scrapedCollection.handle,
        }

        for (const scrapedProduct of scrapedCollection.products) {
          const target = productMap.get(scrapedProduct.id)
          if (!target) continue

          const alreadyLinked = target.collections.some(
            existing => existing.handle.toLowerCase() === collectionMeta.handle.toLowerCase()
          )

          if (!alreadyLinked) {
            target.collections.push(collectionMeta)
          }
        }
      } catch (error) {
        console.warn(`Failed to enrich products for collection ${collection.handle}:`, error)
      }
    }
  } catch (error) {
    console.warn("Unable to load Shopify collections for enrichment:", error)
  }
}

async function assignProductCollection(params: {
  scrapedProduct: ScrapedProduct
  createPayload: Record<string, unknown>
  updatePayload: Record<string, unknown>
  collectionHandle?: string
  medusaClient: MedusaAdminClient
  collectionCache: Map<string, MedusaCollection>
  dryRun: boolean
}): Promise<void> {
  const {
    scrapedProduct,
    createPayload,
    updatePayload,
    collectionHandle,
    medusaClient,
    collectionCache,
    dryRun,
  } = params

  const candidates: Array<{ handle: string; title?: string }> = []
  const seenHandles = new Set<string>()

  const registerCandidate = (handle?: string, title?: string) => {
    if (!handle) return
    const normalized = handle.toLowerCase()
    if (seenHandles.has(normalized)) return
    seenHandles.add(normalized)
    candidates.push({ handle, title })
  }

  if (collectionHandle) {
    const matchingScraped = scrapedProduct.collections.find(
      collection => collection.handle.toLowerCase() === collectionHandle.toLowerCase()
    )
    const cached = collectionCache.get(collectionHandle.toLowerCase())
    registerCandidate(collectionHandle, matchingScraped?.title ?? cached?.title ?? collectionHandle)
  }

  for (const collection of scrapedProduct.collections) {
    registerCandidate(collection.handle, collection.title)
  }

  for (const candidate of candidates) {
    const key = candidate.handle.toLowerCase()
    let medusaCollection = collectionCache.get(key)

    if (!medusaCollection) {
      const collectionId = await ensureCollection({
        medusaClient,
        cache: collectionCache,
        handle: candidate.handle,
        title: candidate.title ?? candidate.handle,
        dryRun,
      })

      if (!collectionId) {
        continue
      }

      medusaCollection = collectionCache.get(key)
    }

    if (!medusaCollection) {
      continue
    }

    createPayload.collection_id = medusaCollection.id
    updatePayload.collection_id = medusaCollection.id
    return
  }

  if (candidates.length > 0) {
    const handles = candidates.map(candidate => candidate.handle).join(", ")
    console.warn(`⚠️  Unable to resolve Medusa collection for handles: ${handles}`)
  }
}

async function resolveInventoryLocationIds(params: {
  medusaClient: MedusaAdminClient
  config: ShopifyMedusaConfig
}): Promise<string[]> {
  if (cachedInventoryLocationIds && cachedInventoryLocationIds.length > 0) {
    return cachedInventoryLocationIds
  }

  const { medusaClient, config } = params

  const explicitIds = config.medusaInventoryLocationId
    ?.split(",")
    .map(id => id.trim())
    .filter(Boolean)

  if (explicitIds && explicitIds.length > 0) {
    cachedInventoryLocationIds = explicitIds
    return cachedInventoryLocationIds
  }

  try {
    const locations = await medusaClient.listStockLocations()
    cachedInventoryLocationIds = locations.map(location => location.id)
  } catch (error) {
    console.warn("Failed to load Medusa stock locations for inventory assignment:", error)
    cachedInventoryLocationIds = []
  }

  return cachedInventoryLocationIds
}

async function findInventoryItemBySku(params: {
  medusaClient: MedusaAdminClient
  sku?: string | null
}): Promise<MedusaInventoryItem | null> {
  const { medusaClient, sku } = params
  const normalized = normalizeSku(sku)
  if (!normalized) return null

  if (inventoryItemBySkuCache.has(normalized)) {
    return inventoryItemBySkuCache.get(normalized) ?? null
  }

  const pageSize = 50
  let offset = 0

  while (true) {
    const inventoryItems = await medusaClient.listInventoryItems({ limit: pageSize, offset })
    if (!inventoryItems.length) {
      break
    }

    for (const item of inventoryItems) {
      const itemSku = item.sku?.trim().toLowerCase()
      if (itemSku && itemSku === normalized) {
        inventoryItemBySkuCache.set(normalized, item)
        return item
      }
    }

    offset += inventoryItems.length
    if (inventoryItems.length < pageSize) {
      break
    }
  }

  inventoryItemBySkuCache.set(normalized, null)
  return null
}

async function ensureProductInventoryLevels(params: {
  medusaProduct: MedusaProduct
  medusaClient: MedusaAdminClient
  config: ShopifyMedusaConfig
  quantity: number
}): Promise<void> {
  const { medusaProduct, medusaClient, config, quantity } = params

  const locationIds = await resolveInventoryLocationIds({ medusaClient, config })

  if (!locationIds.length) {
    console.warn(
      `⚠️  Skipping inventory assignment for product ${medusaProduct.id} – no stock locations configured`
    )
    return
  }

  for (const variant of medusaProduct.variants) {
    try {
      let inventoryItem: MedusaInventoryItem | null = null

      if (variant.sku) {
        inventoryItem = await findInventoryItemBySku({ medusaClient, sku: variant.sku })
      }

      if (!inventoryItem) {
        const created = await medusaClient.createInventoryItem({
          sku: variant.sku ?? undefined,
          title: variant.title || medusaProduct.title,
          description: `Inventory item for variant ${variant.id}`,
          requires_shipping: true,
        })

        inventoryItem = created
        const normalizedSku = normalizeSku(variant.sku)
        if (normalizedSku) {
          inventoryItemBySkuCache.set(normalizedSku, inventoryItem)
        }
      }

      if (!inventoryItem) {
        console.warn(`⚠️  Skipping inventory assignment for variant ${variant.id} (no inventory item found or created)`)
        continue
      }

      if (variant.sku) {
        try {
          await medusaClient.updateVariant(medusaProduct.id, variant.id, {
            inventory_items: [
              {
                inventory_item_id: inventoryItem.id,
                required_quantity: 1,
              },
            ],
          })
        } catch (error) {
          console.warn(
            `Unable to link inventory item ${inventoryItem.id} to variant ${variant.id}:`,
            error instanceof Error ? error.message : error
          )
        }
      }

      for (const locationId of locationIds) {
        await medusaClient.updateInventoryLevel(inventoryItem.id, locationId, quantity)
      }
    } catch (error) {
      console.error(
        `Failed to ensure inventory for variant ${variant.id} (product ${medusaProduct.id}):`,
        error instanceof Error ? error.message : error
      )
    }
  }
}

async function syncScrapedProduct(params: {
  scrapedProduct: ScrapedProduct
  medusaClient: MedusaAdminClient
  collectionCache: Map<string, MedusaCollection>
  dryRun: boolean
  summary: WebSyncSummary
  collectionHandle?: string
  config: ShopifyMedusaConfig
}) {
  const { scrapedProduct, medusaClient, collectionCache, dryRun, summary, collectionHandle, config } = params

  // Find existing product by Shopify ID
  const existingProducts = await medusaClient.listProductsByShopifyId(scrapedProduct.id)
  let medusaProduct = existingProducts[0]

  console.log(`[DEBUG] Looking for existing product with Shopify ID: ${scrapedProduct.id}`)
  console.log(`[DEBUG] Found ${existingProducts.length} existing products`)

  // If no product found by Shopify ID, try to find by SKU (most reliable)
  if (!medusaProduct && scrapedProduct.variants.length > 0) {
    const firstVariantSku = scrapedProduct.variants[0].sku
    if (firstVariantSku) {
      const allProducts = await medusaClient.listProducts(300, 0)
      const skuMatch = allProducts.find(p =>
        p.variants.some(v => v.sku === firstVariantSku || v.sku === `${firstVariantSku}-shopify`)
      )

      if (skuMatch) {
        console.log(`[DEBUG] Found existing product with matching SKU: "${skuMatch.title}" (${skuMatch.id})`)
        console.log(`[DEBUG] Matching SKU: ${firstVariantSku}`)
        console.log(`[DEBUG] Shopify ID: ${skuMatch.metadata?.shopify_product_id}`)
        medusaProduct = skuMatch
      }
    }
  }

  // If still no product found, try to find by handle (fallback)
  if (!medusaProduct) {
    const allProducts = await medusaClient.listProducts(300, 0)
    const handleMatch = allProducts.find(p =>
      p.handle === scrapedProduct.handle
    )

    if (handleMatch) {
      console.log(`[DEBUG] Found existing product with matching handle: "${handleMatch.title}" (${handleMatch.id})`)
      console.log(`[DEBUG] Shopify ID: ${handleMatch.metadata?.shopify_product_id}`)
      medusaProduct = handleMatch
    }
  }

  if (medusaProduct) {
    console.log(`[DEBUG] Using existing product: "${medusaProduct.title}" (${medusaProduct.id})`)
  }

  // Check if we need to skip handle updates to avoid conflicts
  let skipHandleUpdate = false
  if (medusaProduct && medusaProduct.handle !== scrapedProduct.handle) {
    const allProducts = await medusaClient.listProducts(300, 0)
    const handleConflict = allProducts.find(p =>
      p.handle === scrapedProduct.handle &&
      p.id !== medusaProduct.id
    )

    if (handleConflict) {
      console.log(`⚠️  Skipping handle update to avoid conflict with existing product: "${handleConflict.title}" (${handleConflict.id})`)
      skipHandleUpdate = true
    }
  }

  const { createPayload, updatePayload, optionTitles } = buildProductUpsertPayloadFromScrape(
    scrapedProduct,
    medusaProduct,
    skipHandleUpdate
  )

  await assignProductCollection({
    scrapedProduct,
    createPayload,
    updatePayload,
    collectionHandle,
    medusaClient,
    collectionCache,
    dryRun,
  })

  if (!medusaProduct) {
    // Check for handle conflicts with existing products
    const allProducts = await medusaClient.listProducts(100, 0) // Get first 100 products
    console.log(`[DEBUG] Checking handle "${scrapedProduct.handle}" against ${allProducts.length} existing products`)

    const handleConflict = allProducts.find(p => {
      const hasConflict = p.handle === scrapedProduct.handle &&
                         p.metadata?.shopify_product_id !== scrapedProduct.id
      if (p.handle === scrapedProduct.handle) {
        console.log(`[DEBUG] Found product with same handle: "${p.title}" (${p.id}) shopify_id: ${p.metadata?.shopify_product_id}`)
        console.log(`[DEBUG] Current product shopify_id: ${scrapedProduct.id}`)
        console.log(`[DEBUG] Conflict detected: ${hasConflict}`)
      }
      return hasConflict
    })

    if (handleConflict) {
      console.log(`⚠️  Handle conflict detected: "${scrapedProduct.handle}" already exists in product "${handleConflict.title}" (${handleConflict.id})`)
      console.log(`   Modifying handle to avoid conflict...`)
      createPayload.handle = `${scrapedProduct.handle}-shopify`
    }

    if (dryRun) {
      console.log(`[dry-run] would create product ${scrapedProduct.title}`)
      summary.created += 1
      return
    }

    medusaProduct = await medusaClient.createProduct({
      ...createPayload,
      metadata: {
        ...createPayload.metadata,
        shopify_sync_mode: "web_scrape",
      },
    })
    summary.created += 1
    console.log(`Created product: ${medusaProduct.title}`)
  } else {
    if (dryRun) {
      console.log(`[dry-run] would update product ${medusaProduct.id}`)
      summary.updated += 1
      return
    }

    medusaProduct = await medusaClient.updateProduct(medusaProduct.id, updatePayload)
    summary.updated += 1
    console.log(`Updated product: ${medusaProduct.title}`)
  }

  // Refresh product data
  medusaProduct = await medusaClient.retrieveProduct(medusaProduct.id)

  // Update product options to match Shopify exactly
  await syncProductOptions({
    scrapedProduct,
    medusaProduct,
    medusaClient,
    dryRun,
  })

  // Refresh again after options
  medusaProduct = await medusaClient.retrieveProduct(medusaProduct.id)

  console.log("Refreshed product options:")
  medusaProduct.options.forEach(option => {
    const values = option.values?.map(v => v.value).join(", ") || "none"
    console.log(`  - ${option.title}: [${values}]`)
  })

  // Add a small delay to ensure option values are fully propagated
  console.log("Waiting for option values to propagate...")
  await new Promise(resolve => setTimeout(resolve, 2000))

  // Add product to sales channel
  if (config.medusaSalesChannelId) {
    if (dryRun) {
      console.log(`[dry-run] would add product to sales channel ${config.medusaSalesChannelId}`)
    } else {
      console.log(`Adding product to sales channel ${config.medusaSalesChannelId}`)
      try {
        await medusaClient.addProductToSalesChannel(medusaProduct.id, config.medusaSalesChannelId)
      } catch (error) {
        console.log(`Sales channel assignment failed (may already be assigned):`, error.message)
      }
    }
  }

  // Sync variants (with proper option handling)
  // Note: medusaProduct has been refreshed with updated options after syncProductOptions
  await syncScrapedVariants({
    scrapedProduct,
    medusaProduct,
    medusaClient,
    dryRun,
    summary,
  })

  // Refresh again after variants
  medusaProduct = await medusaClient.retrieveProduct(medusaProduct.id)

  if (!dryRun) {
    await ensureProductInventoryLevels({
      medusaProduct,
      medusaClient,
      config,
      quantity: DEFAULT_INVENTORY_QUANTITY,
    })
  }

  // Sync images
  await syncScrapedImages({
    scrapedProduct,
    medusaProduct,
    medusaClient,
    dryRun,
    summary,
  })
}

async function syncProductOptions(params: {
  scrapedProduct: ScrapedProduct
  medusaProduct: MedusaProduct
  medusaClient: MedusaAdminClient
  dryRun: boolean
}) {
  const { scrapedProduct, medusaProduct, medusaClient, dryRun } = params

  // Get current Medusa options
  const currentOptions = medusaProduct.options || []

  // Create a map of Shopify options for easy lookup
  const shopifyOptionsMap = new Map(
    scrapedProduct.options.map(opt => [opt.name.toLowerCase(), opt])
  )

  console.log(`Syncing options for product ${medusaProduct.handle}...`)
  console.log(`Current Medusa options: ${currentOptions.map(o => o.title).join(", ")}`)
  console.log(`Target Shopify options: ${scrapedProduct.options.map(o => o.name).join(", ")}`)

  // Check if options are already in sync
  const optionsMatch = areOptionsInSync(currentOptions, scrapedProduct.options)

  if (optionsMatch) {
    console.log("✅ Product options are already in sync, skipping update")
    return
  }

  console.log("🔄 Product options need updating")

  if (dryRun) {
    console.log("[dry-run] would sync product options")
    return
  }

  // Step 1: Delete ALL existing options to start fresh
  for (const medusaOption of currentOptions) {
    if (dryRun) {
      console.log(`[dry-run] would delete option "${medusaOption.title}"`)
    } else {
      console.log(`Deleting option "${medusaOption.title}"`)
      await medusaClient.deleteProductOption(medusaProduct.id, medusaOption.id)
    }
  }

  // Step 2: Create all Shopify options from scratch
  for (const shopifyOption of scrapedProduct.options) {
    if (dryRun) {
      console.log(`[dry-run] would create option "${shopifyOption.name}" with values [${shopifyOption.values.join(", ")}]`)
    } else {
      console.log(`Creating option "${shopifyOption.name}" with values [${shopifyOption.values.join(", ")}]`)
      await medusaClient.createProductOption(medusaProduct.id, {
        title: shopifyOption.name,
        values: shopifyOption.values
      })
    }
  }

  // Refresh the product data to get updated options
  if (!dryRun) {
    // Add a small delay to ensure options are fully created
    await new Promise(resolve => setTimeout(resolve, 1000))

    const updatedProduct = await medusaClient.retrieveProduct(medusaProduct.id)
    Object.assign(medusaProduct, updatedProduct)

    console.log(`Refreshed product options:`)
    medusaProduct.options.forEach(option => {
      console.log(`  - ${option.title}: [${option.values?.map(v => v.value).join(", ") || "no values"}]`)
    })
  }
}

async function syncScrapedVariants(params: {
  scrapedProduct: ScrapedProduct
  medusaProduct: MedusaProduct
  medusaClient: MedusaAdminClient
  dryRun: boolean
  summary: WebSyncSummary
}) {
  const { scrapedProduct, medusaProduct, medusaClient, dryRun, summary } = params

  // Generate variant inputs using the refreshed product data with updated options
  const variantInputs = buildVariantUpsertPayloadFromScrape(scrapedProduct, medusaProduct)

  console.log(`Processing ${variantInputs.length} variants for product ${medusaProduct.handle}`)

  for (const variant of variantInputs) {
    if (variant.variantId) {
      // Update existing variant
      if (dryRun) {
        console.log(`[dry-run] would update variant ${variant.variantId}: ${variant.payload.title}`)
      } else {
        console.log(`Updating existing variant: ${variant.payload.title}`)
        await medusaClient.updateVariant(variant.productId, variant.variantId, variant.payload)
        summary.variantUpdated += 1
      }
    } else {
      // Create new variant
      if (dryRun) {
        console.log(`[dry-run] would create variant ${variant.payload.title}`)
      } else {
        // Validate option values exist before creating variant
        const optionMapping = variant.payload.options as Record<string, string>
        const isValid = validateOptionValuesByTitle(medusaProduct, optionMapping)

        if (isValid) {
          // Check for SKU conflicts before creating variant
          let sku = variant.payload.sku as string | undefined
          if (sku) {
            const skuConflict = await checkVariantSKUConflict(medusaClient, sku, variant.productId)
            if (skuConflict) {
              console.log(`⚠️  SKU conflict detected: "${sku}" already exists in product "${skuConflict.productTitle}" (${skuConflict.productId})`)
              console.log(`   Modifying SKU to avoid conflict...`)
              variant.payload.sku = `${sku}-shopify`
              sku = variant.payload.sku as string | undefined
            }
          }

          const createPayload: Record<string, unknown> = { ...variant.payload }
          const existingInventoryItem = await findInventoryItemBySku({
            medusaClient,
            sku: sku,
          })

          if (existingInventoryItem) {
            ;(createPayload as any).inventory_items = [
              {
                inventory_item_id: existingInventoryItem.id,
                required_quantity: 1,
              },
            ]
          }

          console.log(`Creating new variant: ${variant.payload.title}`)

          let created = false

          try {
            await medusaClient.createVariant(variant.productId, createPayload)
            created = true
          } catch (error) {
            const normalizedSku = normalizeSku(sku)
            const canRetry =
              !existingInventoryItem &&
              normalizedSku &&
              isInventoryItemConflictError(error)

            if (canRetry) {
              console.log(`Inventory item conflict detected for SKU ${sku}. Attempting to reuse existing inventory item...`)
              const retryInventoryItem = await findInventoryItemBySku({ medusaClient, sku })
              if (retryInventoryItem) {
                ;(createPayload as any).inventory_items = [
                  {
                    inventory_item_id: retryInventoryItem.id,
                    required_quantity: 1,
                  },
                ]

                await medusaClient.createVariant(variant.productId, createPayload)
                created = true
              }
            }

            if (!created) {
              throw error
            }
          }

          if (created) {
            const normalized = normalizeSku(createPayload.sku as string | undefined ?? sku)
            if (normalized) {
              inventoryItemBySkuCache.delete(normalized)
            }
            summary.variantCreated += 1
          }
        } else {
          console.log(`❌ Skipping variant creation due to invalid option values: ${variant.payload.title}`)
          summary.skipped += 1
        }
      }
    }
  }
}

async function checkVariantSKUConflict(
  medusaClient: MedusaAdminClient,
  sku: string,
  currentProductId: string
): Promise<{ productId: string; productTitle: string } | null> {
  try {
    // Get all products with pagination to ensure we check everything
    let offset = 0
    const limit = 50
    let hasMore = true

    while (hasMore) {
      const products = await medusaClient.listProducts(limit, offset)

      for (const product of products) {
        // Skip the current product we're syncing to
        if (product.id === currentProductId) continue

        // Check if any variant in this product has the conflicting SKU
        const conflictingVariant = product.variants.find(v => v.sku === sku)
        if (conflictingVariant) {
          return {
            productId: product.id,
            productTitle: product.title
          }
        }
      }

      // Check if we need to continue pagination
      hasMore = products.length === limit
      offset += limit
    }

    return null
  } catch (error) {
    console.log(`Warning: Could not check SKU conflicts for "${sku}":`, error.message)
    return null
  }
}

function validateOptionValuesByTitle(product: MedusaProduct, optionMapping: Record<string, string>): boolean {
  console.log(`[DEBUG] Validating option mapping by title:`, optionMapping)
  console.log(`[DEBUG] Available product options:`)

  product.options.forEach(opt => {
    console.log(`  - ${opt.title} (${opt.id}): [${opt.values?.map(v => v.value).join(", ") || "no values"}]`)
  })

  for (const [optionTitle, value] of Object.entries(optionMapping)) {
    const option = product.options.find(opt => opt.title.toLowerCase() === optionTitle.toLowerCase())
    if (!option) {
      console.log(`❌ Option "${optionTitle}" not found in product`)
      return false
    }

    const valueExists = option.values?.some(v => v.value === value)
    if (!valueExists) {
      console.log(`❌ Option value "${value}" not found for option "${option.title}"`)
      console.log(`Available values: [${option.values?.map(v => v.value).join(", ") || "none"}]`)
      return false
    } else {
      console.log(`✅ Found "${value}" in option "${option.title}"`)
    }
  }

  console.log(`✅ All option values validated locally for variant`)
  return true
}

function areOptionsInSync(medusaOptions: any[], shopifyOptions: any[]): boolean {
  // Check if the number of options matches
  if (medusaOptions.length !== shopifyOptions.length) {
    return false
  }

  // Create maps for easy comparison
  const medusaMap = new Map(
    medusaOptions.map(opt => [
      opt.title.toLowerCase(),
      new Set(opt.values?.map((v: any) => v.value) || [])
    ])
  )

  const shopifyMap = new Map(
    shopifyOptions.map(opt => [
      opt.name.toLowerCase(),
      new Set(opt.values)
    ])
  )

  // Check if all Shopify options exist in Medusa with same values
  for (const [shopifyName, shopifyValues] of shopifyMap) {
    const medusaValues = medusaMap.get(shopifyName)

    if (!medusaValues) {
      return false // Option doesn't exist in Medusa
    }

    // Check if value sets are identical
    if (medusaValues.size !== shopifyValues.size) {
      return false
    }

    for (const value of shopifyValues) {
      if (!medusaValues.has(value)) {
        return false
      }
    }
  }

  return true
}

function isInventoryItemConflictError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return /inventory item with sku/i.test(error.message)
}

async function syncScrapedImages(params: {
  scrapedProduct: ScrapedProduct
  medusaProduct: MedusaProduct
  medusaClient: MedusaAdminClient
  dryRun: boolean
  summary: WebSyncSummary
}) {
  const { scrapedProduct, medusaProduct, medusaClient, dryRun, summary } = params
  const metadata = (medusaProduct.metadata as Record<string, unknown>) || {}
  const existingMap = (metadata.shopify_image_map as Record<string, string>) || {}
  const nextMap: Record<string, string> = { ...existingMap }
  const newImageUrls: string[] = []

  // Helper to upload an image with deduplication
  const uploadImageIfNeeded = async (imageUrl: string, imageId: string) => {
    // Check if already uploaded
    if (existingMap[imageId]) {
      return existingMap[imageId]
    }

    if (dryRun) {
      console.log(`[dry-run] would upload image ${imageUrl}`)
      return null
    }

    try {
      const response = await fetch(imageUrl)
      if (!response.ok) {
        console.warn(`Failed to download image ${imageUrl}: ${response.status}`)
        return null
      }

      const buffer = await response.arrayBuffer()
      // Extract filename and remove URL parameters to avoid encoding issues
      const urlPart = imageUrl.split("/").pop() ?? `${imageId}.jpg`
      const fileName = urlPart.split("?")[0] // Remove URL parameters like ?v=1724264851
      const mimeType = response.headers.get("content-type") ?? "image/jpeg"
      const medusaUrl = await medusaClient.uploadImage(buffer, fileName, mimeType)

      newImageUrls.push(medusaUrl)
      nextMap[imageId] = medusaUrl
      summary.imageUploaded += 1
      return medusaUrl
    } catch (error) {
      console.warn(`Failed to upload image ${imageUrl}:`, error)
      return null
    }
  }

  // Upload product gallery images
  for (const image of scrapedProduct.images) {
    await uploadImageIfNeeded(image.url, image.id)
  }

  // Upload marketing content feature images
  if (scrapedProduct.marketingContent?.features) {
    const updatedMetadata = { ...metadata }
    const pdpSections = updatedMetadata.pdp_sections as Array<{
      type: string
      title: string
      body_html: string
      image: string | null
    }> || []

    for (let i = 0; i < scrapedProduct.marketingContent.features.length; i++) {
      const feature = scrapedProduct.marketingContent.features[i]
      if (feature.image) {
        // Create unique ID for feature image
        const featureImageId = `feature_${i}_${feature.image.split("/").pop()?.split("?")[0]}`
        const uploadedUrl = await uploadImageIfNeeded(feature.image, featureImageId)

        // Update the pdp_sections metadata with the uploaded Medusa URL
        if (uploadedUrl && pdpSections[i]) {
          pdpSections[i].image = uploadedUrl
        }
      }
    }

    // Update metadata with uploaded feature images
    if (pdpSections.length > 0) {
      updatedMetadata.pdp_sections = pdpSections
    }

    // Update product metadata if we have new metadata
    if (!dryRun && (newImageUrls.length > 0 || pdpSections.length > 0)) {
      await medusaClient.updateProduct(medusaProduct.id, {
        metadata: {
          ...updatedMetadata,
          shopify_image_map: nextMap,
        },
      })
    }
  } else if (!dryRun && newImageUrls.length > 0) {
    // Standard update without marketing content
    await medusaClient.updateProduct(medusaProduct.id, {
      metadata: {
        ...metadata,
        shopify_image_map: nextMap,
      },
    })
  }

  // Add gallery images to product
  if (!dryRun && newImageUrls.length > 0) {
    await medusaClient.addProductImages(medusaProduct.id, newImageUrls)

    if (!medusaProduct.thumbnail && newImageUrls[0]) {
      await medusaClient.setProductThumbnail(medusaProduct.id, newImageUrls[0])
    }
  }
}

async function bootstrapCollections(medusaClient: MedusaAdminClient): Promise<Map<string, MedusaCollection>> {
  const list = await medusaClient.listCollections()
  const cache = new Map<string, MedusaCollection>()
  const handleAliases: Record<string, string> = {
    "apparel-gifts": "vnsh-holsters-apparel-and-gifts",
  }
  for (const collection of list) {
    cache.set(collection.handle.toLowerCase(), collection)
    const alias = handleAliases[collection.handle.toLowerCase()]
    if (alias) {
      cache.set(alias, collection)
    }
  }
  return cache
}

async function ensureCollection(params: {
  medusaClient: MedusaAdminClient
  cache: Map<string, MedusaCollection>
  handle: string
  title: string
  dryRun: boolean
}): Promise<string | undefined> {
  const key = params.handle.toLowerCase()
  const cached = params.cache.get(key)
  if (cached) return cached.id

  if (params.dryRun) {
    console.log(`[dry-run] would create collection ${params.title}`)
    return undefined
  }

  const created = await params.medusaClient.createCollection({ 
    title: params.title, 
    handle: params.handle 
  })
  params.cache.set(key, created)
  return created.id
}

function parseWebSyncArgs(argv: string[]): WebSyncArgs {
  const args: WebSyncArgs = {
    mode: "full",
    dryRun: false,
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    switch (arg) {
      case "--mode": {
        const value = argv[++i]
        if (value !== "full" && value !== "collection") {
          throw new Error(`Invalid mode: ${value}`)
        }
        args.mode = value
        break
      }
      case "--collection": {
        args.collectionHandle = argv[++i]
        args.mode = "collection"
        break
      }
      case "--dry-run": {
        args.dryRun = true
        break
      }
      case "--limit": {
        args.limit = Number.parseInt(argv[++i], 10)
        break
      }
      default:
        throw new Error(`Unknown argument: ${arg}`)
    }
  }

  if (args.mode === "collection" && !args.collectionHandle) {
    throw new Error("--collection is required when mode=collection")
  }

  return args
}

function isDirectExecution(): boolean {
  if (!process.argv[1]) return false
  const executedUrl = new URL(`file://${resolve(process.argv[1])}`)
  return import.meta.url === executedUrl.href
}

if (isDirectExecution()) {
  runWebSync().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
