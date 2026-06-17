import { SHOPIFY_CONTENT } from "./shopifyContent.generated"
import { SCRAPED_PRODUCT_CONTENT } from "./scrapedProductContent.generated"

export interface ProductContent {
  descriptionHtml?: string
  heroBadges?: string[]
  trustBadges?: Array<{ title: string; description: string }>
  features?: Array<{ title: string; description?: string; descriptionHtml?: string; image?: string }>
  guarantee?: { title: string; paragraphs: string[] }
  shipping?: string[]
  faq?: Array<{ question: string; answer: string }>
  supportingSections?: Array<{ heading: string; body: string }>
  valueProps?: Array<{ title: string; description: string }>
  heroPromos?: string[]
  heroHighlights?: Array<{ label: string; value: string }>
  specList?: Array<{ label: string; value: string }>
  bulletFeatures?: string[]
  includedItems?: string[]
  testimonials?: Array<{ author: string; text: string; title?: string; rating?: number }>
  heroVideoUrl?: string
  faqCtaImage?: string
}

type GeneratedFeature = {
  title: string
  description?: string
  image?: string
}

type GeneratedEntry = {
  descriptionHtml?: string
  features?: GeneratedFeature[]
  specList?: Array<{ label: string; value: string }>
  bulletFeatures?: string[]
  faq?: Array<{ question: string; answer: string }>
}

const GENERATED_CONTENT: Record<string, ProductContent> = Object.fromEntries(
  Object.entries(SHOPIFY_CONTENT).map(([handle, entry]) => {
    const generated = entry as unknown as GeneratedEntry
    return [
      handle,
      {
        descriptionHtml: generated.descriptionHtml,
        features: generated.features?.map((feature) => ({
          title: feature.title,
          descriptionHtml: feature.description,
          image: feature.image,
        })),
        specList: generated.specList,
        bulletFeatures: generated.bulletFeatures,
        faq: generated.faq,
      } satisfies ProductContent,
    ]
  })
)

const DEFAULT_CONTENT: ProductContent = {
  trustBadges: [
    {
      title: "30-Day Comfort Guarantee",
      description: "Wear it every day for 30 days. If you don’t love it, send it back for a hassle-free refund.",
    },
    {
      title: "Lifetime Warranty",
      description: "Every VNSH product is backed for life against manufacturing defects.",
    },
    {
      title: "Fast, Free Shipping",
      description: "Orders over $50 ship free from our U.S. facility within 1 business day.",
    },
  ],
  shipping: [
    "Ships free from our U.S. warehouse",
    "Most orders arrive within 3–5 business days",
    "Order by 2pm ET for same-day processing",
  ],
  // FAQs are managed via Admin UI in product metadata.pdp_sections
  faq: [],
  // Value props removed from defaults - they were holster-specific and inappropriate for apparel/accessories
  // Products needing value props should define them via metadata.pdp_sections or STATIC_CONTENT
  valueProps: [],
  heroPromos: [
    "Free shipping over $50",
    "30-day comfort guarantee",
  ],
  heroHighlights: [],
  specList: [],
  bulletFeatures: [],
  includedItems: [],
  testimonials: [],
}

