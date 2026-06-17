// Using direct API client for CORS-free API access
import { medusaClient } from '../../lib/medusa-client';
import { OMNICART_PUBLISHABLE_KEY, OMNICART_SALES_CHANNEL_ID } from '@/lib/omnicart-config';

export interface MedusaProductOption {
  id: string
  title: string
  values: Array<{
    id: string
    value: string
  }>
}

export interface MedusaProductImage {
  id: string
  url: string
}

export interface MedusaProductVariant {
  id: string
  title: string
  sku?: string
  product_id?: string
  inventory_quantity?: number
  manage_inventory: boolean
  allow_backorder: boolean
  prices: Array<{
    id: string
    amount: number
    currency_code: string
  }>
  options?: Array<{
    id: string
    option_id: string
    value: string
  }>
  calculated_price?: {
    calculated_amount: number
    original_amount: number
    currency_code: string
  }
  /** Variant-specific images (Medusa 2.12+) */
  images?: MedusaProductImage[]
  /** Variant thumbnail URL (Medusa 2.12+) */
  thumbnail?: string | null
}

export interface MedusaProduct {
  id: string
  title: string
  handle: string
  description: string | null
  thumbnail: string | null
  images: MedusaProductImage[]
  variants: Array<MedusaProductVariant>
  options?: Array<MedusaProductOption>
  collection?: {
    id: string
    title: string
    handle: string
  }
  tags?: Array<{
    id: string
    value: string
  }>
  status: string
  created_at: string
  updated_at: string
  metadata?: Record<string, unknown>
}

export interface MedusaCollection {
  id: string
  title: string
  handle: string
  products?: MedusaProduct[]
}

type VariantSourceConfig = {
  handle: string
  optionValue: string
}

type ProductOverrideConfig = {
  handle: string
  title: string
  descriptionHtml?: string
  thumbnail?: string
  galleryImages?: string[]
  optionTitle: string
  variantSources: VariantSourceConfig[]
  removeSourceProducts?: boolean
}

type SourceProductEntry = {
  config: VariantSourceConfig
  product: MedusaProduct
}

const PRODUCT_OVERRIDES: Record<string, ProductOverrideConfig> = {
  "vnsh-holster": {
    handle: "vnsh-holster",
    title: "The VNSH Holster",
    descriptionHtml: `<p>The flagship VNSH Holster delivers the all-day comfort customers expect: breathable stretch fabric, an ambidextrous draw, two built-in magazine pouches, and a secure fit that works with 99% of modern handguns.</p><p>Pick the size that matches your waist measurement and enjoy faster shipping, a 30-day comfort guarantee, and lifetime warranty support.</p>`,
    thumbnail: "/images/products/DSC01875-1.png",
    galleryImages: [
      "/images/products/DSC01875-1.png",
      "/images/products/compatible-brands.jpg",
      "/images/products/VNSH-Holster-r2-opt.gif",
    ],
    optionTitle: "Size",
    variantSources: [
      { handle: "vnsh-holster-regular", optionValue: "Regular (Up to 48\")" },
      { handle: "vnsh-holster-xl", optionValue: "Large (Up to 68\")" },
    ],
    removeSourceProducts: true,
  },
}

const DEFAULT_VIRTUAL_COLLECTION = {
  id: "virtual_collection_products",
  title: "Products",
  handle: "products",
}

const VIRTUAL_IMAGE_PREFIX = "virtual-image"

const DEFAULT_QUERY_FIELDS =
  "*variants,*variants.prices,*variants.options,*variants.images,+variants.inventory_quantity,*options,*options.values,*collection,*tags,*images,*metadata"

async function fetchStoreProductByHandle(
  handle: string,
  options?: { useSalesChannel?: boolean }
): Promise<MedusaProduct | null> {
  if (!handle) return null

  const { useSalesChannel = true } = options ?? {}

  try {
    const query: Record<string, unknown> = {
      handle,
      fields: DEFAULT_QUERY_FIELDS,
    }

    if (useSalesChannel && OMNICART_SALES_CHANNEL_ID) {
      query['sales_channel_id'] = [OMNICART_SALES_CHANNEL_ID]
    }

    const response = await medusaClient.get<{ products: MedusaProduct[] }>('/store/products', {
      query,
      headers: {
        'x-publishable-api-key': OMNICART_PUBLISHABLE_KEY,
      },
      cache: "no-store",
    })

    return response.products?.[0] ?? null
  } catch (error) {
    console.error(`Error fetching product by handle "${handle}":`, error)
    return null
  }
}

