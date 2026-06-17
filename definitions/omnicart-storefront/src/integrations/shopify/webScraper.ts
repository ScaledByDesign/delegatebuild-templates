// @ts-nocheck
import type { ShopifyOmnicartConfig } from "./config.ts"

export interface ScrapedProduct {
  id: string
  title: string
  handle: string
  description: string
  vendor: string
  productType: string
  tags: string[]
  images: Array<{
    id: string
    url: string
    altText?: string
  }>
  variants: Array<{
    id: string
    title: string
    price: number
    compareAtPrice?: number
    sku?: string
    available: boolean
    inventoryQuantity?: number
    options: Record<string, string>
  }>
  options: Array<{
    name: string
    values: string[]
  }>
  collections: Array<{
    id: string
    title: string
    handle: string
  }>
  marketingContent?: {
    features?: Array<{
      title: string
      description: string
      image?: string
    }>
    heroBadges?: string[]
    valueProps?: Array<{
      title: string
      description: string
    }>
  }
  createdAt: string
  updatedAt: string
}

export interface ScrapedCollection {
  id: string
  title: string
  handle: string
  description?: string
  products: ScrapedProduct[]
}

export class ShopifyWebScraper {
  private baseUrl: string
  private timeout: number

  constructor(config: ShopifyOmnicartConfig) {
    this.baseUrl = `https://${config.shopifyDomain}`
    this.timeout = config.requestTimeoutMs
  }

  /**
   * Scrape all products from a collection
   */
  async scrapeCollection(collectionHandle: string): Promise<ScrapedCollection> {
    const url = `${this.baseUrl}/collections/${collectionHandle}/products.json`
    
    try {
      const response = await this.fetchWithTimeout(url)
      const data = await response.json()
      
      const collectionInfo = await this.scrapeCollectionInfo(collectionHandle)
      const collectionMeta = {
        id: collectionInfo.id,
        title: collectionInfo.title,
        handle: collectionHandle,
      }

      const products: ScrapedProduct[] = data.products.map((product: any) => {
        const transformed = this.transformShopifyProduct(product)

        const hasCollection = transformed.collections.some(
          (existing) => existing.handle.toLowerCase() === collectionMeta.handle.toLowerCase()
        )

        if (!hasCollection) {
          transformed.collections = [...transformed.collections, collectionMeta]
        }

        return transformed
      })

      return {
        id: collectionMeta.id,
        title: collectionMeta.title,
        handle: collectionMeta.handle,
        description: collectionInfo.description,
        products,
      }
    } catch (error) {
      console.error(`Failed to scrape collection ${collectionHandle}:`, error)
      throw error
    }
  }

  /**
   * Scrape a single product by handle
   */
  async scrapeProduct(productHandle: string): Promise<ScrapedProduct> {
    const url = `${this.baseUrl}/products/${productHandle}.json`

    try {
      const response = await this.fetchWithTimeout(url)
      const data = await response.json()

      const product = this.transformShopifyProduct(data.product)

      // Enrich with marketing content from HTML page
      try {
        const marketingContent = await this.scrapeProductMarketingContent(productHandle)
        if (marketingContent) {
          product.marketingContent = marketingContent
        }
      } catch (error) {
        console.warn(`Could not scrape marketing content for ${productHandle}:`, error)
      }

      return product
    } catch (error) {
      console.error(`Failed to scrape product ${productHandle}:`, error)
      throw error
    }
  }