const STATIC_CONTENT: Record<string, ProductContent> = {
  "vnsh-holster": {
    // Custom PDP sections managed via Admin UI
    faq: [],
    testimonials: [],
    shipping: [],
    specList: [],
    bulletFeatures: [],
    includedItems: [],
    trustBadges: [],
    heroPromos: [],
    heroHighlights: [],
    valueProps: [],
  },
  "vnsh-laser-strike-enhanced-training-system": {
    // Custom PDP sections managed via Admin UI
    features: [],
    faq: [],
    testimonials: [],
    shipping: ["Not available for shipping to Alaska (AK) or Hawaii (HI)"],
    specList: [],
    bulletFeatures: [],
    includedItems: [],
    trustBadges: [],
    heroPromos: [],
    heroHighlights: [],
    valueProps: [],
  },
  "the-vnsh-holster-weapon-mounted-light-compatible": {
    // Custom PDP sections managed via Admin UI
    features: [],
    faq: [],
    testimonials: [],
    shipping: [],
    specList: [],
    bulletFeatures: [],
    includedItems: [],
    trustBadges: [],
    heroPromos: [],
    heroHighlights: [],
    valueProps: [],
  },
  "vnsh-holster-lite": {
    // Custom PDP sections managed via Admin UI
    features: [],
    faq: [],
    testimonials: [],
    shipping: [],
    specList: [],
    bulletFeatures: [],
    includedItems: [],
    trustBadges: [],
    heroPromos: [],
    heroHighlights: [],
    valueProps: [],
  },
  "magazine-loader": {
    // Custom PDP sections only - managed via metadata
    // All arrays explicitly empty to prevent auto-generated sections
    features: undefined,
    faq: [],
    testimonials: [],
    shipping: [],
    specList: [],
    bulletFeatures: [],
    includedItems: [],
    trustBadges: [],
    heroPromos: [],
    heroHighlights: [],
    valueProps: [],
  },
  "vnsh-laser-strike-training-system": {
    // Custom PDP sections managed via Admin UI
    features: [],
    faq: [],
    testimonials: [],
    shipping: ["Not available for shipping to Alaska (AK) or Hawaii (HI)"],
    specList: [],
    bulletFeatures: [],
    includedItems: [],
    trustBadges: [],
    heroPromos: [],
    heroHighlights: [],
    valueProps: [],
  },
  "vnsh-appendix-pistol-grip-minimizing-wedge": {
    // Custom PDP sections managed via Admin UI
    features: [],
    faq: [],
    testimonials: [],
    shipping: [],
    specList: [],
    bulletFeatures: [],
    includedItems: [],
    trustBadges: [],
    heroPromos: [],
    heroHighlights: [],
    valueProps: [],
  },
  "vnsh-mag-mate": {
    // Custom PDP sections managed via Admin UI
    features: [],
    faq: [],
    testimonials: [],
    shipping: [],
    specList: [],
    bulletFeatures: [],
    includedItems: [],
    trustBadges: [],
    heroPromos: [],
    heroHighlights: [],
    valueProps: [],
  },
  "vnsh-side-mag-pouch-1": {
    // Custom PDP sections managed via Admin UI
    features: [],
    faq: [],
    testimonials: [],
    shipping: [],
    specList: [],
    bulletFeatures: [],
    includedItems: [],
    trustBadges: [],
    heroPromos: [],
    heroHighlights: [],
    valueProps: [],
  },
}

export const PRODUCT_CONTENT_MAP: Record<string, ProductContent> = {
  ...GENERATED_CONTENT,
  ...SCRAPED_PRODUCT_CONTENT,
  ...STATIC_CONTENT,
}

export function getProductContent(handle?: string, metadata?: Record<string, unknown>): ProductContent {
  if (!handle) return DEFAULT_CONTENT

  const baseContent = PRODUCT_CONTENT_MAP[handle] ?? DEFAULT_CONTENT

  // Merge metadata.content fields if available (from Admin Content tab)
  const metadataContent = metadata?.content as Record<string, unknown> | undefined
  const contentFeatures = Array.isArray(metadataContent?.features) ? metadataContent.features as ProductContent['features'] : undefined
  const contentSpecList = Array.isArray(metadataContent?.specList) ? metadataContent.specList as ProductContent['specList'] : undefined
  const contentValueProps = Array.isArray(metadataContent?.valueProps) ? metadataContent.valueProps as ProductContent['valueProps'] : undefined

  // Start with base content, then overlay metadata.content (takes priority over static)
  const mergedContent = { ...baseContent }

  if (contentFeatures && contentFeatures.length > 0) {
    mergedContent.features = contentFeatures
  }
  if (contentSpecList && contentSpecList.length > 0) {
    mergedContent.specList = contentSpecList
  }
  if (contentValueProps && contentValueProps.length > 0) {
    mergedContent.valueProps = contentValueProps
  }

  // Merge metadata pdp_sections if available (highest priority)
  if (metadata?.pdp_sections && Array.isArray(metadata.pdp_sections)) {
    const pdpSections = metadata.pdp_sections as Array<{
      type: string
      title?: string
      body_html?: string
      image?: string
      align?: string
      url?: string
    }>

    const metadataFeatures = pdpSections
      .filter(section => section.type === 'image_with_text')
      .map(section => ({
        title: section.title ?? '',
        descriptionHtml: section.body_html,
        image: section.image,
      }))

    const metadataVideos = pdpSections
      .filter(section => section.type === 'video')
      .map(section => section.url)
      .filter((url): url is string => Boolean(url))

    // PDP sections take highest priority for features and video
    if (metadataFeatures.length > 0) {
      mergedContent.features = metadataFeatures
    }
    if (metadataVideos.length > 0) {
      mergedContent.heroVideoUrl = metadataVideos[0]
    }
  }

  return mergedContent
}