function createVirtualProductFromSources(
  override: ProductOverrideConfig,
  sources: SourceProductEntry[]
): MedusaProduct | null {
  if (!sources.length) return null

  const baseProduct = sources[0]?.product
  const virtualProductId = `virtual_${override.handle}`
  const optionId = `virtual-option-${override.handle}`
  const now = new Date().toISOString()

  const optionValues = sources.map((source, index) => ({
    id: `${optionId}-value-${index}`,
    value: source.config.optionValue,
  }))

  const variants: MedusaProductVariant[] = sources
    .map((source, index) => {
      const baseVariant = source.product?.variants?.[0]
      if (!baseVariant) return null

      const virtualVariant: MedusaProductVariant = {
        ...baseVariant,
        title: `${override.title} - ${source.config.optionValue}`,
        product_id: virtualProductId,
        options: [
          {
            id: `${baseVariant.id}-${optionId}`,
            option_id: optionId,
            value: source.config.optionValue,
          },
        ],
      }

      return virtualVariant
    })
    .filter((variant): variant is MedusaProductVariant => Boolean(variant))

  if (!variants.length) {
    return null
  }

  const galleryImages =
    override.galleryImages && override.galleryImages.length > 0
      ? override.galleryImages
      : sources.flatMap((source) => (source.product.images || []).map((image) => image.url))

  const images = galleryImages.map((url, index) => ({
    id: `${VIRTUAL_IMAGE_PREFIX}-${override.handle}-${index}`,
    url,
  }))

  const thumbnail =
    override.thumbnail ??
    images[0]?.url ??
    baseProduct?.thumbnail ??
    null

  return {
    id: virtualProductId,
    title: override.title,
    handle: override.handle,
    description: override.descriptionHtml ?? baseProduct?.description ?? null,
    thumbnail,
    images,
    variants,
    options: [
      {
        id: optionId,
        title: override.optionTitle,
        values: optionValues,
      },
    ],
    collection: baseProduct?.collection ?? DEFAULT_VIRTUAL_COLLECTION,
    tags: baseProduct?.tags ?? [],
    status: baseProduct?.status ?? "published",
    created_at: baseProduct?.created_at ?? now,
    updated_at: now,
    metadata: {
      ...(baseProduct?.metadata ?? {}),
      virtual_handle: override.handle,
      virtual_source_handles: sources.map((source) => source.product.handle),
    },
  }
}

async function buildOverrideProduct(
  override: ProductOverrideConfig,
  productMap: Map<string, MedusaProduct>,
  options?: { requireExistingSources?: boolean }
): Promise<{ product: MedusaProduct; consumedHandles: string[] } | null> {
  const requireExistingSources = options?.requireExistingSources ?? false
  const collectedSources: SourceProductEntry[] = []

  for (const variantSource of override.variantSources) {
    let sourceProduct = productMap.get(variantSource.handle)

    if (!sourceProduct && !requireExistingSources) {
      sourceProduct = await fetchStoreProductByHandle(variantSource.handle, { useSalesChannel: false })
      if (sourceProduct) {
        productMap.set(sourceProduct.handle, sourceProduct)
      }
    }

    if (!sourceProduct) {
      return null
    }

    collectedSources.push({ config: variantSource, product: sourceProduct })
  }

  const virtualProduct = createVirtualProductFromSources(override, collectedSources)
  if (!virtualProduct) return null

  return {
    product: virtualProduct,
    consumedHandles: collectedSources.map(({ product }) => product.handle),
  }
}

async function withProductOverrides(
  products: MedusaProduct[],
  options?: { requireExistingSources?: boolean }
): Promise<MedusaProduct[]> {
  let nextProducts = [...products]
  const productMap = new Map(products.map((product) => [product.handle, product]))

  for (const override of Object.values(PRODUCT_OVERRIDES)) {
    if (nextProducts.some((product) => product.handle === override.handle)) {
      continue
    }

    const built = await buildOverrideProduct(override, productMap, options)
    if (!built) {
      continue
    }

    if (override.removeSourceProducts !== false && built.consumedHandles.length) {
      const handlesToRemove = new Set(built.consumedHandles)
      nextProducts = nextProducts.filter((product) => !handlesToRemove.has(product.handle))
    }

    nextProducts = [built.product, ...nextProducts]
  }

  return nextProducts
}

