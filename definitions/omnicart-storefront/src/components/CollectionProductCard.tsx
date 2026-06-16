import React from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProductViewMode } from "@/hooks/useProductViewMode";

export interface CollectionProductCardProps {
  id: string;
  handle: string;
  title: string;
  image?: string;
  priceLabel: string;
  compareAtLabel?: string;
  isOnSale?: boolean;
  badge?: string;
  isInStock: boolean;
  defaultVariantId?: string;
  variantCount?: number;
}
interface CollectionProductCardComponentProps {
  product: CollectionProductCardProps;
  onQuickAdd?: (productId: string, defaultVariantId?: string, variantCount?: number) => void;
  viewMode?: ProductViewMode;
}
const CollectionProductCard: React.FC<CollectionProductCardComponentProps> = ({
  product,
  onQuickAdd,
  viewMode = 'grid'
}) => {
  const handleAddToCart = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault(); // Prevent navigation when clicking the button
    e.stopPropagation(); // Stop event bubbling
    if (!product.isInStock) return;
    onQuickAdd?.(product.id, product.defaultVariantId, product.variantCount);
  };

  // Compact/List view layout
  if (viewMode === 'compact') {
    return (
      <div className="group block relative">
        <Link to={`/products/${product.handle}`}>
          <div className="relative flex overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition hover:shadow-md">
            {/* Image - smaller, fixed width on left */}
            <div className="relative w-24 sm:w-32 flex-shrink-0 overflow-hidden bg-gray-100">
              {product.image ? (
                <img
                  src={product.image}
                  alt={product.title}
                  className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">
                  No image
                </div>
              )}
              {!product.isInStock && <div className="absolute inset-0 bg-white/70" aria-hidden="true" />}
            </div>

            {/* Content - takes remaining space */}
            <div className="flex flex-1 flex-col justify-between gap-2 p-3 sm:p-4">
              <div className="space-y-1">
                {product.badge && (
                  <Badge
                    variant="secondary"
                    className="mb-1 inline-block rounded-full border border-white/60 bg-white/90 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-vnsh-red"
                  >
                    {product.badge}
                  </Badge>
                )}
                <h3 className="text-sm font-semibold text-gray-900 transition-colors group-hover:text-vnsh-red line-clamp-2">
                  {product.title}
                </h3>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-base font-semibold text-vnsh-red">{product.priceLabel}</span>
                    {product.isOnSale && product.compareAtLabel && (
                      <span className="text-xs text-gray-400 line-through">{product.compareAtLabel}</span>
                    )}
                  </div>
                  <div className={cn("text-xs font-semibold uppercase tracking-wide", product.isInStock ? "text-green-600" : "text-gray-500")}>
                    {product.isInStock ? "In stock" : "Sold out"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Link>
      </div>
    );
  }

  // Grid view layout (default)
  return (
    <div className="group block relative">
      <Link to={`/products/${product.handle}`}>
        <div className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
          <div className="relative aspect-square w-full overflow-hidden bg-gray-100">
            {product.image ? (
              <img
                src={product.image}
                alt={product.title}
                className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                loading="lazy"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sm text-gray-400">
                Image coming soon
              </div>
            )}

            {product.badge && (
              <Badge
                variant="secondary"
                className="absolute left-4 top-4 rounded-full border border-white/60 bg-white/90 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-vnsh-red"
              >
                {product.badge}
              </Badge>
            )}

            {!product.isInStock && <div className="absolute inset-0 bg-white/70" aria-hidden="true" />}
          </div>

          <div className="flex flex-1 flex-col gap-3 p-4">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-gray-900 transition-colors group-hover:text-vnsh-red">
                {product.title}
              </h3>
            </div>

            <div className="mt-auto flex items-baseline gap-2">
              <span className="text-base font-semibold text-vnsh-red">{product.priceLabel}</span>
              {product.isOnSale && product.compareAtLabel ? (
                <span className="text-sm text-gray-400 line-through">{product.compareAtLabel}</span>
              ) : null}
            </div>

            <div className={cn("text-xs font-semibold uppercase tracking-wide", product.isInStock ? "text-green-600" : "text-gray-500")}>
              {product.isInStock ? "In stock" : "Sold out"}
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
};

export default CollectionProductCard;