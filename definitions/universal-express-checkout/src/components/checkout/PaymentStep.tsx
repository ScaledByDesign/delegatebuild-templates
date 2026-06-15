import { useEffect, useMemo, useState } from "react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { Lock, CreditCard, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatAmount } from "@/lib/omnicart";

interface PaymentStepProps {
  amount: number;
  currency: string;
  /** True while the parent finalizes the order + bootstraps the upsell flow
   *  after `onPaid` resolves (the page then navigates to `/upsell/:sessionId`). */
  busy?: boolean;
  isAddressValid: boolean;
  onPaid: () => void;
  onInvalidAddress: () => void;
}

interface ConfigResponse {
  success: boolean;
  data?: { stripePublishableKey: string; backendConfigured: boolean };
}

/** Inner card form rendered inside <Elements>. Falls back to a demo button. */
function PaymentForm({
  amount,
  currency,
  hasStripe,
  isAddressValid,
  onPaid,
  onInvalidAddress,
}: {
  amount: number;
  currency: string;
  hasStripe: boolean;
  isAddressValid: boolean;
  onPaid: () => void;
  onInvalidAddress: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePay = async () => {
    if (!isAddressValid) {
      onInvalidAddress();
      setError("Please fill out all required shipping fields first.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      if (hasStripe && stripe && elements) {
        const { error: submitErr } = await elements.submit();
        if (submitErr) {
          setError(submitErr.message ?? "Payment could not be processed.");
          setSubmitting(false);
          return;
        }
      }
      // In a wired backend, complete the OmniCart cart here via the omnicart
      // client after confirming the Stripe payment. Demo mode simulates success.
      await new Promise((r) => setTimeout(r, 600));
      onPaid();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unexpected error.");
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {hasStripe ? (
        <PaymentElement />
      ) : (
        <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
          <p className="flex items-center gap-2 font-medium text-foreground">
            <CreditCard className="h-4 w-4" /> Demo payment
          </p>
          <p className="mt-1">
            No Stripe publishable key is configured yet, so this is a simulated
            payment. Set <code>STRIPE_PUBLISHABLE_KEY</code> to enable live card
            entry via Stripe Elements.
          </p>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button
        size="lg"
        className="w-full"
        disabled={submitting}
        onClick={handlePay}
      >
        {submitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing…
          </>
        ) : (
          <>
            <Lock className="mr-2 h-4 w-4" /> Pay {formatAmount(amount, currency)}
          </>
        )}
      </Button>
    </div>
  );
}

/** Step 3 — Stripe-powered payment for the OmniCart checkout. */
export function PaymentStep({
  amount,
  currency,
  busy = false,
  isAddressValid,
  onPaid,
  onInvalidAddress,
}: PaymentStepProps) {
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch("/api/omnicart-config")
      .then((r) => r.json() as Promise<ConfigResponse>)
      .then((cfg) => {
        if (!active) return;
        const key = cfg.data?.stripePublishableKey;
        if (key) setStripePromise(loadStripe(key));
      })
      .catch(() => {
        /* fall back to demo mode */
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const options = useMemo(
    () => ({ mode: "payment" as const, amount, currency }),
    [amount, currency],
  );
  const hasStripe = Boolean(stripePromise);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Payment</h2>
      <Card>
        <CardContent className="py-6">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Preparing secure payment…
            </div>
          ) : hasStripe && stripePromise ? (
            <Elements stripe={stripePromise} options={options}>
              <PaymentForm
                amount={amount}
                currency={currency}
                hasStripe
                isAddressValid={isAddressValid}
                onPaid={onPaid}
                onInvalidAddress={onInvalidAddress}
              />
            </Elements>
          ) : (
            <PaymentForm
              amount={amount}
              currency={currency}
              hasStripe={false}
              isAddressValid={isAddressValid}
              onPaid={onPaid}
              onInvalidAddress={onInvalidAddress}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