async function getOverrideProductByHandle(handle: string): Promise<MedusaProduct | null> {
  const override = PRODUCT_OVERRIDES[handle]
  if (!override) return null

  const built = await buildOverrideProduct(override, new Map(), { requireExistingSources: false })
  return built?.product ?? null
}

/**
 * Fetch all products from Medusa
 */
export async function getProducts(params?: {
  limit?: number
  offset?: number
  collection_id?: string[]
  category_id?: string[]
  q?: string
  sales_channel_id?: string[]
}): Promise<{ products: MedusaProduct[]; count: number }> {
  try {
    const query: Record<string, unknown> = {
      limit: params?.limit ?? 50,
      offset: params?.offset ?? 0,
      fields: DEFAULT_QUERY_FIELDS,
    }

    const resolvedSalesChannelId = params?.sales_channel_id ?? (OMNICART_SALES_CHANNEL_ID ? [OMNICART_SALES_CHANNEL_ID] : undefined)
    if (resolvedSalesChannelId) {
      query['sales_channel_id'] = resolvedSalesChannelId
    }

    if (params?.collection_id?.length) {
      query['collection_id'] = params.collection_id
    }

    if (params?.category_id?.length) {
      query['category_id'] = params.category_id
    }

    if (params?.q) {
      query['q'] = params.q
    }

    const response = await medusaClient.get<{ products?: MedusaProduct[]; count?: number }>(
      '/store/products',
      {
        query,
        headers: {
          'x-publishable-api-key': OMNICART_PUBLISHABLE_KEY,
        },
        cache: 'no-store',
      }
    )

    const baseProducts = response.products ?? []
    const augmentedProducts = await withProductOverrides(baseProducts)

    return {
      products: augmentedProducts,
      count: augmentedProducts.length,
    }
  } catch (error) {
    console.error('Error fetching products:', error)
    return { products: [], count: 0 }
  }
}

/**
 * Fetch a single product by handle/slug
 */
export async function getProductByHandle(handle: string): Promise<MedusaProduct | null> {
  const normalizedHandle = (handle ?? "").toLowerCase()
  if (!normalizedHandle) return null

  const directProduct = await fetchStoreProductByHandle(normalizedHandle)
  if (directProduct) return directProduct

  return getOverrideProductByHandle(normalizedHandle)
}

/**
 * Fetch a single product by ID
 */
export async function getProduct(id: string): Promise<MedusaProduct | null> {
  try {
    const response = await medusaClient.get<{ product: MedusaProduct }>(
      `/store/products/${id}`,
      {
        query: {
          fields: DEFAULT_QUERY_FIELDS,
          ...(OMNICART_SALES_CHANNEL_ID ? { sales_channel_id: [OMNICART_SALES_CHANNEL_ID] } : {})
        },
        headers: {
          'x-publishable-api-key': OMNICART_PUBLISHABLE_KEY,
        },
        cache: "no-store",
      }
    )

    return response.product
  } catch (error) {
    console.error('Error fetching product:', error)
    return null
  }
}

/**
 * Fetch collections
 */
export async function getCollections(): Promise<MedusaCollection[]> {
  try {
    const response = await medusaClient.get<{ collections: MedusaCollection[] }>('/store/collections', {
      query: {
        fields: "*products"
      }
    })

    return response.collections
  } catch (error) {
    console.error('Error fetching collections:', error)
    return []
  }
}

/**
 * Fetch a single collection by handle
 */
export async function getCollectionByHandle(handle: string): Promise<MedusaCollection | null> {
  try {
    const response = await medusaClient.get<{ collections: MedusaCollection[] }>('/store/collections', {
      query: {
        handle,
        fields: "*products"
      }
    })

    return response.collections?.[0] || null
  } catch (error) {
    console.error('Error fetching collection by handle:', error)
    return null
  }
}

/**
 * Search products
 */
