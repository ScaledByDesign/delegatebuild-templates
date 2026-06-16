import React, { useEffect, useMemo, useState } from "react"
import { useParams, Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { getProducts, MedusaProduct } from "@/services/medusa/products"
import { getCollectionByHandle } from "@/services/medusa/collections"
import { Loader2, Package, ArrowLeft } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import Navbar from "@/components/Navbar"
import Footer from "@/components/Footer"
import CollectionProductCard from "@/components/CollectionProductCard"
import CollectionProductCardSkeleton from "@/components/CollectionProductCardSkeleton"
import VariantSelector from "@/components/VariantSelector"
import ProductViewToggle from "@/components/ProductViewToggle"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { getCollectionContent } from "@/lib/content/collectionContent"
import { COLLECTION_ORDERING } from "@/lib/content/collectionOrdering"
import { formatPrice, isVariantInStock, findVariantByOptions, getAvailableOptionValues } from "@/lib/util/product-utils"
import { useCart } from "@/hooks/useCart"
import { useProductViewMode } from "@/hooks/useProductViewMode"
import { useIsMobile } from "@/hooks/use-mobile"
import JsonLd from "@/components/JsonLd"
import { generateCollectionJsonLd, generateBreadcrumbJsonLd } from "@/lib/seo/structuredData"

/** Separate component so hooks run unconditionally (not after early returns) */
function CollectionSeo({ title, description, image, handle, products }: {
  title: string
  description?: string
  image?: string
  handle: string
  products: Array<{ title: string; handle: string; thumbnail?: string | null }>
}) {
  useEffect(() => {
    const collectionUrl = `https://vnsh.com/collections/${handle}`
    document.title = `${title} - VNSH`

    const setMeta = (attr: string, key: string, content: string) => {
      let el = document.querySelector(`meta[${attr}="${key}"]`)
      if (!el) {
        el = document.createElement('meta')
        el.setAttribute(attr, key)
        document.head.appendChild(el)
      }
      el.setAttribute('content', content)
    }

    setMeta('name', 'description', description || `Shop ${title} at VNSH Holster.`)
    setMeta('property', 'og:title', `${title} - VNSH`)
    setMeta('property', 'og:description', description || `Shop ${title} at VNSH Holster.`)
    setMeta('property', 'og:type', 'website')
    setMeta('property', 'og:url', collectionUrl)
    if (image) {
      setMeta('property', 'og:image', image.startsWith('http') ? image : `https://vnsh.com${image}`)
    }

    let canonical = document.querySelector('link[rel="canonical"]')
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.setAttribute('rel', 'canonical')
      document.head.appendChild(canonical)
    }
    canonical.setAttribute('href', collectionUrl)
  }, [title, description, image, handle])

  const collectionJsonLd = useMemo(
    () => generateCollectionJsonLd(title, handle, products.map((p, i) => ({ title: p.title, handle: p.handle, thumbnail: p.thumbnail, position: i }))),
    [title, handle, products]
  )

  const breadcrumbJsonLd = useMemo(
    () => generateBreadcrumbJsonLd([
      { name: 'Home', url: 'https://vnsh.com/' },
      { name: 'Collections', url: 'https://vnsh.com/collections' },
      { name: title, url: `https://vnsh.com/collections/${handle}` },
    ]),
    [title, handle]
  )

  return (
    <>
      <JsonLd data={collectionJsonLd} id="collection" />
      <JsonLd data={breadcrumbJsonLd} id="breadcrumb" />
    </>
  )
}

interface CollectionPageData {
  id: string
  title: string
  handle: string
  metadata?: Record<string, unknown>
  products: MedusaProduct[]
}

type SortOption =
  | "featured"
  | "price-asc"
  | "price-desc"
  | "title-asc"
  | "title-desc"
  | "created-desc"
  | "created-asc"

type CollectionProductModel = {
  id: string
  handle: string
  title: string
  image?: string
  priceLabel: string
  compareAtLabel?: string
  isOnSale: boolean
  badge?: string
  isInStock: boolean
  minPrice: number
  maxPrice: number
  position: number
  createdAt: number
  featuredRank: number
  defaultVariantId?: string
  variantCount: number
}

