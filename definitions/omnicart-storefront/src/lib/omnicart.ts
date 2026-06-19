/**
 * OmniCart Store API client.
 *
 * Talks to the OmniCart commerce engine's public Store API. Every request to a
 * /store endpoint must carry the publishable API key in the
 * `x-publishable-api-key` header — the engine rejects calls without it.
 *
 * Configuration comes from two public environment variables, exposed to the
 * browser by Next.js because they are prefixed with NEXT_PUBLIC_:
 *   - NEXT_PUBLIC_OMNICART_BACKEND_URL     base URL of the OmniCart engine
 *   - NEXT_PUBLIC_OMNICART_PUBLISHABLE_KEY publishable key for the storefront
 */

export const OMNICART_BACKEND_URL: string =
  process.env.NEXT_PUBLIC_OMNICART_BACKEND_URL?.replace(/\/+$/, "") ??
  "http://localhost:9000";

export const OMNICART_PUBLISHABLE_KEY: string =
  process.env.NEXT_PUBLIC_OMNICART_PUBLISHABLE_KEY ?? "";

export interface OmniCartImage {
  id: string;
  url: string;
}

export interface OmniCartVariantPrice {
  amount: number;
  currency_code: string;
}

export interface OmniCartVariant {
  id: string;
  title: string;
  calculated_price?: {
    calculated_amount: number;
    currency_code: string;
  };
  prices?: OmniCartVariantPrice[];
}

export interface OmniCartProduct {
  id: string;
  title: string;
  handle: string;
  description: string | null;
  thumbnail: string | null;
  images: OmniCartImage[] | null;
  variants: OmniCartVariant[] | null;
}

interface ProductListResponse {
  products: OmniCartProduct[];
  count: number;
  offset: number;
  limit: number;
}

interface ProductResponse {
  product: OmniCartProduct;
}

function storeHeaders(): HeadersInit {
  return {
    "Content-Type": "application/json",
    "x-publishable-api-key": OMNICART_PUBLISHABLE_KEY,
  };
}

async function storeFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${OMNICART_BACKEND_URL}/store${path}`, {
    headers: storeHeaders(),
    // The catalog changes infrequently; let the browser/CDN cache it briefly.
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `OmniCart request failed (${res.status} ${res.statusText}) for /store${path}${
        body ? `: ${body}` : ""
      }`,
    );
  }

  return (await res.json()) as T;
}

/** Fetch a page of products for the catalog grid. */
export async function listProducts(limit = 12): Promise<OmniCartProduct[]> {
  const data = await storeFetch<ProductListResponse>(
    `/products?limit=${encodeURIComponent(String(limit))}&fields=*variants.calculated_price`,
  );
  return data.products ?? [];
}

/** Fetch a single product by its URL handle for the product detail page. */
export async function getProductByHandle(
  handle: string,
): Promise<OmniCartProduct | null> {
  const data = await storeFetch<ProductListResponse>(
    `/products?handle=${encodeURIComponent(handle)}&limit=1&fields=*variants.calculated_price`,
  );
  return data.products?.[0] ?? null;
}

/** Fetch a single product by id (used for direct id lookups). */
export async function getProductById(
  id: string,
): Promise<OmniCartProduct | null> {
  try {
    const data = await storeFetch<ProductResponse>(
      `/products/${encodeURIComponent(id)}?fields=*variants.calculated_price`,
    );
    return data.product ?? null;
  } catch {
    return null;
  }
}

/** Derive a human-readable price string from a product's first variant. */
export function formatProductPrice(product: OmniCartProduct): string {
  const variant = product.variants?.[0];
  const price = variant?.calculated_price;
  if (!price || typeof price.calculated_amount !== "number") {
    return "Price unavailable";
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: (price.currency_code ?? "usd").toUpperCase(),
  }).format(price.calculated_amount);
}

/** True when the storefront has been pointed at an OmniCart engine. */
export function isOmniCartConfigured(): boolean {
  return Boolean(OMNICART_PUBLISHABLE_KEY) && Boolean(OMNICART_BACKEND_URL);
}