  /**
   * Scrape marketing content from product HTML page
   */
  private async scrapeProductMarketingContent(productHandle: string): Promise<{
    features?: Array<{ title: string; description: string; image?: string }>
    heroBadges?: string[]
    valueProps?: Array<{ title: string; description: string }>
  } | null> {
    try {
      const url = `${this.baseUrl}/products/${productHandle}`
      const response = await this.fetchWithTimeout(url)
      const html = await response.text()

      const features: Array<{ title: string; description: string; image?: string }> = []

      // Find all h2 titles with image-with-text__heading class
      const titleRegex = /<h2[^>]*class="[^"]*image-with-text__heading[^"]*"[^>]*>\s*([^<]+)\s*<\/h2>/gi
      const titleMatches = []
      let titleMatch

      while ((titleMatch = titleRegex.exec(html)) !== null) {
        titleMatches.push({
          title: titleMatch[1].trim(),
          index: titleMatch.index
        })
      }

      // For each title, extract nearby content
      for (let i = 0; i < titleMatches.length; i++) {
        const { title, index } = titleMatches[i]

        // Get a large section around this title (2000 chars before and after)
        const start = Math.max(0, index - 2000)
        const end = Math.min(html.length, index + 5000)
        const section = html.substring(start, end)

        // Extract description - look for the text content in a div with rte class
        const textDivMatch = section.match(/<div[^>]*class="[^"]*rte[^"]*"[^>]*>([\s\S]*?)<\/div>/i)
        let description = ''
        if (textDivMatch) {
          // Clean up HTML tags but preserve text content and emoji
          description = textDivMatch[1]
            .replace(/<span[^>]*class="metafield-multi_line_text_field"[^>]*>/gi, '')
            .replace(/<\/span>/gi, '')
            .replace(/<p[^>]*>/gi, '')
            .replace(/<\/p>/gi, ' ')
            .replace(/<[^>]+>/g, '') // Remove any remaining HTML tags
            .replace(/&nbsp;/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
        }

        // Extract image URL from srcset - look backwards from title
        const beforeSection = html.substring(Math.max(0, index - 3000), index)
        const imgMatch = beforeSection.match(/<img[^>]*srcset="([^"]+)"/i)
        let image: string | undefined
        if (imgMatch) {
          const srcset = imgMatch[1]
          // Get the first URL from srcset
          const firstUrl = srcset.split(',')[0].trim().split(' ')[0]
          image = firstUrl.startsWith('//') ? `https:${firstUrl}` : firstUrl
          // Remove size suffix to get larger version
          image = image.replace(/_\d+x\.(jpg|png|webp)/i, '.$1')
        }

        if (title && description) {
          features.push({ title, description, image })
        }
      }

      return features.length > 0 ? { features } : null
    } catch (error) {
      console.warn(`Failed to scrape marketing content for ${productHandle}:`, error)
      return null
    }
  }

  /**
   * Get all available collections
   */
  async scrapeCollections(): Promise<Array<{ id: string; title: string; handle: string }>> {
    const url = `${this.baseUrl}/collections.json`
    
    try {
      const response = await this.fetchWithTimeout(url)
      const data = await response.json()
      
      return data.collections.map((collection: any) => ({
        id: collection.id.toString(),
        title: collection.title,
        handle: collection.handle,
      }))
    } catch (error) {
      console.error("Failed to scrape collections:", error)
      throw error
    }
  }

  /**
   * Scrape all products from the main products page
   */
  async scrapeAllProducts(enrichWithMarketing = true): Promise<ScrapedProduct[]> {
    const products: ScrapedProduct[] = []
    let page = 1
    let hasMore = true

    while (hasMore) {
      try {
        const url = `${this.baseUrl}/products.json?page=${page}&limit=250`
        const response = await this.fetchWithTimeout(url)
        const data = await response.json()

        if (!data.products || data.products.length === 0) {
          hasMore = false
          break
        }

        const pageProducts = data.products.map((product: any) =>
          this.transformShopifyProduct(product)
        )

        products.push(...pageProducts)
        page++

        // Rate limiting - wait 500ms between requests
        await new Promise(resolve => setTimeout(resolve, 500))
      } catch (error) {
        console.error(`Failed to scrape products page ${page}:`, error)
        hasMore = false
      }
    }

    // Enrich with marketing content if requested
    if (enrichWithMarketing) {
      console.log(`Enriching ${products.length} products with marketing content...`)
      for (let i = 0; i < products.length; i++) {
        const product = products[i]
        try {
          const marketingContent = await this.scrapeProductMarketingContent(product.handle)
          if (marketingContent) {
            product.marketingContent = marketingContent
          }
          // Rate limiting - wait 1s between HTML scrapes to avoid blocking
          await new Promise(resolve => setTimeout(resolve, 1000))
          if ((i + 1) % 10 === 0) {
            console.log(`  Enriched ${i + 1}/${products.length} products`)
          }
        } catch (error) {
          console.warn(`Could not enrich product ${product.handle}:`, error)
        }
      }
    }

    return products
  }