const SORT_OPTIONS: Array<{ value: SortOption; label: string }> = [
  { value: "featured", label: "Featured" },
  { value: "price-asc", label: "Price, low to high" },
  { value: "price-desc", label: "Price, high to low" },
  { value: "title-asc", label: "Alphabetically, A-Z" },
  { value: "title-desc", label: "Alphabetically, Z-A" },
  { value: "created-desc", label: "Date, new to old" },
  { value: "created-asc", label: "Date, old to new" },
]

type HeroMetadata = {
  title?: string
  subtitle?: string
  description?: string
  image?: string
}

const createCollectionProductModel = (
  product: MedusaProduct,
  position: number,
  featuredRank?: number
): CollectionProductModel => {
  const variants = product.variants || []
  const prices = variants
    .map((variant) => variant.prices?.[0]?.amount)
    .filter((amount): amount is number => typeof amount === "number")

  const currency =
    variants[0]?.prices?.[0]?.currency_code ||
    variants[0]?.calculated_price?.currency_code ||
    "USD"

  const minPrice = prices.length ? Math.min(...prices) : 0
  const maxPrice = prices.length ? Math.max(...prices) : 0
  const priceLabel = minPrice === maxPrice
    ? formatPrice(minPrice, currency)
    : `From ${formatPrice(minPrice, currency)}`

  const compareAtPrices = variants
    .map((variant) => variant.calculated_price?.original_amount)
    .filter((amount): amount is number => typeof amount === "number" && amount > minPrice)

  const compareAtMin = compareAtPrices.length ? Math.min(...compareAtPrices) : null
  const compareAtLabel = typeof compareAtMin === "number" ? formatPrice(compareAtMin, currency) : undefined
  const isOnSale = typeof compareAtMin === "number" ? minPrice < compareAtMin : false

  const tags = (product.tags || []).map((tag) => tag.value?.toLowerCase() ?? "")
  let badge: string | undefined
  if (tags.some((tag) => tag.includes("new"))) {
    badge = "New"
  } else if (tags.some((tag) => tag.includes("bestseller") || tag.includes("best"))) {
    badge = "Best Seller"
  } else if (tags.some((tag) => tag.includes("bundle"))) {
    badge = "Bundle"
  }

  const isInStock = variants.some((variant) => isVariantInStock(variant))
  const defaultVariant = variants.find((variant) => isVariantInStock(variant)) || variants[0]

  return {
    id: product.id,
    handle: product.handle,
    title: product.title,
    image: product.thumbnail || product.images?.[0]?.url || undefined,
    priceLabel,
    compareAtLabel,
    isOnSale,
    badge,
    isInStock,
    minPrice,
    maxPrice,
    position,
    createdAt: new Date(product.created_at || Date.now()).getTime(),
    featuredRank: typeof featuredRank === "number" ? featuredRank : position,
    defaultVariantId: defaultVariant?.id,
    variantCount: variants.length,
  }
}

