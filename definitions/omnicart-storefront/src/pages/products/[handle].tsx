import Head from "next/head";
import Link from "next/link";
import type { GetServerSideProps } from "next";
import { ArrowLeft, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  formatProductPrice,
  getProductByHandle,
  isOmniCartConfigured,
  type OmniCartProduct,
} from "@/lib/omnicart";

interface ProductPageProps {
  product: OmniCartProduct | null;
  error: string | null;
}

export const getServerSideProps: GetServerSideProps<ProductPageProps> = async (
  ctx,
) => {
  const handle = String(ctx.params?.handle ?? "");

  if (!isOmniCartConfigured() || !handle) {
    return { props: { product: null, error: null } };
  }

  try {
    const product = await getProductByHandle(handle);
    if (!product) {
      return { notFound: true };
    }
    return { props: { product, error: null } };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { props: { product: null, error: message } };
  }
};

export default function ProductPage({ product, error }: ProductPageProps) {
  const title = product ? `${product.title} — OmniCart` : "OmniCart";
  const image =
    product?.thumbnail ?? product?.images?.[0]?.url ?? null;

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta
          name="description"
          content={product?.description ?? "Shop with OmniCart."}
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="min-h-screen bg-background text-foreground">
        <header className="border-b border-border">
          <div className="mx-auto flex max-w-6xl items-center gap-3 px-6 py-6">
            <Link href="/" className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <ShoppingBag className="h-5 w-5" />
              </span>
              <h1 className="text-xl font-semibold leading-none">OmniCart</h1>
            </Link>
          </div>
        </header>

        <section className="mx-auto max-w-6xl px-6 py-10">
          <Button asChild variant="ghost" className="mb-6 -ml-2">
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to shop
            </Link>
          </Button>

          {error ? (
            <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-6 text-sm text-destructive">
              Could not load this product: {error}
            </p>
          ) : !product ? (
            <p className="rounded-lg border border-border bg-muted/40 p-6 text-sm text-muted-foreground">
              This product is unavailable.
            </p>
          ) : (
            <div className="grid gap-10 md:grid-cols-2">
              <div className="aspect-square w-full overflow-hidden rounded-xl border border-border bg-muted">
                {image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={image}
                    alt={product.title}
                    decoding="async"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
                    No image
                  </div>
                )}
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <h2 className="text-3xl font-semibold tracking-tight">
                    {product.title}
                  </h2>
                  <p className="text-2xl text-primary">
                    {formatProductPrice(product)}
                  </p>
                </div>

                {product.description ? (
                  <p className="whitespace-pre-line leading-relaxed text-muted-foreground">
                    {product.description}
                  </p>
                ) : null}

                <Button size="lg" className="w-full sm:w-auto">
                  Add to cart
                </Button>
              </div>
            </div>
          )}
        </section>
      </main>
    </>
  );
}
