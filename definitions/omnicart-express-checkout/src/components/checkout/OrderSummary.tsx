import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatAmount, type OmniCart } from "@/lib/omnicart";
import { cartSubtotal } from "@/lib/checkout-types";

interface OrderSummaryProps {
  cart: OmniCart;
  shippingAmount?: number;
}

/** Reusable OmniCart order summary card (line items + totals). */
export function OrderSummary({ cart, shippingAmount }: OrderSummaryProps) {
  const currency = cart.currency_code || "usd";
  const subtotal = cart.subtotal ?? cartSubtotal(cart.items);
  const shipping = shippingAmount ?? cart.shipping_total ?? 0;
  const tax = cart.tax_total ?? 0;
  const total = subtotal + shipping + tax;

  return (
    <Card className="sticky top-6">
      <CardHeader>
        <CardTitle className="text-base">Order summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-3">
          {cart.items.map((item) => (
            <li key={item.id} className="flex items-start justify-between gap-3 text-sm">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-medium text-muted-foreground">
                  {item.quantity}×
                </div>
                <div>
                  <p className="font-medium leading-tight">{item.title}</p>
                  {item.variant?.title && (
                    <p className="text-xs text-muted-foreground">{item.variant.title}</p>
                  )}
                </div>
              </div>
              <span className="font-medium">
                {formatAmount(item.unit_price * item.quantity, currency)}
              </span>
            </li>
          ))}
        </ul>

        <Separator />

        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal</span>
            <span>{formatAmount(subtotal, currency)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Shipping</span>
            <span>{shipping === 0 ? "Free" : formatAmount(shipping, currency)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Tax</span>
            <span>{formatAmount(tax, currency)}</span>
          </div>
        </div>

        <Separator />

        <div className="flex justify-between text-base font-semibold">
          <span>Total</span>
          <span>{formatAmount(total, currency)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
