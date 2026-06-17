import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { listCollections, MedusaCollection } from '../services/medusa/collections';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { ArrowRight, Package, Loader2 } from 'lucide-react';

const FeaturedCollections: React.FC = () => {
  const { data: collectionsData, isLoading, error } = useQuery({
    queryKey: ['featured-collections'],
    queryFn: () => listCollections({ limit: 6, fields: "*products" }),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  if (isLoading) {
    return (
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-red-600" />
            <p className="text-gray-600">Loading collections...</p>
          </div>
        </div>
      </section>
    );
  }

  if (error || !collectionsData?.collections?.length) {
    return null; // Don't show section if there's an error or no collections
  }

  const collections = collectionsData.collections.slice(0, 3);

  return (
    <section className="py-16 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Shop by Collection
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Discover our carefully curated collections designed for every concealed carry need
          </p>
        </div>

        {/* Collections Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
          {collections.map((collection) => (
            <CollectionCard key={collection.id} collection={collection} />
          ))}
        </div>

        {/* View All Collections Button */}
        <div className="text-center">
          <Link to="/collections">
            <Button size="lg" className="bg-[#176326] hover:bg-[#0f4a1c] text-white">
              View Collections
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
};

interface CollectionCardProps {
  collection: MedusaCollection;
}

const CollectionCard: React.FC<CollectionCardProps> = ({ collection }) => {
  const productCount = collection.products?.length || 0;
  const handle = collection.handle?.toLowerCase() || '';
  const title = collection.title?.trim() || '';
  const titleLower = title.toLowerCase();

  const isAllCollection = handle === 'products' || handle === 'all' || handle === 'all-products' || titleLower === 'all' || titleLower === 'all products';

  // Get first product image as collection thumbnail
  const thumbnailImage = collection.products?.[0]?.thumbnail;

  // Format collection title for display
  const displayTitle = isAllCollection ? 'Featured Gear' : (title || 'Collection');
  
  // Create a short description based on collection handle
  const getCollectionDescription = (handle: string) => {
    switch (handle) {
      case 'products':
        return 'Our best-selling concealed carry essentials';
      case 'accessories':
        return 'Essential holster accessories and carry gear';
      case 'vnsh-holsters-apparel-and-gifts':
        return 'VNSH branded merchandise and gifts';
      default:
        return titleLower ? `Explore our ${titleLower} collection` : 'Discover the latest from VNSH';
    }
  };

  return (
    <Link to={`/collections/${collection.handle}`} className="group">
      <Card className="h-full transition-all duration-300 hover:shadow-lg hover:-translate-y-1 border-gray-200 group-hover:border-red-300">
        <CardContent className="p-0">
          {/* Collection Image */}
          <div className="aspect-[4/3] bg-gradient-to-br from-gray-100 to-gray-200 relative overflow-hidden rounded-t-lg">
            {thumbnailImage ? (
              <img
                src={thumbnailImage}
                alt={collection.title}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-red-50 to-red-100">
                <Package className="h-16 w-16 text-red-300" />
              </div>
            )}
            
            {/* Product Count Badge */}
            <div className="absolute top-4 right-4">
              <Badge variant="secondary" className="bg-white/90 text-gray-700">
                {productCount} {productCount === 1 ? 'item' : 'items'}
              </Badge>
            </div>
          </div>

          {/* Collection Info */}
          <div className="p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xl font-semibold text-gray-900 group-hover:text-red-600 transition-colors">
                {displayTitle}
              </h3>
              <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-red-600 transition-colors" />
            </div>
            
            <p className="text-gray-600 text-sm mb-4 line-clamp-2">
              {getCollectionDescription(collection.handle)}
            </p>

            {/* Sample Products Preview */}
            {collection.products && collection.products.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Featured Items:
                </p>
                <div className="space-y-1">
                  {collection.products.slice(0, 2).map((product) => (
                    <p key={product.id} className="text-sm text-gray-600 truncate">
                      • {product.title}
                    </p>
                  ))}
                  {collection.products.length > 2 && (
                    <p className="text-sm text-gray-500 italic">
                      +{collection.products.length - 2} more items
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
};

export default FeaturedCollections;

// Also exported as a named export so either import style resolves
// (`import FeaturedCollections from ...` or `import { FeaturedCollections } from ...`).
export { FeaturedCollections };
