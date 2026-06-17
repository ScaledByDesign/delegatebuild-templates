
import React from 'react';
import { Link } from 'react-router-dom';
import { useRegion } from '@/hooks/useRegion';

interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  image: string;
  category: string;
  slug: string;
  rating?: number;
  inventory_quantity?: number;
  manage_inventory?: boolean;
  allow_backorder?: boolean;
  defaultVariantId?: string | null;
}

const ProductCard = ({ product }: { product: Product }) => {
  const { formatPrice } = useRegion();

  return (
    <div className="bg-white rounded-lg overflow-hidden shadow card-hover">
      <Link to={`/products/${product.slug}`}>
        <div className="relative h-64 overflow-hidden bg-gray-100">
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
          />
        </div>
      </Link>
      <div className="p-4">
        <Link to={`/products/${product.slug}`}>
          <h3 className="font-medium text-lg mb-1 hover:text-vnsh-red transition-colors">{product.name}</h3>
        </Link>
        <div className="flex justify-between items-center mt-3">
          <span className="font-bold text-lg text-vnsh-red">{formatPrice(product.price)}</span>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;

// Also exported as a named export so either import style resolves
// (`import ProductCard from ...` or `import { ProductCard } from ...`).
export { ProductCard };
