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
 * Base URL for OmniCart/Medusa product assets that were stored WITHOUT a fully
 * qualified host. Medusa sometimes serializes an image as `undefined/<file>`
 * (or a bare `<file>`) when the file-module base URL is unset; the actual file
 * lives in the connected Supabase public-assets bucket. We repair those URLs
 * here so images pull straight from the product record.
 *
 * Resolution order:
 *   1. window.__PUBLIC_ENV__.OMNICART_ASSET_BASE_URL / VITE_OMNICART_ASSET_BASE_URL
 *   2. Supabase project URL (SUPABASE_URL) + /storage/v1/object/public/public-assets
 *   3. Known default public-assets bucket
 */
function readEnv(...keys: string[]): string | undefined {
  const bag: Record<string, string | undefined> =
    (typeof window !== 'undefined' && (window as any).__PUBLIC_ENV__) || {}
  for (const k of keys) {
    const v = bag[k] ?? (typeof process !== 'undefined' ? process.env?.[k] : undefined)
    if (v) return v
  }
  return undefined
}

function resolveAssetBaseUrl(): string {
  const explicit = readEnv('OMNICART_ASSET_BASE_URL', 'VITE_OMNICART_ASSET_BASE_URL')
  if (explicit) return explicit.replace(/\/+$/, '')

  const supabaseUrl = readEnv('SUPABASE_URL', 'VITE_SUPABASE_URL')
  if (supabaseUrl) {
    return `${supabaseUrl.replace(/\/+$/, '')}/storage/v1/object/public/public-assets`
  }

  // Known default (OmniCart Demo Sandbox / VNSH public-assets bucket).
  return 'https://gxpiybfbsedbvejieaxd.supabase.co/storage/v1/object/public/public-assets'
}

const IMAGE_EXT_RE = /\.(webp|png|jpe?g|gif|svg|avif|ico)(\?.*)?$/i

/**
 * Repairs Medusa-orphaned image URLs:
 *   - "undefined/foo.webp"  → <assetBase>/foo.webp
 *   - "null/foo.webp"       → <assetBase>/foo.webp
 *   - "foo.webp" (bare)     → <assetBase>/foo.webp
 * Anything already absolute (http/https) or root-absolute (/path) is left alone.
 */
export function repairOrphanedAssetUrl(url: string): string {
  if (!url) return url
  let candidate = url.trim()

  const orphanPrefix = /^(undefined|null)\/+/i
  if (orphanPrefix.test(candidate)) {
    candidate = candidate.replace(orphanPrefix, '')
  } else if (/^https?:\/\//i.test(candidate) || candidate.startsWith('/')) {
    // Already a usable URL/path.
    return url
  }

  // At this point `candidate` is a bare filename/relative key. Only rewrite if
  // it looks like an image file, otherwise leave the original untouched.
  if (!IMAGE_EXT_RE.test(candidate)) return url

  const base = resolveAssetBaseUrl()
  const key = candidate.replace(/^\/+/, '')
  return `${base}/${key}`
}

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

  // First, repair Medusa-orphaned/bare asset URLs so product images resolve.
  const repaired = repairOrphanedAssetUrl(url)
  if (repaired !== url) {
    url = repaired
  }

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

