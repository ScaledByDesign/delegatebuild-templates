export interface CollectionContent {
  heroTitle?: string
  heroSubtitle?: string
  heroDescription?: string
  heroBadge?: string
  heroImage?: string
  highlight?: string
  supportingPoints?: string[]
  cardImage?: string
  cardDescription?: string
}

const DEFAULT_COLLECTION_CONTENT: CollectionContent = {
  heroTitle: undefined,
  heroSubtitle: undefined,
  heroDescription: undefined,
  heroBadge: undefined,
  heroImage: undefined,
  highlight: undefined,
  supportingPoints: undefined,
  cardImage: undefined,
  cardDescription: undefined,
}

const COLLECTION_CONTENT_MAP: Record<string, CollectionContent> = {
  products: {
    heroTitle: "Products",
    heroSubtitle: "Shop the full VNSH lineup",
    heroDescription:
      "Explore every VNSH holster, bundle, and accessory in one place. Scroll the full catalog or filter down to exactly what you need for everyday carry.",
    heroBadge: "All Collections",
    supportingPoints: [
      "Holsters, bundles, apparel, and range gear",
      "Hand-curated by the VNSH gear team",
    ],
    cardImage: "/images/collections/VNSH_Main_wMags.jpg",
    cardDescription: "Holsters, bundles, and full kits",
  },
  accessories: {
    heroTitle: "Accessories",
    heroSubtitle: "Dial in your everyday carry",
    heroDescription:
      "Retention straps, magnets, range essentials, and training tools engineered to keep your VNSH setup mission ready.",
    heroBadge: "Add-ons",
    cardImage: "/images/collections/american-flag.jpg",
    cardDescription: "Magnets, retention straps, and more",
  },
  "vnsh-holsters-apparel-and-gifts": {
    heroTitle: "Apparel & Gifts",
    heroSubtitle: "Wear the brand",
    heroDescription:
      "The beauty of VNSH holsters is you can never tell they're there, and no one else can either. Represent the VNSH brand to those in the know with our made in the USA apparel.",
    heroBadge: "Made in the USA",
    cardImage: "/images/collections/MockUp-Front-LibertyforAll.png",
    cardDescription: "Graphic tees, patches, and limited drops",
  },
}

export function getCollectionContent(handle?: string): CollectionContent {
  if (!handle) return DEFAULT_COLLECTION_CONTENT
  return COLLECTION_CONTENT_MAP[handle] ?? DEFAULT_COLLECTION_CONTENT
}
