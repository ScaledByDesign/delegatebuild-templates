import { CheckCircle2, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatAmount } from "@/lib/omnicart";
import type { OrderSummary } from "@/lib/checkout-types";

interface ConfirmationStepProps {
  order: OrderSummary;
  onStartOver: () => void;
}

/** Step 4 — order confirmation after a successful OmniCart purchase. */
export function ConfirmationStep({ order, onStartOver }: ConfirmationStepProps) {
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <CheckCircle2 className="h-12 w-12 text-primary" />
          <h2 className="text-xl font-semibold">Thank you for your order</h2>
          <p className="text-sm text-muted-foreground">
            A confirmation has been sent to{" "}
            <span className="font-medium text-foreground">{order.email}</span>.
          </p>
          <p className="text-xs text-muted-foreground">
            Order ID: <span className="font-mono">{order.id}</span>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 py-6">
          <h3 className="text-sm font-semibold">Order summary</h3>
          <ul className="space-y-2">
            {order.items.map((item) => (
              <li key={item.id} className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {item.quantity}× {item.title}
                </span>
                <span className="font-medium">
                  {formatAmount(item.unit_price * item.quantity, order.currency_code)}
                </span>
              </li>
            ))}
          </ul>

          <Separator />

          {/* Itemized totals: subtotal, discounts, shipping, tax. */}
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span>{formatAmount(order.subtotal, order.currency_code)}</span>
            </div>
            {order.discount_total > 0 && (
              <div className="flex justify-between text-primary">
                <span className="flex items-center gap-1.5">
                  <Tag className="h-3.5 w-3.5" />
                  Discount
                  {order.promotions.some((p) => p.code) && (
                    <span className="text-xs text-muted-foreground">
                      (
                      {order.promotions
                        .filter((p) => p.code)
                        .map((p) => p.code)
                        .join(", ")}
                      )
                    </span>
                  )}
                </span>
                <span>−{formatAmount(order.discount_total, order.currency_code)}</span>
              </div>
            )}
            <div className="flex justify-between text-muted-foreground">
              <span>Shipping</span>
              <span>
                {order.shipping_total === 0
                  ? "Free"
                  : formatAmount(order.shipping_total, order.currency_code)}
              </span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Tax</span>
              <span>{formatAmount(order.tax_total, order.currency_code)}</span>
            </div>
          </div>

          <Separator />

          <div className="flex justify-between text-base font-semibold">
            <span>Total paid</span>
            <span>{formatAmount(order.total, order.currency_code)}</span>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-center">
        <Button variant="outline" size="lg" onClick={onStartOver}>
          Start a new order
        </Button>
      </div>
    </div>
  );
}
