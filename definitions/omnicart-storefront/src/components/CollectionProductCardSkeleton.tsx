import React from 'react'
import { Skeleton } from '@/components/ui/skeleton'

const CollectionProductCardSkeleton: React.FC = () => {
  return (
    <div className="animate-pulse">
      {/* Image skeleton */}
      <div className="aspect-square bg-gray-200 rounded-2xl mb-4" />

      {/* Content skeleton */}
      <div className="space-y-2">
        {/* Title skeleton */}
        <Skeleton className="h-5 w-3/4" />

        {/* Price skeleton */}
        <Skeleton className="h-6 w-1/3" />

        {/* Button skeleton */}
        <Skeleton className="h-10 w-full rounded-lg mt-3" />
      </div>
    </div>
  )
}

export default CollectionProductCardSkeleton