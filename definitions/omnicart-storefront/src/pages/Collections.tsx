import React, { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import { listCollections } from "@/services/medusa/collections"
import { Loader2, Package } from "lucide-react"
import Navbar from "@/components/Navbar"
import Footer from "@/components/Footer"
import { getCollectionContent } from "@/lib/content/collectionContent"

const FEATURED_COLLECTION_HANDLES = [
  "products",
  "accessories",
  "vnsh-holsters-apparel-and-gifts",
]

interface CollectionCardData {
  handle: string
  title: string
  image?: string
  description?: string
  productCount: number
}

const Collections: React.FC = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ["collections"],
    queryFn: () => listCollections({ fields: "*products" }),
    staleTime: 5 * 60 * 1000,
  })

  const counts = useMemo(() => {
    const map = new Map<string, number>()
    ;(data?.collections ?? []).forEach((collection) => {
      map.set(collection.handle, collection.products?.length ?? 0)
    })
    return map
  }, [data])

  const curatedCollections: CollectionCardData[] = useMemo(() => {
    return FEATURED_COLLECTION_HANDLES.map((handle) => {
      const content = getCollectionContent(handle)
      const title = content.heroTitle || handle
      return {
        handle,
        title,
        image: content.cardImage,
        description: content.cardDescription,
        productCount: counts.get(handle) ?? 0,
      }
    })
  }, [counts])

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-grow bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-red-600" />
            <p className="text-gray-600">Loading collections...</p>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-grow bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <Package className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Unable to load collections</h2>
            <p className="text-gray-600">Please try again later.</p>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-grow bg-neutral-50">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">Collections</h1>
        <p className="mt-3 max-w-2xl text-base text-gray-600">
          Start with the essentials or jump straight to the gear you need. Each collection mirrors the layout and copy from the original VNSH store so migration stays 1:1.
        </p>

        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {curatedCollections.map((collection) => (
            <CollectionCard key={collection.handle} collection={collection} />
          ))}
        </div>
      </div>
      </main>
      <Footer />
    </div>
  )
}

const CollectionCard: React.FC<{ collection: CollectionCardData }> = ({ collection }) => {
  return (
    <Link to={`/collections/${collection.handle}`} className="group block h-full">
      <div className="flex h-full flex-col overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
        <div className="relative aspect-square bg-gray-100">
          {collection.image ? (
            <img
              src={collection.image}
              alt={collection.title}
              className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm text-gray-400">
              Imagery coming soon
            </div>
          )}
          {collection.productCount > 0 ? (
            <div className="absolute left-5 top-5 rounded-full border border-white/70 bg-white/90 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-gray-700">
              {collection.productCount} {collection.productCount === 1 ? "product" : "products"}
            </div>
          ) : null}
        </div>
        <div className="flex flex-1 items-center justify-between gap-4 p-5">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{collection.title}</h3>
            {collection.description ? (
              <p className="mt-1 text-sm text-gray-600">{collection.description}</p>
            ) : null}
          </div>
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-300 text-gray-500 transition group-hover:border-vnsh-red group-hover:text-vnsh-red">
            <svg
              viewBox="0 0 14 10"
              fill="none"
              aria-hidden="true"
              focusable="false"
              className="h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M8.537.808a.5.5 0 01.817-.162l4 4a.5.5 0 010 .708l-4 4a.5.5 0 11-.708-.708L11.793 5.5H1a.5.5 0 010-1h10.793L8.646 1.354a.5.5 0 01-.109-.546z"
                fill="currentColor"
              />
            </svg>
          </span>
        </div>
      </div>
    </Link>
  )
}

export default Collections