  /**
   * Get collection info from the collection page HTML
   */
  private async scrapeCollectionInfo(collectionHandle: string): Promise<{
    id: string
    title: string
    description?: string
  }> {
    try {
      const url = `${this.baseUrl}/collections/${collectionHandle}`
      const response = await this.fetchWithTimeout(url)
      const html = await response.text()

      // Extract collection data from the HTML
      // Look for JSON-LD structured data or meta tags
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
      const descriptionMatch = html.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"[^>]*>/i)
      
      // Try to extract collection ID from the page
      const collectionIdMatch = html.match(/collection['"]\s*:\s*['"]*(\d+)['"]/i) ||
                               html.match(/collection_id['"]\s*:\s*['"]*(\d+)['"]/i)

      return {
        id: collectionIdMatch?.[1] || `collection_${collectionHandle}`,
        title: titleMatch?.[1]?.replace(/ – .*$/, '') || collectionHandle,
        description: descriptionMatch?.[1] || undefined,
      }
    } catch (error) {
      console.warn(`Could not scrape collection info for ${collectionHandle}:`, error)
      return {
        id: `collection_${collectionHandle}`,
        title: collectionHandle,
      }
    }
  }

  /**
   * Transform Shopify product JSON to our format
   */
  private transformShopifyProduct(product: any): ScrapedProduct {
    return {
      id: product.id.toString(),
      title: product.title,
      handle: product.handle,
      description: product.body_html || "",
      vendor: product.vendor || "",
      productType: product.product_type || "",
      tags: Array.isArray(product.tags) ? product.tags :
            (product.tags ? product.tags.split(",").map((tag: string) => tag.trim()) : []),
      images: product.images.map((image: any, index: number) => ({
        id: image.id?.toString() || `img_${index}`,
        url: image.src,
        altText: image.alt || undefined,
      })),
      variants: product.variants.map((variant: any) => ({
        id: variant.id.toString(),
        title: variant.title,
        price: parseFloat(variant.price),
        compareAtPrice: variant.compare_at_price ? parseFloat(variant.compare_at_price) : undefined,
        sku: variant.sku || undefined,
        available: variant.available,
        inventoryQuantity: variant.inventory_quantity || 0,
        options: this.buildVariantOptions(variant, product.options),
      })),
      options: product.options.map((option: any) => ({
        name: option.name,
        values: option.values,
      })),
      collections: [], // Will be populated separately if needed
      createdAt: product.created_at,
      updatedAt: product.updated_at,
    }
  }

  /**
   * Build variant options mapping
   */
  private buildVariantOptions(variant: any, productOptions: any[]): Record<string, string> {
    const options: Record<string, string> = {}
    
    if (variant.option1 && productOptions[0]) {
      options[productOptions[0].name] = variant.option1
    }
    if (variant.option2 && productOptions[1]) {
      options[productOptions[1].name] = variant.option2
    }
    if (variant.option3 && productOptions[2]) {
      options[productOptions[2].name] = variant.option3
    }

    return options
  }

  /**
   * Fetch with timeout and error handling
   */
  private async fetchWithTimeout(url: string): Promise<Response> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; VNSHSyncBot/1.0)',
          'Accept': 'application/json, text/html',
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      return response
    } finally {
      clearTimeout(timeoutId)
    }
  }

  /**
   * Iterator for all products with pagination
   */
  async *iterateProducts(): AsyncGenerator<ScrapedProduct> {
    let page = 1
    let hasMore = true

    while (hasMore) {
      try {
        const url = `${this.baseUrl}/products.json?page=${page}&limit=50`
        const response = await this.fetchWithTimeout(url)
        const data = await response.json()

        if (!data.products || data.products.length === 0) {
          hasMore = false
          break
        }

        for (const product of data.products) {
          yield this.transformShopifyProduct(product)
        }

        page++
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 500))
      } catch (error) {
        console.error(`Failed to fetch products page ${page}:`, error)
        hasMore = false
      }
    }
  }
}
