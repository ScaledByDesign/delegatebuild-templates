// Using direct API client for CORS-free API access
import { medusaClient } from '../../lib/medusa-client';
import { OMNICART_PUBLISHABLE_KEY, OMNICART_SALES_CHANNEL_ID } from '@/lib/omnicart-config';

export interface MedusaCollection {
  id: string
  title: string
  handle: string
  metadata?: Record<string, any>
  created_at: string
  updated_at: string
  products?: {
    id: string
    title: string
    handle: string
    thumbnail?: string
  }[]
}

export interface CollectionsResponse {
  collections: MedusaCollection[]
  count: number
  offset: number
  limit: number
}

/**
 * List all collections
 */
export const listCollections = async (params?: {
  limit?: number
  offset?: number
  fields?: string
}): Promise<{ collections: MedusaCollection[]; count: number }> => {
  try {
    const response = await medusaClient.get<{ collections: MedusaCollection[]; count: number }>(
      `/store/collections`,
      {
        query: {
          limit: params?.limit || 50,
          offset: params?.offset || 0,
          fields: params?.fields || "*products",
        },
        headers: {
          'x-publishable-api-key': OMNICART_PUBLISHABLE_KEY,
        },
        cache: "no-store",
      }
    )

    return {
      collections: response.collections,
      count: response.count || 0
    }
  } catch (error) {
    console.error('Error fetching collections:', error)
    return { collections: [], count: 0 }
  }
}

/**
 * Get collection by ID
 */
export const getCollection = async (collectionId: string): Promise<MedusaCollection | null> => {
  try {
    const response = await medusaClient.get<{ collection: MedusaCollection }>(
      `/store/collections/${collectionId}`,
      {
        query: {
          fields: "*products,*products.variants,*products.images"
        },
        headers: {
          'x-publishable-api-key': OMNICART_PUBLISHABLE_KEY,
        },
        cache: "no-store",
      }
    )

    return response.collection
  } catch (error) {
    console.error('Error fetching collection:', error)
    return null
  }
}

/**
 * Get collection by handle with products filtered by sales channel
 */
export const getCollectionByHandle = async (handle: string): Promise<MedusaCollection | null> => {
  try {
    // First get the collection (include metadata for hero/copy)
    const { collections } = await listCollections({ fields: "id,title,handle,metadata,*products" })
    const collection = collections.find(c => c.handle === handle)

    if (!collection) {
      return null
    }

    // Then get products for this collection filtered by sales channel
    const response = await medusaClient.get<{ products: any[] }>(
      `/store/products`,
      {
        query: {
          fields: "*variants,*variants.prices,*variants.options,+variants.inventory_quantity,*options,*options.values,*collection,*tags,*images",
          collection_id: [collection.id],
          ...(OMNICART_SALES_CHANNEL_ID ? { sales_channel_id: [OMNICART_SALES_CHANNEL_ID] } : {})
        },
        headers: {
          'x-publishable-api-key': OMNICART_PUBLISHABLE_KEY,
        },
        cache: "no-store",
      }
    )

    return {
      ...collection,
      products: response.products || []
    }
  } catch (error) {
    console.error('Error fetching collection by handle:', error)
    return null
  }
}

/**
 * Get featured collections (first 6 collections)
 */
export const getFeaturedCollections = async (): Promise<MedusaCollection[]> => {
  try {
    const { collections } = await listCollections({ limit: 6 })
    return collections
  } catch (error) {
    console.error('Error fetching featured collections:', error)
    return []
  }
}
