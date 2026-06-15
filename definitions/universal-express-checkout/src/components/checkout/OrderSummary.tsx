import { useState, type ChangeEvent, type KeyboardEvent } from "react";
import { Loader2, Tag, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatAmount, type OmniCart } from "@/lib/omnicart";
import { cartSubtotal } from "@/lib/checkout-types";

interface OrderSummaryProps {
  cart: OmniCart;
  shippingAmount?: number;
  /**
   * Coupon handlers. When omitted, the coupon field is hidden (e.g. on steps
   * where editing the cart no longer makes sense). `onApplyCoupon` should
   * resolve to an error string on failure, or `null`/`undefined` on success.
   */
  onApplyCoupon?: (code: string) => Promise<string | null | undefined> | string | null | undefined;
  onRemoveCoupon?: (code: string) => void;
}

/** Reusable OmniCart order summary card (line items + coupon + totals). */
export function OrderSummary({
  cart,
  shippingAmount,
  onApplyCoupon,
  onRemoveCoupon,
}: OrderSummaryProps) {
  const currency = cart.currency_code || "usd";
  const subtotal = cart.subtotal ?? cartSubtotal(cart.items);
  const shipping = shippingAmount ?? cart.shipping_total ?? 0;
  const tax = cart.tax_total ?? 0;
  const discount = cart.discount_total ?? 0;
  const promotions = cart.promotions ?? [];
  // Total never goes below zero even if a discount exceeds subtotal+tax+ship.
  const total = Math.max(0, subtotal + shipping + tax - discount);

  const [code, setCode] = useState("");
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleApply = async () => {
    const trimmed = code.trim();
    if (!trimmed || !onApplyCoupon) return;
    setApplying(true);
    setError(null);
    try {
      const result = await onApplyCoupon(trimmed);
      if (result) {
        setError(result);
      } else {
        setCode("");
      }
    } finally {
      setApplying(false);
    }
  };

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

        {/* Coupon / promo code */}
        {onApplyCoupon && (
          <div className="space-y-2">
            {/*
             * Applied promotions. In OmniCart (Medusa v2) a StoreCartPromotion
             * carries no per-promotion amount — the cart-level `discount_total`
             * (shown in the Discount row below) is the source of truth. So we
             * list the applied code(s) with a remove control and let the
             * Discount row report the aggregate savings.
             */}
            {promotions.length > 0 && (
              <ul className="space-y-1.5">
                {promotions
                  .filter((p) => !p.is_automatic && p.code)
                  .map((p) => (
                    <li
                      key={p.id || p.code}
                      className="flex items-center justify-between rounded-md bg-muted/60 px-2.5 py-1.5 text-sm"
                    >
                      <span className="flex items-center gap-1.5 font-medium">
                        <Tag className="h-3.5 w-3.5 text-primary" />
                        {p.code}
                      </span>
                      {onRemoveCoupon && p.code && (
                        <button
                          type="button"
                          onClick={() => onRemoveCoupon(p.code as string)}
                          className="text-muted-foreground hover:text-destructive"
                          aria-label={`Remove ${p.code}`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </li>
                  ))}
              </ul>
            )}
            <div className="flex items-center gap-2">
              <Input
                value={code}
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  setCode(e.target.value);
                  if (error) setError(null);
                }}
                onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void handleApply();
                  }
                }}
                placeholder="Promo code"
                className="h-9"
                aria-label="Promo code"
                disabled={applying}
              />
              <Button
                variant="outline"
                size="sm"
                className="h-9 shrink-0"
                onClick={handleApply}
                disabled={applying || !code.trim()}
              >
                {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
              </Button>
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        )}

        <Separator />

        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal</span>
            <span>{formatAmount(subtotal, currency)}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between items-center bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 font-medium px-2 py-1.5 rounded-md border border-emerald-200/50 dark:border-emerald-900/30">
              <span className="flex items-center gap-1.5 text-xs">
                <Tag className="h-3.5 w-3.5" />
                Discount Applied
              </span>
              <span>−{formatAmount(discount, currency)}</span>
            </div>
          )}
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

        <Separator />

        <div className="pt-2 space-y-3">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Why Choose Us?</p>
          <div className="flex items-start gap-2.5 text-xs text-muted-foreground">
            <span className="text-emerald-600 dark:text-emerald-400 font-bold shrink-0 font-mono">✓</span>
            <div>
              <p className="font-semibold text-foreground">60-Day Satisfaction Guarantee</p>
              <p className="text-[11px] leading-snug">100% money back guarantee if you are not fully satisfied.</p>
            </div>
          </div>
          <div className="flex items-start gap-2.5 text-xs text-muted-foreground">
            <span className="text-emerald-600 dark:text-emerald-400 font-bold shrink-0 font-mono">✓</span>
            <div>
              <p className="font-semibold text-foreground">Over 45,579 Shipped Orders</p>
              <p className="text-[11px] leading-snug">We have successfully processed and shipped orders globally.</p>
            </div>
          </div>
          <div className="flex items-start gap-2.5 text-xs text-muted-foreground">
            <span className="text-emerald-600 dark:text-emerald-400 font-bold shrink-0 font-mono">✓</span>
            <div>
              <p className="font-semibold text-foreground">Secure Payments</p>
              <p className="text-[11px] leading-snug">SSL encrypted checkout ensuring your payment details are secure.</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
