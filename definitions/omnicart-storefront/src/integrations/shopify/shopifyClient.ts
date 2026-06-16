// Placeholder shopify client types to resolve import errors
export interface ShopifyProductNode {
  id: string;
  title: string;
  handle: string;
  descriptionHtml?: string;
  vendor?: string;
  productType?: string;
  tags?: string[];
  variants?: {
    nodes: ShopifyVariantNode[];
  };
}

export interface ShopifyVariantNode {
  id: string;
  title?: string;
  price?: string;
  inventoryQuantity?: number;
  sku?: string;
  weight?: number;
  weightUnit?: string;
}

export const shopifyClient = {
  // Placeholder client
};