/**
 * Image URL transformation utilities
 *
 * Transforms external CDN URLs to local paths for assets stored in /public/
 *
 * Supported URL patterns:
 * - https://vnsh.com/cdn/shop/files/... → /cdn/shop/files/...
 * - https://cdn.shopify.com/s/files/1/0670/4948/8684/files/... → /images/products/...
 * - https://cdn.shopify.com/s/files/1/0670/4948/8684/products/... → /images/products/...
 *
 * Local files have query strings (like ?v=123&width=500) stripped from filenames.
 * The extension is preserved from the original path before the query string.
 * Example: file.webp?v=123 → /images/products/file.webp
 */

// Shopify store ID pattern from CDN URLs
const SHOPIFY_STORE_PATH = '/s/files/1/0670/4948/8684/'

// Cache bust version - increment to bypass Cloudflare cache
const CACHE_BUST_VERSION = 'v1'

/**
 * Determines if a URL is an external CDN URL that should be transformed
 */
export function isExternalCdnUrl(url: string): boolean {
  if (!url) return false
  try {
    const parsed = new URL(url)
    return (
      parsed.hostname === 'vnsh.com' ||
      parsed.hostname === 'cdn.shopify.com' ||
      parsed.hostname.includes('cdn.shopify.com')
    )
  } catch {
    return false
  }
}

/**
 * Transforms an external CDN URL to a local path
 *
 * @param url - The external CDN URL
 * @returns The local path or the original URL if not transformable
 */
export function transformCdnUrl(url: string): string {
  if (!url) return url

  try {
    const parsed = new URL(url)

    // Handle vnsh.com/cdn URLs - keep as /cdn/ path with cache bust
    if (parsed.hostname === 'vnsh.com' && parsed.pathname.startsWith('/cdn/')) {
      // Strip query string and return just the path with cache bust
      const cleanPath = stripQueryFromPath(parsed.pathname)
      return `${cleanPath}?${CACHE_BUST_VERSION}`
    }

    // Handle cdn.shopify.com URLs - transform to /images/products/
    if (parsed.hostname === 'cdn.shopify.com' || parsed.hostname.includes('cdn.shopify.com')) {
      // Extract the file path after the store ID
      const storePathIndex = parsed.pathname.indexOf(SHOPIFY_STORE_PATH)
      if (storePathIndex !== -1) {
        const filePath = parsed.pathname.substring(storePathIndex + SHOPIFY_STORE_PATH.length)
        // Remove 'files/' or 'products/' prefix if present and use /images/products/
        let filename = filePath
        if (filePath.startsWith('files/')) {
          filename = filePath.substring(6)
        } else if (filePath.startsWith('products/')) {
          filename = filePath.substring(9)
        }
        const localPath = `/images/products/${filename}`
        return stripQueryFromPath(localPath)
      }
    }

    // Not a recognized CDN URL, return as-is
    return url
  } catch {
    // Not a valid URL, return as-is
    return url
  }
}

/**
 * Strips query strings from a path and ensures proper file extension
 *
 * Local files have query parameters stripped, keeping only the base filename
 * with its original extension.
 */
function stripQueryFromPath(path: string): string {
  // Remove query string if present (shouldn't be in pathname, but just in case)
  const cleanPath = path.split('?')[0]

  // Ensure the path has a valid extension
  // If not, this might indicate a malformed URL
  const hasExtension = /\.(webp|png|jpg|jpeg|gif|svg|ico)$/i.test(cleanPath)

  return hasExtension ? cleanPath : cleanPath
}

/**
 * Transforms an array of image URLs, converting external CDN URLs to local paths
 */
export function transformImageUrls(urls: string[]): string[] {
  return urls.map(transformCdnUrl)
}

/**
 * Checks if a local asset file exists for the given path
 * This is a helper for debugging - actual file existence is determined at runtime
 */
export function getLocalAssetPath(cdnUrl: string): string | null {
  const transformed = transformCdnUrl(cdnUrl)
  // If transformation happened, it's a local path
  if (transformed !== cdnUrl && transformed.startsWith('/cdn/')) {
    return transformed
  }
  return null
}

