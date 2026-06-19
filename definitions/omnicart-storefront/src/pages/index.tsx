import Head from "next/head";
import type { GetServerSideProps } from "next";
import { ShoppingBag } from "lucide-react";
import { ProductCard } from "@/components/ProductCard";
import {
  isOmniCartConfigured,
  listProducts,
  type OmniCartProduct,
} from "@/lib/omnicart";

interface CatalogProps {
  products: OmniCartProduct[];
  configured: boolean;
  error: string | null;
}

export const getServerSideProps: GetServerSideProps<CatalogProps> = async () => {
  if (!isOmniCartConfigured()) {
    return { props: { products: [], configured: false, error: null } };
  }

  try {
    const products = await listProducts(12);
    return { props: { products, configured: true, error: null } };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { props: { products: [], configured: true, error: message } };
  }
};

export default function Catalog({ products, configured, error }: CatalogProps) {
  return (
    <>
      <Head>
        <title>OmniCart — Shop</title>
        <meta
          name="description"
          content="Browse the OmniCart catalog and find your next favorite product."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="min-h-screen bg-background text-foreground">
        <header className="border-b border-border">
          <div className="mx-auto flex max-w-6xl items-center gap-3 px-6 py-6">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <ShoppingBag className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-xl font-semibold leading-none">OmniCart</h1>
              <p className="text-sm text-muted-foreground">
                Everything you need, in one cart.
              </p>
            </div>
          </div>
        </header>

        <section className="mx-auto max-w-6xl px-6 py-10">
          <h2 className="mb-6 text-2xl font-semibold tracking-tight">
            Featured products
          </h2>

          {!configured ? (
            <p className="rounded-lg border border-border bg-muted/40 p-6 text-sm text-muted-foreground">
              OmniCart is not configured yet. Set{" "}
              <code className="font-mono">NEXT_PUBLIC_OMNICART_BACKEND_URL</code>{" "}
              and{" "}
              <code className="font-mono">
                NEXT_PUBLIC_OMNICART_PUBLISHABLE_KEY
              </code>{" "}
              to connect your storefront.
            </p>
          ) : error ? (
            <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-6 text-sm text-destructive">
              Could not load products: {error}
            </p>
          ) : products.length === 0 ? (
            <p className="rounded-lg border border-border bg-muted/40 p-6 text-sm text-muted-foreground">
              No products found in this storefront yet.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </section>

        <footer className="border-t border-border">
          <div className="mx-auto max-w-6xl px-6 py-6 text-sm text-muted-foreground">
            Powered by OmniCart.
          </div>
        </footer>
      </main>
    </>
  );
}
