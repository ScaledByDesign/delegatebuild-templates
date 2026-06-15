import { useEffect, useMemo, useState } from "react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  ExpressCheckoutElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { Lock, CreditCard, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatAmount } from "@/lib/omnicart";

/** What a successful charge yields back to the page so it can complete the
 *  cart and thread the saved payment method into the 1-click upsell flow. */
export interface PaymentResult {
  /** Stripe PaymentIntent id (`pi_...`). */
  paymentIntentId: string;
  /** Saved payment method id (`pm_...`) for off-session upsell charges. */
  paymentMethodId?: string;
}

interface PaymentStepProps {
  amount: number;
  currency: string;
  /** Stripe publishable key (from `/api/omnicart-config`). When absent the
   *  step runs in demo mode. */
  stripePublishableKey?: string;
  /** PaymentIntent client secret minted by the OmniCart payment session. When
   *  absent the step runs in demo mode (or shows a spinner while it loads). */
  clientSecret?: string | null;
  /** True while the parent finalizes the order + bootstraps the upsell flow
   *  after `onPaid` resolves (the page then navigates to `/upsell/:sessionId`). */
  busy?: boolean;
  onBack: () => void;
  /** Called once the on-page card / wallet charge succeeds. In demo mode it is
   *  called with no result so the page synthesizes a demo order. */
  onPaid: (result?: PaymentResult) => void;
}

// Cache Stripe.js per publishable key so re-renders don't reload the SDK.
const stripePromiseCache = new Map<string, Promise<Stripe | null>>();
function getStripePromiseForKey(key: string): Promise<Stripe | null> {
  if (!stripePromiseCache.has(key)) stripePromiseCache.set(key, loadStripe(key));
  return stripePromiseCache.get(key)!;
}

/** Pull the saved payment-method id off a confirmed PaymentIntent. */
function paymentMethodIdOf(pi: {
  payment_method?: string | { id?: string } | null;
}): string | undefined {
  const pm = pi.payment_method;
  return typeof pm === "string" ? pm : pm?.id;
}

/**
 * Live card + Apple/Google Pay form rendered inside <Elements>. Ports the
 * proven upw-sendpaylinks StripePayment mechanics: ExpressCheckoutElement for
 * wallets, a divider, then a PaymentElement (tabs) for cards, all confirmed via
 * `stripe.confirmPayment({ redirect: 'if_required' })`.
 */
function StripeCheckoutForm({
  amount,
  currency,
  busy,
  onPaid,
}: {
  amount: number;
  currency: string;
  busy?: boolean;
  onPaid: (result?: PaymentResult) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasExpressCheckout, setHasExpressCheckout] = useState<boolean | null>(null);

  const confirm = async () => {
    if (!stripe || !elements) {
      setError("Payment system not ready. Please try again.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const { error: confirmErr, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: { return_url: window.location.href },
        redirect: "if_required",
      });
      if (confirmErr) {
        setError(confirmErr.message ?? "Payment failed.");
        setSubmitting(false);
        return;
      }
      if (paymentIntent?.status === "succeeded") {
        onPaid({
          paymentIntentId: paymentIntent.id,
          paymentMethodId: paymentMethodIdOf(paymentIntent),
        });
        // Leave `submitting` true: the parent now completes the cart + upsell.
        return;
      }
      setError(`Payment status: ${paymentIntent?.status ?? "unknown"}.`);
      setSubmitting(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unexpected error.");
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Express Checkout: Apple Pay / Google Pay / Link */}
      <div style={{ display: hasExpressCheckout === false ? "none" : undefined }}>
        <ExpressCheckoutElement
          options={{
            buttonHeight: 44,
            buttonType: { applePay: "buy", googlePay: "buy" },
            paymentMethods: { applePay: "always", googlePay: "always", link: "auto" },
            layout: { overflow: "never" },
          }}
          onReady={({ availablePaymentMethods }) => {
            const hasWallets =
              availablePaymentMethods &&
              Object.values(availablePaymentMethods).some(Boolean);
            setHasExpressCheckout(!!hasWallets);
          }}
          onConfirm={confirm}
        />
      </div>

      {hasExpressCheckout !== false && (
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">
              {hasExpressCheckout ? "Or pay with card" : "Pay with card"}
            </span>
          </div>
        </div>
      )}

      <PaymentElement
        options={{ layout: "tabs", wallets: { applePay: "never", googlePay: "never" } }}
      />

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button size="lg" className="w-full" disabled={busy || submitting || !stripe} onClick={confirm}>
        {busy || submitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing…
          </>
        ) : (
          <>
            <Lock className="mr-2 h-4 w-4" /> Pay {formatAmount(amount, currency)}
          </>
        )}
      </Button>

      <p className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
        <Lock className="h-3.5 w-3.5" /> Secured by Stripe
      </p>
    </div>
  );
}

/** Simulated payment used when no Stripe key / client secret is configured. */
function DemoPaymentForm({
  amount,
  currency,
  busy,
  onPaid,
}: {
  amount: number;
  currency: string;
  busy?: boolean;
  onPaid: (result?: PaymentResult) => void;
}) {
  const [submitting, setSubmitting] = useState(false);

  const handlePay = async () => {
    setSubmitting(true);
    // Demo mode simulates a successful charge so the template flows end to end.
    await new Promise((r) => setTimeout(r, 600));
    onPaid();
  };

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
        <p className="flex items-center gap-2 font-medium text-foreground">
          <CreditCard className="h-4 w-4" /> Demo payment
        </p>
        <p className="mt-1">
          No Stripe publishable key / payment session is configured yet, so this
          is a simulated payment. Set <code>STRIPE_PUBLISHABLE_KEY</code> and wire
          an OmniCart backend to enable live card + Apple&nbsp;Pay / Google&nbsp;Pay
          entry via Stripe Elements.
        </p>
      </div>

      <Button size="lg" className="w-full" disabled={busy || submitting} onClick={handlePay}>
        {busy || submitting ? (
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
  stripePublishableKey,
  clientSecret,
  busy = false,
  onBack,
  onPaid,
}: PaymentStepProps) {
  // Live Stripe is available only when BOTH the publishable key and a
  // PaymentIntent client secret (from the OmniCart payment session) are present.
  const stripePromise = useMemo(
    () => (stripePublishableKey ? getStripePromiseForKey(stripePublishableKey) : null),
    [stripePublishableKey],
  );
  const liveStripe = Boolean(stripePromise && clientSecret);

  const elementsOptions = useMemo(
    () =>
      clientSecret
        ? ({
            clientSecret,
            appearance: { theme: "stripe" as const },
          } as const)
        : undefined,
    [clientSecret],
  );

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Payment</h2>
      <Card>
        <CardContent className="py-6">
          {liveStripe && stripePromise && elementsOptions ? (
            <Elements stripe={stripePromise} options={elementsOptions}>
              <StripeCheckoutForm
                amount={amount}
                currency={currency}
                busy={busy}
                onPaid={onPaid}
              />
            </Elements>
          ) : (
            <DemoPaymentForm
              amount={amount}
              currency={currency}
              busy={busy}
              onPaid={onPaid}
            />
          )}
        </CardContent>
      </Card>
      <div className="flex justify-start">
        <Button variant="outline" size="lg" onClick={onBack} disabled={busy}>
          Back to shipping
        </Button>
      </div>
    </div>
  );
}