const CollectionDetail: React.FC = () => {
  const { handle } = useParams<{ handle: string }>()
  const normalizedHandle = (handle ?? "").toLowerCase()
  const isAllProducts = normalizedHandle === "products" || normalizedHandle === "all"

  // Map local handles to Shopify collection handles
  const getShopifyHandle = (localHandle: string): string => {
    const handleMap: Record<string, string> = {
      'apparel-gifts': 'vnsh-holsters-apparel-and-gifts',
      // Add more mappings as needed
    }
    return handleMap[localHandle] || localHandle
  }

  const { data, isLoading, error } = useQuery<CollectionPageData | null>({
    queryKey: ["collection-detail", normalizedHandle],
    enabled: Boolean(normalizedHandle),
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (!normalizedHandle) return null

      if (isAllProducts) {
        // Page through the full catalog (the default getProducts() call caps at 50,
        // which can hide featured products and break the ordering below).
        const fetchAllProducts = async (): Promise<MedusaProduct[]> => {
          const pageSize = 100
          const all: MedusaProduct[] = []
          let offset = 0
          // Safety cap so a misbehaving API can't loop forever.
          for (let page = 0; page < 50; page++) {
            const { products } = await getProducts({ limit: pageSize, offset })
            all.push(...products)
            if (products.length < pageSize) break
            offset += pageSize
          }
          return all
        }

        // The catalog products are all members of the "All" collection, which is the
        // collection the storefront Admin "Product Order" tool (src/pages/Admin.tsx)
        // actually edits — it lists a collection's member products and saves their order
        // to that collection's metadata.product_order. The "Products" collection (handle
        // "products") is an empty shell with no member products, so reading its
        // product_order showed a stale order that never reflected those edits. Read the
        // ordering from "all" — where the products live and where the edits land. (If
        // "all" ever goes missing, productModels falls back to COLLECTION_ORDERING.)
        const [products, collection] = await Promise.all([
          fetchAllProducts(),
          getCollectionByHandle("all"),
        ])

        return {
          id: collection?.id ?? "all-products",
          title: "Products",
          handle: normalizedHandle,
          metadata: collection?.metadata,
          products,
        }
      }

      const shopifyHandle = getShopifyHandle(normalizedHandle)
      const collection = await getCollectionByHandle(shopifyHandle)
      if (!collection) return null

      return {
        id: collection.id,
        title: collection.title,
        handle: collection.handle,
        metadata: collection.metadata,
        products: (collection.products ?? []) as MedusaProduct[],
      }
    },
  })

  const derivedHandle = data?.handle ?? normalizedHandle
  const collectionContent = useMemo(() => getCollectionContent(derivedHandle), [derivedHandle])

  const productById = useMemo(() => {
    const map = new Map<string, MedusaProduct>()
    ;(data?.products ?? []).forEach((product) => {
      if (product?.id) {
        map.set(product.id, product)
      }
    })
    return map
  }, [data?.products])

  const productModels = useMemo(() => {
    const source = (data?.products ?? []) as MedusaProduct[]
    // Prefer dynamic order from collection metadata, fall back to hardcoded ordering
    const metadataOrder = (data?.metadata as Record<string, any>)?.product_order as string[] | undefined
    const order = (metadataOrder && metadataOrder.length > 0)
      ? metadataOrder
      : (COLLECTION_ORDERING[derivedHandle] || [])
    const orderMap = new Map(order.map((handle, index) => [handle, index]))
    return source.map((product, index) => {
      const featuredRank = orderMap.has(product.handle)
        ? (orderMap.get(product.handle) as number)
        : order.length + index
      return createCollectionProductModel(product, index, featuredRank)
    })
  }, [data?.products, data?.metadata, derivedHandle])

  const [sortOption, setSortOption] = useState<SortOption>("featured")
  const [selectedAvailability, setSelectedAvailability] = useState<string[]>([])
  const [selectedSizes, setSelectedSizes] = useState<string[]>([])
  const [priceRange, setPriceRange] = useState<{ from: string; to: string }>({ from: "", to: "" })

  const { addItem, isLoading: isCartLoading } = useCart()
  const { viewMode, toggleViewMode } = useProductViewMode()
  const isMobile = useIsMobile()
  const [quickAddProductId, setQuickAddProductId] = useState<string | null>(null)
  const [quickAddOptions, setQuickAddOptions] = useState<Record<string, string>>({})
  const [quickAddError, setQuickAddError] = useState<string | null>(null)
  const [isQuickAddSubmitting, setIsQuickAddSubmitting] = useState(false)

  const quickAddProduct = useMemo(() => {
    if (!quickAddProductId) return null
    return productById.get(quickAddProductId) ?? null
  }, [productById, quickAddProductId])

  useEffect(() => {
    if (!quickAddProduct) {
      setQuickAddOptions({})
      setQuickAddError(null)
      setIsQuickAddSubmitting(false)
      return
    }

    const initialSelections: Record<string, string> = {}
    const preferredVariant = quickAddProduct.variants?.find((variant) => isVariantInStock(variant))
      || quickAddProduct.variants?.[0]

    preferredVariant?.options?.forEach((opt) => {
      if (opt.option_id && opt.value) {
        initialSelections[opt.option_id] = opt.value
      }
    })

    quickAddProduct.options?.forEach((option) => {
      if (!initialSelections[option.id] && option.values?.length) {
        initialSelections[option.id] = option.values[0].value
      }
    })

    setQuickAddOptions(initialSelections)
    setQuickAddError(null)
    setIsQuickAddSubmitting(false)
  }, [quickAddProduct])

  const quickAddAvailableOptions = useMemo(() => {
    if (!quickAddProduct?.options?.length) return {}

    const map: Record<string, string[]> = {}
    quickAddProduct.options.forEach((option) => {
      const values = getAvailableOptionValues(quickAddProduct, option.id, quickAddOptions)
      if (values.length > 0) {
        map[option.id] = values
      } else if (option.values) {
        map[option.id] = option.values.map((value) => value.value)
      } else {
        map[option.id] = []
      }
    })
    return map
  }, [quickAddProduct, quickAddOptions])

  const quickAddSelectedVariant = useMemo(() => {
    if (!quickAddProduct) return undefined
    return findVariantByOptions(quickAddProduct, quickAddOptions) ?? quickAddProduct.variants?.[0]
  }, [quickAddProduct, quickAddOptions])

  const quickAddVariantAvailable = useMemo(() => {
    return isVariantInStock(quickAddSelectedVariant)
  }, [quickAddSelectedVariant])

  const quickAddPrice = useMemo(() => {
    if (!quickAddSelectedVariant) return null
    const amount = quickAddSelectedVariant.calculated_price?.calculated_amount
      ?? quickAddSelectedVariant.prices?.[0]?.amount
      ?? null
    if (typeof amount !== "number") return null
    const currency = quickAddSelectedVariant.calculated_price?.currency_code
      ?? quickAddSelectedVariant.prices?.[0]?.currency_code
      ?? "USD"
    return formatPrice(amount, currency)
  }, [quickAddSelectedVariant])

  const handleQuickAddRequest = async (
    productId: string,
    defaultVariantId?: string,
    variantCount?: number
  ) => {
    const targetProduct = productById.get(productId)
    if (!targetProduct) return

    if (variantCount !== undefined && variantCount <= 1 && defaultVariantId) {
      const directVariant = targetProduct.variants?.find((variant) => variant.id === defaultVariantId)
        ?? targetProduct.variants?.[0]

      if (directVariant && isVariantInStock(directVariant)) {
        try {
          setIsQuickAddSubmitting(true)
          await addItem(directVariant.id, 1)
          return
        } catch (error) {
          console.error("Quick add failed", error)
          setQuickAddError("Unable to add to cart. Please try again.")
          setQuickAddProductId(productId)
          return
        } finally {
          setIsQuickAddSubmitting(false)
        }
      }
    }

    setQuickAddProductId(productId)
  }

  const handleQuickAddOptionChange = (optionId: string, value: string) => {
    setQuickAddOptions((prev) => ({ ...prev, [optionId]: value }))
    setQuickAddError(null)
  }

  const handleQuickAddClose = () => {
    setQuickAddProductId(null)
  }

  const handleQuickAddSubmit = async () => {
    if (!quickAddProduct || !quickAddSelectedVariant) {
      setQuickAddError("Please select a variant before adding to cart.")
      return
    }

    if (!quickAddVariantAvailable) {
      setQuickAddError("This variant is currently out of stock.")
      return
    }

    try {
      setIsQuickAddSubmitting(true)
      await addItem(quickAddSelectedVariant.id, 1)
      setQuickAddProductId(null)
    } catch (error) {
      console.error("Quick add failed", error)
      setQuickAddError("Unable to add to cart. Please try again.")
    } finally {
      setIsQuickAddSubmitting(false)
    }
  }

  // Extract available sizes from all products
  const availableSizes = useMemo(() => {
    const sizeMap = new Map<string, number>()

    data?.products?.forEach((product) => {
      const sizeOption = product.options?.find(opt => opt.title.toLowerCase() === 'size')
      if (sizeOption) {
        sizeOption.values.forEach((value) => {
          const currentCount = sizeMap.get(value.value) || 0
          sizeMap.set(value.value, currentCount + 1)
        })
      }
    })

    return Array.from(sizeMap.entries())
      .map(([size, count]) => ({ size, count }))
      .sort((a, b) => {
        // Custom sort order for sizes
        const sizeOrder = ['XS', 'S', 'M', 'Medium', 'L', 'Large', 'XL', '2XL', '3XL', '4XL', '5XL']
        const aIndex = sizeOrder.indexOf(a.size)
        const bIndex = sizeOrder.indexOf(b.size)
        if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex
        if (aIndex !== -1) return -1
        if (bIndex !== -1) return 1
        return a.size.localeCompare(b.size)
      })
  }, [data?.products])

  // Get price range from products
  const priceInfo = useMemo(() => {
    const prices = productModels.map(p => p.minPrice).filter(p => p > 0)
    if (prices.length === 0) return { min: 0, max: 0 }
    return {
      min: Math.min(...prices),
      max: Math.max(...prices)
    }
  }, [productModels])

  const processedProducts = useMemo(() => {
    let next = [...productModels]

    // Filter by availability
    if (selectedAvailability.length > 0) {
      next = next.filter((product) => {
        if (selectedAvailability.includes('in-stock') && selectedAvailability.includes('out-of-stock')) {
          return true // Show all if both are selected
        }
        if (selectedAvailability.includes('in-stock')) {
          return product.isInStock
        }
        if (selectedAvailability.includes('out-of-stock')) {
          return !product.isInStock
        }
        return true
      })
    }

    // Filter by price range
    if (priceRange.from || priceRange.to) {
      const fromPrice = priceRange.from ? parseFloat(priceRange.from) : 0 // API sends prices in dollars
      const toPrice = priceRange.to ? parseFloat(priceRange.to) : Infinity // API sends prices in dollars

      next = next.filter((product) => {
        return product.minPrice >= fromPrice && product.minPrice <= toPrice
      })
    }

    // Filter by selected sizes
    if (selectedSizes.length > 0) {
      next = next.filter((productModel) => {
        const product = data?.products?.find(p => p.id === productModel.id)
        if (!product) return false

        const sizeOption = product.options?.find(opt => opt.title.toLowerCase() === 'size')
        if (!sizeOption) return false

        return sizeOption.values.some(value => selectedSizes.includes(value.value))
      })
    }

    switch (sortOption) {
      case "price-asc":
        next.sort((a, b) => a.minPrice - b.minPrice)
        break
      case "price-desc":
        next.sort((a, b) => b.minPrice - a.minPrice)
        break
      case "title-asc":
        next.sort((a, b) => a.title.localeCompare(b.title))
        break
      case "title-desc":
        next.sort((a, b) => b.title.localeCompare(a.title))
        break
      case "created-desc":
        next.sort((a, b) => b.createdAt - a.createdAt)
        break
      case "created-asc":
        next.sort((a, b) => a.createdAt - b.createdAt)
        break
      case "featured":
      default:
        next.sort((a, b) => a.featuredRank - b.featuredRank)
        break
    }

    return next
  }, [productModels, selectedAvailability, priceRange, selectedSizes, sortOption, data?.products])

  const productCount = processedProducts.length

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white">
        <Navbar />
        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Hero skeleton */}
          <div className="mb-8">
            <div className="h-8 w-48 bg-gray-200 animate-pulse rounded mb-2" />
            <div className="h-6 w-64 bg-gray-200 animate-pulse rounded" />
          </div>

          {/* Filter bar skeleton */}
          <div className="flex gap-4 mb-6">
            <div className="h-10 w-32 bg-gray-200 animate-pulse rounded" />
            <div className="h-10 w-32 bg-gray-200 animate-pulse rounded" />
          </div>

          {/* Product grid skeleton */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 sm:gap-6">
            {[...Array(6)].map((_, i) => (
              <CollectionProductCardSkeleton key={i} />
            ))}
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Package className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Collection not found</h2>
          <p className="text-gray-600 mb-4">The collection you're looking for doesn't exist.</p>
          <Link to="/collections">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Collections
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  const { title, metadata } = data

  const heroMetadata: HeroMetadata | undefined =
    metadata &&
    typeof metadata === "object" &&
    "hero" in metadata &&
    typeof (metadata as { hero?: unknown }).hero === "object"
      ? ((metadata as { hero?: unknown }).hero as HeroMetadata | undefined)
      : undefined

  const heroTitle = collectionContent.heroTitle || heroMetadata?.title || title
  const heroSubtitle = collectionContent.heroSubtitle || heroMetadata?.subtitle
  const heroDescription = collectionContent.heroDescription || heroMetadata?.description
  const heroImage = collectionContent.heroImage || heroMetadata?.image
  const heroBadge = collectionContent.heroBadge

  return (
    <div className="min-h-screen flex flex-col">
      <CollectionSeo
        title={heroTitle}
        description={heroDescription}
        image={heroImage}
        handle={derivedHandle}
        products={data.products ?? []}
      />
      <Navbar />
      <main className="flex-grow bg-white">

      {/* Main Content */}
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div>
          {/* Main Product Area */}
          <div>
            {/* Collection Header */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h1 className="text-2xl font-bold text-gray-900">{heroTitle}</h1>
              </div>

              {heroDescription && (
                <p className="text-gray-600 mb-4">{heroDescription}</p>
              )}
            </div>

            {/* Filters - matching original VNSH style - single horizontal line */}
            <div className="mb-6 py-4 border-b border-gray-200">
              <div className="flex flex-col gap-5">
                {/* Single horizontal line with all filters and sort */}
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className="uppercase"
                    style={{
                      fontSize: '14px',
                      fontWeight: 300,
                      letterSpacing: '0.4px',
                      color: 'rgba(18, 18, 18, 0.85)'
                    }}
                  >
                    Filter:
                  </span>

                  <Select value={selectedAvailability.length > 0 ? "filtered" : "all"} onValueChange={() => {}}>
                    <SelectTrigger
                      className="w-auto border-0 bg-transparent p-0 h-auto shadow-none hover:bg-transparent focus:ring-0"
                      style={{
                        fontSize: '14px',
                        fontWeight: 300,
                        fontFamily: 'URWDIN-Regular',
                        color: 'rgba(18, 18, 18, 0.75)',
                        letterSpacing: '0.4px',
                        lineHeight: '21px'
                      }}
                    >
                      <SelectValue>
                        {selectedAvailability.length > 0 ? `Availability (${selectedAvailability.length} selected)` : "Availability"}
                      </SelectValue>
                    </SelectTrigger>
                      <SelectContent className="w-80">
                        <div className="p-3">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-sm text-gray-500">
                              {selectedAvailability.length} selected
                            </span>
                            {selectedAvailability.length > 0 && (
                              <button
                                onClick={() => setSelectedAvailability([])}
                                className="text-sm text-gray-500 hover:text-gray-700 underline"
                              >
                                Reset
                              </button>
                            )}
                          </div>
                          <div className="space-y-2">
                            <label className="flex items-center gap-3 p-2 rounded cursor-pointer hover:bg-gray-50">
                              <input
                                type="checkbox"
                                checked={selectedAvailability.includes('in-stock')}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedAvailability(prev => [...prev, 'in-stock'])
                                  } else {
                                    setSelectedAvailability(prev => prev.filter(s => s !== 'in-stock'))
                                  }
                                }}
                                className="rounded border-gray-300 text-vnsh-red focus:ring-vnsh-red"
                              />
                              <span className="text-sm text-gray-700 flex-1">
                                In stock ({productModels.filter(p => p.isInStock).length})
                              </span>
                            </label>
                            <label className="flex items-center gap-3 p-2 rounded cursor-pointer hover:bg-gray-50">
                              <input
                                type="checkbox"
                                checked={selectedAvailability.includes('out-of-stock')}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedAvailability(prev => [...prev, 'out-of-stock'])
                                  } else {
                                    setSelectedAvailability(prev => prev.filter(s => s !== 'out-of-stock'))
                                  }
                                }}
                                className="rounded border-gray-300 text-vnsh-red focus:ring-vnsh-red"
                              />
                              <span className="text-sm text-gray-700 flex-1">
                                Out of stock ({productModels.filter(p => !p.isInStock).length})
                              </span>
                            </label>
                          </div>
                        </div>
                      </SelectContent>
                    </Select>

                  <Select value={priceRange.from || priceRange.to ? "filtered" : "all"} onValueChange={() => {}}>
                    <SelectTrigger
                      className="w-auto border-0 bg-transparent p-0 h-auto shadow-none hover:bg-transparent focus:ring-0"
                      style={{
                        fontSize: '14px',
                        fontWeight: 300,
                        fontFamily: 'URWDIN-Regular',
                        color: 'rgba(18, 18, 18, 0.75)',
                        letterSpacing: '0.4px',
                        lineHeight: '21px'
                      }}
                    >
                      <SelectValue>
                        {(priceRange.from || priceRange.to) ? "Price ✓" : "Price"}
                      </SelectValue>
                    </SelectTrigger>
                      <SelectContent className="w-80">
                        <div className="p-3">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-sm text-gray-500">
                              The highest price is ${priceInfo.max.toFixed(2)}
                            </span>
                            {(priceRange.from || priceRange.to) && (
                              <button
                                onClick={() => setPriceRange({ from: "", to: "" })}
                                className="text-sm text-gray-500 hover:text-gray-700 underline"
                              >
                                Reset
                              </button>
                            )}
                          </div>
                          <div className="flex flex-col gap-3">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">$</span>
                              <input
                                type="number"
                                placeholder="From"
                                value={priceRange.from}
                                onChange={(e) => setPriceRange(prev => ({ ...prev, from: e.target.value }))}
                                className="w-32 rounded border border-gray-300 px-3 py-2 text-sm placeholder-gray-400 bg-white focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400"
                                min="0"
                                step="0.01"
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-lg">$</span>
                              <input
                                type="number"
                                placeholder="To"
                                value={priceRange.to}
                                onChange={(e) => setPriceRange(prev => ({ ...prev, to: e.target.value }))}
                                className="w-32 rounded border border-gray-300 px-3 py-2 text-sm placeholder-gray-400 bg-white focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400"
                                min="0"
                                step="0.01"
                              />
                            </div>
                          </div>
                        </div>
                      </SelectContent>
                    </Select>

                  <Select value={selectedSizes.length > 0 ? "filtered" : "all"} onValueChange={() => {}}>
                    <SelectTrigger
                      className="w-auto border-0 bg-transparent p-0 h-auto shadow-none hover:bg-transparent focus:ring-0"
                      style={{
                        fontSize: '14px',
                        fontWeight: 300,
                        fontFamily: 'URWDIN-Regular',
                        color: 'rgba(18, 18, 18, 0.75)',
                        letterSpacing: '0.4px',
                        lineHeight: '21px'
                      }}
                    >
                      <SelectValue>
                        {selectedSizes.length > 0 ? `Size (${selectedSizes.length} selected)` : "Size"}
                      </SelectValue>
                    </SelectTrigger>
                      <SelectContent className="w-80">
                        <div className="p-3">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-sm text-gray-500">
                              {selectedSizes.length} selected
                            </span>
                            {selectedSizes.length > 0 && (
                              <button
                                onClick={() => setSelectedSizes([])}
                                className="text-sm text-gray-500 hover:text-gray-700 underline"
                              >
                                Reset
                              </button>
                            )}
                          </div>
                          <div className="space-y-2">
                            {availableSizes.map(({ size, count }) => (
                              <label key={size} className="flex items-center gap-3 p-2 rounded cursor-pointer hover:bg-gray-50">
                                <input
                                  type="checkbox"
                                  checked={selectedSizes.includes(size)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedSizes(prev => [...prev, size])
                                    } else {
                                      setSelectedSizes(prev => prev.filter(s => s !== size))
                                    }
                                  }}
                                  className="rounded border-gray-300 text-vnsh-red focus:ring-vnsh-red"
                                />
                                <span className="text-sm text-gray-700 flex-1">
                                  {size} ({count})
                                </span>
                              </label>
                            ))}
                            {availableSizes.length === 0 && (
                              <div className="text-sm text-gray-500 text-center py-2">
                                No size options available
                              </div>
                            )}
                          </div>
                        </div>
                      </SelectContent>
                    </Select>

                  {/* Sort By - on same line */}
                  <span
                    className="uppercase"
                    style={{
                      fontSize: '14px',
                      fontWeight: 300,
                      letterSpacing: '0.4px',
                      color: 'rgba(18, 18, 18, 0.85)'
                    }}
                  >
                    Sort by:
                  </span>
                  <Select value={sortOption} onValueChange={(value) => setSortOption(value as SortOption)}>
                    <SelectTrigger
                      className="w-auto border-0 bg-transparent p-0 h-auto shadow-none hover:bg-transparent focus:ring-0"
                      style={{
                        fontSize: '14px',
                        fontWeight: 300,
                        fontFamily: 'URWDIN-Regular',
                        color: 'rgba(18, 18, 18, 0.75)',
                        letterSpacing: '0.4px',
                        lineHeight: '21px'
                      }}
                    >
                      <SelectValue placeholder="Featured" />
                    </SelectTrigger>
                    <SelectContent>
                      {SORT_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Product count - on same line, pushed to right */}
                  <div className="ml-auto flex items-center gap-3">
                    {/* View Toggle - Only show on mobile */}
                    {isMobile && (
                      <ProductViewToggle
                        viewMode={viewMode}
                        onToggle={toggleViewMode}
                      />
                    )}

                    <div
                      style={{
                        fontSize: '20px',
                        fontWeight: 300,
                        fontFamily: 'URWDIN-Regular',
                        color: 'rgba(18, 18, 18, 0.75)',
                        letterSpacing: '0.6px',
                        lineHeight: '36px',
                        textTransform: 'none'
                      }}
                    >
                      {productCount} {productCount === 1 ? "product" : "products"}
                    </div>
                  </div>
                </div>
              </div>
            </div>



            {/* Products Grid */}
            {processedProducts.length === 0 ? (
              <div className="text-center py-12">
                <Package className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No products match your filters</h3>
                <p className="text-sm text-gray-600 mb-6">
                  Reset your filters or explore another collection to keep shopping.
                </p>
                <Button variant="outline" onClick={() => {
                  setSelectedAvailability([])
                  setPriceRange({ from: "", to: "" })
                  setSelectedSizes([])
                }}>
                  Clear filters
                </Button>
              </div>
            ) : (
              <div className={
                viewMode === 'compact'
                  ? "flex flex-col gap-3 sm:gap-4"
                  : "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 sm:gap-6"
              }>
                {processedProducts.map((product) => (
                  <CollectionProductCard
                    key={product.id}
                    product={{
                      id: product.id,
                      handle: product.handle,
                      title: product.title,
                      image: product.image,
                      priceLabel: product.priceLabel,
                      compareAtLabel: product.compareAtLabel,
                      isOnSale: product.isOnSale,
                      badge: product.badge,
                      isInStock: product.isInStock,
                      defaultVariantId: product.defaultVariantId,
                      variantCount: product.variantCount,
                    }}
                    onQuickAdd={handleQuickAddRequest}
                    viewMode={viewMode}
                  />
                ))}
              </div>
            )}
        </div>
      </div>
    </div>
      </main>
      <Dialog open={Boolean(quickAddProduct)} onOpenChange={(open) => { if (!open) handleQuickAddClose() }}>
        <DialogContent className="max-w-lg">
          <DialogHeader className="space-y-2">
            <DialogTitle className="text-xl font-semibold text-gray-900">Select options</DialogTitle>
            <DialogDescription className="text-sm text-gray-600">
              Choose a configuration before adding this product to your cart.
            </DialogDescription>
          </DialogHeader>

          {quickAddProduct ? (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-semibold text-gray-900">{quickAddProduct.title}</h3>
                {quickAddPrice ? (
                  <p className="text-sm text-gray-600">{quickAddPrice}</p>
                ) : null}
              </div>

              {quickAddProduct.options && quickAddProduct.options.length > 0 ? (
                <VariantSelector
                  options={quickAddProduct.options}
                  selectedOptions={quickAddOptions}
                  availableOptions={quickAddAvailableOptions}
                  onOptionChange={handleQuickAddOptionChange}
                />
              ) : (
                <p className="text-sm text-gray-600">
                  This product does not have selectable options. It will be added to your cart as shown.
                </p>
              )}

              {quickAddError ? (
                <p className="text-sm text-red-600">{quickAddError}</p>
              ) : null}

              <DialogFooter className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Button
                  variant="outline"
                  onClick={handleQuickAddClose}
                  className="w-full sm:w-auto"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleQuickAddSubmit}
                  disabled={!quickAddVariantAvailable || isQuickAddSubmitting || isCartLoading}
                  className="w-full sm:w-auto bg-vnsh-red text-white hover:bg-[#0f4a1c]"
                >
                  {isQuickAddSubmitting || isCartLoading ? "Adding…" : quickAddVariantAvailable ? "Add to cart" : "Sold out"}
                </Button>
              </DialogFooter>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
      <Footer />
    </div>
  )
}

export default CollectionDetail
