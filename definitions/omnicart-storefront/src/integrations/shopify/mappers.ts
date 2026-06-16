// @ts-nocheck
import type { ShopifyProductNode } from "./shopifyClient"
import type { ScrapedProduct } from "./webScraper"
import type { MedusaProduct } from "./medusaAdminClient"

export const DEFAULT_INVENTORY_QUANTITY = 10_000

export interface ProductUpsertPayload {
  createPayload: Record<string, unknown>
  updatePayload: Record<string, unknown>
  optionTitles: string[]
}

export interface VariantUpsertInput {
  productId: string
  variantId?: string
  payload: Record<string, unknown>
  prices: Array<{ amount: number; currency_code: string }>
}

export function buildProductUpsertPayload(
  shopifyProduct: ShopifyProductNode,
  existingProduct?: MedusaProduct
): ProductUpsertPayload {
  const status = shopifyProduct.status === "ACTIVE" ? "published" : "draft"

  const metadata = {
    ...(existingProduct?.metadata ?? {}),
    shopify_product_id: shopifyIdFromGid(shopifyProduct.id),
    shopify_handle: shopifyProduct.handle,
    shopify_updated_at: shopifyProduct.updatedAt,
    shopify_vendor: shopifyProduct.vendor,
    shopify_product_type: shopifyProduct.productType,
    shopify_tags: shopifyProduct.tags,
    shopify_published_at: shopifyProduct.publishedAt,
  }

  const collectionHandles = Array.from(new Set(
    (shopifyProduct.collections ?? [])
      .map((collection) => collection.handle)
      .filter((handle): handle is string => Boolean(handle))
  ))

  if (collectionHandles.length > 0) {
    metadata.shopify_collection_handles = collectionHandles.join(",")
  }

  const collectionTitles = Array.from(new Set(
    (shopifyProduct.collections ?? [])
      .map((collection) => collection.title)
      .filter((title): title is string => Boolean(title))
  ))

  if (collectionTitles.length > 0) {
    metadata.shopify_collection_titles = collectionTitles.join(",")
  }

  if (shopifyProduct.seo) {
    metadata.shopify_seo = shopifyProduct.seo
  }

  const description = shopifyProduct.descriptionHtml ?? ""

  const createPayload: Record<string, unknown> = {
    title: shopifyProduct.title,
    handle: shopifyProduct.handle,
    description,
    status,
    options: shopifyProduct.options.map((option) => ({
      title: option.name,
      values: option.values,
    })),
    metadata,
  }

  const updatePayload: Record<string, unknown> = {
    title: shopifyProduct.title,
    handle: shopifyProduct.handle,
    description,
    status,
    metadata,
  }

  return {
    createPayload,
    updatePayload,
    optionTitles: shopifyProduct.options.map((option) => option.name),
  }
}

export function buildVariantUpsertPayload(
  shopifyProduct: ShopifyProductNode,
  medusaProduct: MedusaProduct
): VariantUpsertInput[] {
  const medusaOptionsByTitle = new Map(medusaProduct.options.map((option) => [option.title.toLowerCase(), option]))

  return shopifyProduct.variants.map((variant) => {
    const shopifyVariantId = shopifyIdFromGid(variant.id)
    const medusaVariant = medusaProduct.variants.find((v) => v.metadata?.shopify_variant_id === shopifyVariantId)

    const optionAssignments = variant.selectedOptions.map((option) => {
      const medusaOption = medusaOptionsByTitle.get(option.name.toLowerCase())
      if (!medusaOption) {
        throw new Error(`Missing Medusa option for Shopify option: ${option.name}`)
      }

      return {
        option_id: medusaOption.id,
        value: option.value,
      }
    })

    const optionMap = optionAssignments.reduce<Record<string, string>>((acc, assignment) => {
      if (assignment.option_id) {
        acc[assignment.option_id] = assignment.value
      }
      return acc
    }, {})

  const payload: Record<string, unknown> = {
    title: variant.title,
    sku: variant.sku ?? undefined,
    manage_inventory: true,
    allow_backorder: variant.inventoryPolicy === "CONTINUE",
      metadata: {
        ...(medusaVariant?.metadata ?? {}),
        shopify_variant_id: shopifyVariantId,
        shopify_updated_at: variant.updatedAt,
        shopify_compare_at_price: variant.compareAtPrice,
        shopify_inventory_quantity: variant.inventoryQuantity ?? 0,
      },
      options: optionMap,
    }

    const amount = Math.round(Number.parseFloat(variant.price) * 100)

    return {
      productId: medusaProduct.id,
      variantId: medusaVariant?.id,
      payload,
      prices: [
        {
          amount,
          currency_code: medusaProduct.variants[0]?.prices?.[0]?.currency_code ?? "usd",
        },
      ],
    }
  })
}

export function shopifyIdFromGid(gid: string): string {
  const parts = gid.split("/")
  return parts[parts.length - 1]
}

/**
 * Build product upsert payload from scraped Shopify data
 */
