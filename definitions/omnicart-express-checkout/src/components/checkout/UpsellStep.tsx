import { useState } from "react";
import { Sparkles, Loader2, Check, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatAmount } from "@/lib/omnicart";
import type { UpsellOffer } from "@/lib/checkout-types";

interface UpsellStepProps {
  offer: UpsellOffer;
  currency: string;
  /** Called when the customer accepts the one-click offer. */
  onAccept: (offer: UpsellOffer) => Promise<void> | void;
  /** Called when the customer declines and proceeds to confirmation. */
  onDecline: () => void;
}

/**
 * Post-purchase one-click upsell.
 *
 * Shown after the payment method is captured. Accepting charges the *same*
 * saved payment method for the extra item (no re-entering card details) and
 * appends it to the existing OmniCart order. In a wired backend, `onAccept`
 * should call the OmniCart API to add the upsell variant to the order using
 * the stored payment session.
 */
export function UpsellStep({ offer, currency, onAccept, onDecline }: UpsellStepProps) {
  const [submitting, setSubmitting] = useState(false);
  const savings = offer.original_price - offer.offer_price;
  const pctOff =
    offer.original_price > 0
      ? Math.round((savings / offer.original_price) * 100)
      : 0;

  const handleAccept = async () => {
    setSubmitting(true);
    try {
      await onAccept(offer);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-primary">
        <Check className="h-4 w-4" /> Payment confirmed
      </div>

      <Card className="border-primary/40">
        <CardContent className="space-y-5 py-6">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold">Wait — one exclusive offer</h2>
                {pctOff > 0 && (
                  <Badge variant="secondary">{pctOff}% off</Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                Available only right now, on this order.
              </p>
            </div>
          </div>

          <div className="rounded-lg border bg-muted/30 p-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div>
                <p className="font-medium">{offer.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{offer.pitch}</p>
              </div>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-2xl font-semibold">
                {formatAmount(offer.offer_price, currency)}
              </span>
              {savings > 0 && (
                <span className="text-sm text-muted-foreground line-through">
                  {formatAmount(offer.original_price, currency)}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              size="lg"
              className="flex-1"
              disabled={submitting}
              onClick={handleAccept}
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Adding to order…
                </>
              ) : (
                <>Yes, add it — one click</>
              )}
            </Button>
            <Button
              variant="ghost"
              size="lg"
              className="flex-1"
              disabled={submitting}
              onClick={onDecline}
            >
              No thanks
            </Button>
          </div>

          <p className="text-center text-xs text-muted-foreground">
            Charged to the payment method you just used. No need to re-enter card details.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