export async function searchProducts(query: string, limit = 20): Promise<MedusaProduct[]> {
  try {
    const response = await medusaClient.get<{ products: MedusaProduct[] }>('/store/products', {
      query: {
        q: query,
        limit,
        fields: DEFAULT_QUERY_FIELDS,
        ...(OMNICART_SALES_CHANNEL_ID ? { sales_channel_id: [OMNICART_SALES_CHANNEL_ID] } : {})
      },
      headers: {
        'x-publishable-api-key': OMNICART_PUBLISHABLE_KEY,
      },
    })

    const baseProducts = response.products ?? []
    return withProductOverrides(baseProducts, { requireExistingSources: true })
  } catch (error) {
    console.error('Error searching products:', error)
    return []
  }
}

/**
 * Check if a variant is in stock by fetching the product and checking inventory
 * Returns { inStock: boolean, variant: MedusaProductVariant | null }
 */
export async function checkVariantStock(variantId: string): Promise<{
  inStock: boolean
  variant: MedusaProductVariant | null
  product: MedusaProduct | null
}> {
  try {
    // Fetch products with this variant ID
    const response = await medusaClient.get<{ products: MedusaProduct[] }>(
      '/store/products',
      {
        query: {
          variants: { id: [variantId] },
          fields: "*variants,*variants.prices,*variants.options,+variants.inventory_quantity,*options,*options.values",
          ...(OMNICART_SALES_CHANNEL_ID ? { sales_channel_id: [OMNICART_SALES_CHANNEL_ID] } : {})
        },
        headers: {
          'x-publishable-api-key': OMNICART_PUBLISHABLE_KEY,
        },
        cache: "no-store",
      }
    )

    const product = response.products?.[0]
    if (!product) {
      return { inStock: false, variant: null, product: null }
    }

    const variant = product.variants?.find(v => v.id === variantId)
    if (!variant) {
      return { inStock: false, variant: null, product }
    }

    // Check stock - only mark as out of stock if explicitly 0
    // If inventory_quantity is null/undefined, assume in stock (API may not expose it)
    let inStock = true
    if (variant.manage_inventory) {
      if (typeof variant.inventory_quantity === 'number' && variant.inventory_quantity <= 0) {
        inStock = false
      }
    }

    return { inStock, variant, product }
  } catch (error) {
    console.error('Error checking variant stock:', error)
    // Return as IN stock on error (optimistic - don't block checkout on API errors)
    return { inStock: true, variant: null, product: null }
  }
}

/**
 * Check stock for multiple variants at once
 */
export async function checkMultipleVariantsStock(variantIds: string[]): Promise<Map<string, {
  inStock: boolean
  variant: MedusaProductVariant | null
  productTitle?: string
}>> {
  const results = new Map<string, { inStock: boolean; variant: MedusaProductVariant | null; productTitle?: string }>()

  if (variantIds.length === 0) {
    return results
  }

  try {
    // Fetch all products with these variant IDs
    const response = await medusaClient.get<{ products: MedusaProduct[] }>(
      '/store/products',
      {
        query: {
          variants: { id: variantIds },
          fields: "*variants,*variants.prices,*variants.options,+variants.inventory_quantity,*options,*options.values",
          ...(OMNICART_SALES_CHANNEL_ID ? { sales_channel_id: [OMNICART_SALES_CHANNEL_ID] } : {}),
          limit: 100
        },
        headers: {
          'x-publishable-api-key': OMNICART_PUBLISHABLE_KEY,
        },
        cache: "no-store",
      }
    )

    const products = response.products ?? []

    // Build a map of variant ID to variant data
    for (const product of products) {
      for (const variant of product.variants || []) {
        if (variantIds.includes(variant.id)) {
          let inStock = true
          if (variant.manage_inventory) {
            // Only mark as out of stock if inventory_quantity is explicitly 0
            // If inventory_quantity is null/undefined, the API may not expose it
            // so we assume in stock (optimistic) to avoid false positives
            if (typeof variant.inventory_quantity === 'number' && variant.inventory_quantity <= 0) {
              inStock = false
            }
          }
          results.set(variant.id, { inStock, variant, productTitle: product.title })
        }
      }
    }

    // Mark any variant IDs not found as IN stock (optimistic)
    // Since the Store API may not return all variants, we assume they're available
    for (const variantId of variantIds) {
      if (!results.has(variantId)) {
        results.set(variantId, { inStock: true, variant: null })
      }
    }

    return results
  } catch (error) {
    console.error('Error checking multiple variants stock:', error)
    // Return all as IN stock on error (optimistic - don't block checkout on API errors)
    for (const variantId of variantIds) {
      results.set(variantId, { inStock: true, variant: null })
    }
    return results
  }
}