export function buildProductUpsertPayloadFromScrape(
  scrapedProduct: ScrapedProduct,
  medusaProduct?: MedusaProduct,
  skipHandleUpdate: boolean = false
): {
  createPayload: any
  updatePayload: any
  optionTitles: string[]
} {
  const metadata: Record<string, any> = {
    shopify_product_id: scrapedProduct.id,
    shopify_vendor: scrapedProduct.vendor,
    shopify_product_type: scrapedProduct.productType,
    shopify_tags: scrapedProduct.tags.join(","),
    shopify_created_at: scrapedProduct.createdAt,
    shopify_updated_at: scrapedProduct.updatedAt,
  }

  // Add marketing content to metadata if available
  if (scrapedProduct.marketingContent) {
    const { features, heroBadges, valueProps } = scrapedProduct.marketingContent

    if (features && features.length > 0) {
      metadata.pdp_sections = features.map((feature) => ({
        type: "image_with_text",
        title: feature.title,
        body_html: feature.description,
        image: feature.image || null,
      }))
    }

    if (heroBadges && heroBadges.length > 0) {
      metadata.hero_badges = heroBadges
    }

    if (valueProps && valueProps.length > 0) {
      metadata.value_props = valueProps
    }
  }

  const basePayload = {
    title: scrapedProduct.title,
    handle: scrapedProduct.handle,
    description: scrapedProduct.description,
    status: "published" as const,
    thumbnail: scrapedProduct.images[0]?.url || null,
    metadata,
  }

  const scrapedCollectionHandles = Array.from(new Set(
    scrapedProduct.collections
      .map(collection => collection.handle)
      .filter((handle): handle is string => Boolean(handle))
  ))

  if (scrapedCollectionHandles.length > 0) {
    basePayload.metadata.shopify_collection_handles = scrapedCollectionHandles.join(",")
  }

  const scrapedCollectionTitles = Array.from(new Set(
    scrapedProduct.collections
      .map(collection => collection.title)
      .filter((title): title is string => Boolean(title))
  ))

  if (scrapedCollectionTitles.length > 0) {
    basePayload.metadata.shopify_collection_titles = scrapedCollectionTitles.join(",")
  }

  // Handle products without options by creating a default option structure
  let optionTitles: string[]
  let optionsForPayload: any[]

  if (scrapedProduct.options.length === 0) {
    // Products without options need a default option for Medusa
    optionTitles = ["Title"]
    optionsForPayload = [
      {
        title: "Title",
        values: ["Default Title"]
      }
    ]
  } else {
    // Products with options use the actual options
    optionTitles = scrapedProduct.options.map(option => option.name)
    optionsForPayload = scrapedProduct.options.map(option => ({
      title: option.name,
      values: option.values
    }))
  }

  // For updates, only include fields that have actually changed
  const updatePayload: any = {}

  if (medusaProduct) {
    if (medusaProduct.title !== scrapedProduct.title) {
      updatePayload.title = scrapedProduct.title
    }
    if (medusaProduct.handle !== scrapedProduct.handle && !skipHandleUpdate) {
      updatePayload.handle = scrapedProduct.handle
    }
    if (medusaProduct.description !== scrapedProduct.description) {
      updatePayload.description = scrapedProduct.description
    }
    if (medusaProduct.status !== "published") {
      updatePayload.status = "published"
    }
    if (medusaProduct.thumbnail !== (scrapedProduct.images[0]?.url || null)) {
      updatePayload.thumbnail = scrapedProduct.images[0]?.url || null
    }

    // Check metadata changes
    const currentMetadata = medusaProduct.metadata as Record<string, any> || {}
    const newMetadata = basePayload.metadata
    const metadataChanges: Record<string, any> = {}

    for (const [key, value] of Object.entries(newMetadata)) {
      if (currentMetadata[key] !== value) {
        metadataChanges[key] = value
      }
    }

    if (Object.keys(metadataChanges).length > 0) {
      updatePayload.metadata = { ...currentMetadata, ...metadataChanges }
    }
  }

  return {
    createPayload: {
      ...basePayload,
      options: optionsForPayload
    },
    updatePayload,
    optionTitles,
  }
}

/**
 * Build variant upsert payload from scraped Shopify data
 */
export function buildVariantUpsertPayloadFromScrape(
  scrapedProduct: ScrapedProduct,
  medusaProduct: MedusaProduct
): Array<{
  productId: string
  variantId?: string
  payload: any
}> {
  console.log(`[DEBUG] Existing Medusa variants:`)
  medusaProduct.variants.forEach(v => {
    console.log(`  - ${v.title} (${v.id}) SKU: ${v.sku}`)
  })
  return scrapedProduct.variants.map(variant => {
    // Try to find existing variant by Shopify ID first, then by SKU as fallback
    let medusaVariant = medusaProduct.variants.find(
      v => v.metadata?.shopify_variant_id === variant.id
    )

    if (!medusaVariant && variant.sku) {
      medusaVariant = medusaProduct.variants.find(
        v => v.sku === variant.sku
      )
      console.log(`[VARIANT] Found existing variant by SKU: ${variant.sku} -> ${medusaVariant?.id}`)
    }

    const amount = Math.round(variant.price * 100)

    const payload = {
      title: variant.title,
      sku: variant.sku || null,
      allow_backorder: false,
      manage_inventory: true,
      metadata: {
        shopify_variant_id: variant.id,
        shopify_available: variant.available,
        shopify_compare_at_price: variant.compareAtPrice || null,
        shopify_inventory_quantity: variant.inventoryQuantity || 0,
      },
      options: (() => {
        // Use option titles instead of IDs for Admin API compatibility
        const optionMapping: Record<string, string> = {}

        if (Object.keys(variant.options).length === 0) {
          // For products without options, use the default option
          optionMapping["Title"] = "Default Title"
          console.log(`[VARIANT] Using default option mapping: Title="Default Title"`)
        } else {
          Object.entries(variant.options).forEach(([optionName, value]) => {
            // Use the option title directly as the key
            optionMapping[optionName] = value
            console.log(`[VARIANT] Mapping ${optionName}="${value}"`)
          })
        }

        return optionMapping
      })(),
      prices: [
        {
          currency_code: medusaProduct.variants[0]?.prices?.[0]?.currency_code ?? "usd",
          amount: amount,
        },
      ],
    }

    return {
      productId: medusaProduct.id,
      variantId: medusaVariant?.id,
      payload,
    }
  })
}
