import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import {
  formatProductPrice,
  type OmniCartProduct,
} from "@/lib/omnicart";

interface ProductCardProps {
  product: OmniCartProduct;
}

export function ProductCard({ product }: ProductCardProps) {
  const image = product.thumbnail ?? product.images?.[0]?.url ?? null;

  return (
    <Link
      href={`/products/${encodeURIComponent(product.handle)}`}
      className="group block focus:outline-none"
    >
      <Card className="h-full overflow-hidden border-border transition-shadow group-hover:shadow-lg group-focus-visible:ring-2 group-focus-visible:ring-ring">
        <div className="aspect-square w-full overflow-hidden bg-muted">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image}
              alt={product.title}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
              No image
            </div>
          )}
        </div>
        <CardContent className="space-y-1 p-4">
          <h3 className="line-clamp-1 font-medium text-foreground">
            {product.title}
          </h3>
          <p className="text-sm text-muted-foreground">
            {formatProductPrice(product)}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
