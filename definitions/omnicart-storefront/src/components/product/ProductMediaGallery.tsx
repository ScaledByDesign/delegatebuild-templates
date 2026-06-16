import React, { useMemo } from "react"
import { Swipeable } from "@/components/MobileOptimizations"
import { useIsMobile } from "@/hooks/use-mobile"

const RESPONSIVE_WIDTHS = [320, 480, 640, 768, 1024, 1440]

const getShopifyUrl = (src: string): URL | null => {
  try {
    const url = new URL(src)
    if (!url.hostname.includes("cdn.shopify.com")) {
      return null
    }
    return url
  } catch (error) {
    return null
  }
}

const buildOptimizedUrl = (src: string, width: number) => {
  const base = getShopifyUrl(src)
  if (!base) {
    return src
  }

  const sized = new URL(base.toString())
  sized.searchParams.set("width", width.toString())
  return sized.toString()
}

const buildSrcSet = (src: string) => {
  const base = getShopifyUrl(src)
  if (!base) {
    return undefined
  }

  const entries = RESPONSIVE_WIDTHS.map((width) => {
    const sized = new URL(base.toString())
    sized.searchParams.set("width", width.toString())
    return `${sized.toString()} ${width}w`
  })

  return entries.join(", ")
}

interface ProductMediaGalleryProps {
  images: string[]
  selectedIndex: number
  onSelect: (index: number) => void
  onNext: () => void
  onPrev: () => void
}

const ProductMediaGallery: React.FC<ProductMediaGalleryProps> = ({
  images,
  selectedIndex,
  onSelect,
  onNext,
  onPrev,
}) => {
  const isMobile = useIsMobile()

  const clampedIndex = images.length ? Math.min(selectedIndex, images.length - 1) : 0
  const currentImage = images[clampedIndex]

  const currentSrcSet = useMemo(() => buildSrcSet(currentImage), [currentImage])

  if (!images.length) {
    return (
      <div className="w-full aspect-square bg-gray-100 rounded-xl flex items-center justify-center text-gray-400">
        No image available
      </div>
    )
  }

  const GalleryImage = (
    <>
      <img
        src={currentImage}
        alt="Selected product media"
        srcSet={currentSrcSet}
        sizes={currentSrcSet ? "(max-width: 640px) 100vw, (max-width: 1024px) 60vw, 640px" : undefined}
        loading="eager"
        decoding="async"
        className="w-full h-full object-contain bg-white max-h-[80vh]"
      />

    </>
  )

  return (
    <div className="space-y-4 w-full max-w-full min-w-0" data-testid="product-media-gallery">
      <div
        className="relative bg-white border border-gray-200 rounded-2xl overflow-hidden flex items-center justify-center aspect-[4/5] md:aspect-square w-full max-w-full min-w-0"
        data-testid="product-gallery-main"
      >
        {isMobile && images.length > 1 ? (
          <Swipeable
            onSwipeLeft={onNext}
            onSwipeRight={onPrev}
            className="relative"
          >
            {GalleryImage}
          </Swipeable>
        ) : (
          GalleryImage
        )}
      </div>

      {images.length > 1 && (
        <div
          className="flex items-center justify-center gap-3 overflow-x-auto pb-1"
          data-testid="product-gallery-thumbnails"
        >
          {images.map((image, index) => {
            const isActive = index === clampedIndex
            const thumbSrcSet = buildSrcSet(image)
            return (
              <button
                key={`${image}-${index}`}
                type="button"
                onClick={() => onSelect(index)}
                className={`relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg border transition ${
                  isActive ? "border-vnsh-red ring-2 ring-vnsh-red" : "border-gray-200 hover:border-vnsh-red/60"
                }`}
              >
                <img
                  src={buildOptimizedUrl(image, 200)}
                  srcSet={thumbSrcSet}
                  sizes={thumbSrcSet ? "80px" : undefined}
                  loading={index === 0 ? "eager" : "lazy"}
                  decoding="async"
                  alt="Product thumbnail"
                  className="h-full w-full object-cover"
                />
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default ProductMediaGallery
