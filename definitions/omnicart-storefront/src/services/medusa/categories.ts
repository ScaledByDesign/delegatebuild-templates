import { medusaClient } from "../../lib/medusa-client"
import medusaError from "../../lib/util/medusa-error"

export interface MedusaCategory {
  id: string
  name: string
  handle: string
  description?: string
  is_active: boolean
  is_internal: boolean
  rank: number
  parent_category_id?: string
  parent_category?: MedusaCategory
  category_children?: MedusaCategory[]
  products?: {
    id: string
    title: string
    handle: string
    thumbnail?: string
  }[]
  metadata?: Record<string, any>
  created_at: string
  updated_at: string
}

export interface CategoriesResponse {
  product_categories: MedusaCategory[]
  count: number
  offset: number
  limit: number
}

/**
 * List all categories
 */
export const listCategories = async (params?: {
  limit?: number
  offset?: number
  parent_category_id?: string
  include_descendants_tree?: boolean
}): Promise<{ categories: MedusaCategory[]; count: number }> => {
  try {
    const response = await medusaClient.fetch<CategoriesResponse>(
      "/store/product-categories",
      {
        method: "GET",
        query: {
          limit: params?.limit || 100,
          offset: params?.offset || 0,
          parent_category_id: params?.parent_category_id,
          include_descendants_tree: params?.include_descendants_tree,
          fields: "*category_children,*products,*parent_category",
        },
        cache: "force-cache",
      }
    )

    return {
      categories: response.product_categories,
      count: response.count || 0
    }
  } catch (error) {
    console.error('Error fetching categories:', error)
    return { categories: [], count: 0 }
  }
}

/**
 * Get category by ID
 */
export const getCategory = async (categoryId: string): Promise<MedusaCategory | null> => {
  try {
    const response = await medusaClient.fetch<{ product_category: MedusaCategory }>(
      `/store/product-categories/${categoryId}`,
      {
        method: "GET",
        query: {
          fields: "*category_children,*products,*products.variants,*products.images,*parent_category",
        },
        cache: "force-cache",
      }
    )

    return response.product_category
  } catch (error) {
    console.error('Error fetching category:', error)
    return null
  }
}

/**
 * Get category by handle
 */
export const getCategoryByHandle = async (handle: string): Promise<MedusaCategory | null> => {
  try {
    const { categories } = await listCategories()
    
    const category = categories.find(category => category.handle === handle)
    return category || null
  } catch (error) {
    console.error('Error fetching category by handle:', error)
    return null
  }
}

/**
 * Get root categories (categories without parent)
 */
export const getRootCategories = async (): Promise<MedusaCategory[]> => {
  try {
    const { categories } = await listCategories()
    return categories.filter(category => !category.parent_category_id)
  } catch (error) {
    console.error('Error fetching root categories:', error)
    return []
  }
}

/**
 * Get category tree (hierarchical structure)
 */
export const getCategoryTree = async (): Promise<MedusaCategory[]> => {
  try {
    const { categories } = await listCategories({ include_descendants_tree: true })
    return categories.filter(category => !category.parent_category_id)
  } catch (error) {
    console.error('Error fetching category tree:', error)
    return []
  }
}
