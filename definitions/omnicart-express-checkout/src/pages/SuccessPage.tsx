import { useEffect, useMemo } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { CheckCircle2, Package, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatAmount } from "@/lib/omnicart";
import { loadHandoff, clearHandoff } from "@/lib/checkout-session-store";

/**
 * Order confirmation / receipt — `/success?session=<sessionId>`.
 *
 * Mirrors upw-sendpaylinks' `app/success/page.tsx` (the `successUrl` /
 * `completionRedirectUrl` target): after the upsell flow reaches a terminal
 * node (or the order had no upsells), the customer lands here. It shows the
 * paid base order PLUS the upsell journey — every accepted offer from
 * `session.journey` with its charge — and the cumulative grand total
 * (`session.total_revenue`), exactly like the platform receipt's journey table.
 *
 * The handoff is read once, rendered, then cleared (mirror of a server marking
 * the session consumed). When a real OmniCart backend is wired, replace the
 * sessionStorage read with a fetch to `/api/upsell/session/:sessionId` (or the
 * order receipt endpoint) — the rendering contract is identical.
 */
export function SuccessPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const sessionId = searchParams.get("session") || "";

  const handoff = useMemo(() => loadHandoff(sessionId), [sessionId]);

  // Mirror server "session consumed": drop the handoff after we've rendered it
  // so a back-nav / refresh can't replay the upsell flow.
  useEffect(() => {
    if (sessionId && handoff) {
      const t = setTimeout(() => clearHandoff(sessionId), 0);
      return () => clearTimeout(t);
    }
  }, [sessionId, handoff]);

  if (!handoff) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
        <Card className="w-full max-w-md">
          <CardContent className="space-y-3 py-10 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-primary" />
            <h1 className="text-xl font-bold">Your order is confirmed</h1>
            <p className="text-sm text-muted-foreground">
              A confirmation has been sent to your email.
            </p>
            <Link to="/" className="text-sm font-medium text-primary underline">
              Start a new order →
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { order, session } = handoff;
  const currency = order.currency_code || session.currency_code || "usd";
  // Accepted upsell steps from the journey (mirror of the receipt journey table).
  const acceptedUpsells = session.journey.filter(
    (s) => s.action === "success" && s.revenue > 0,
  );
  const grandTotal = session.total_revenue || order.total;

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white px-4 py-10 dark:from-slate-900 dark:to-background">
      <div className="mx-auto max-w-2xl space-y-4">
        {/* Confirmation header */}
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <CheckCircle2 className="h-12 w-12 text-primary" />
            <h1 className="text-2xl font-bold">Thank you for your order</h1>
            <p className="text-sm text-muted-foreground">
              A confirmation has been sent to{" "}
              <span className="font-medium text-foreground">{order.email}</span>.
            </p>
            <p className="text-xs text-muted-foreground">
              Order ID: <span className="font-mono">{order.id}</span>
            </p>
          </CardContent>
        </Card>

        {/* Base order */}
        <Card>
          <CardContent className="space-y-3 py-6">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Package className="h-4 w-4" /> Your order
            </h2>
            <ul className="space-y-2">
              {order.items.map((item) => (
                <li key={item.id} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {item.quantity}× {item.title}
                  </span>
                  <span className="font-medium">
                    {formatAmount(item.unit_price * item.quantity, currency)}
                  </span>
                </li>
              ))}
            </ul>
            <Separator />
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Order total</span>
              <span className="font-medium">{formatAmount(order.total, currency)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Upsell journey — only when at least one offer was accepted. */}
        {acceptedUpsells.length > 0 && (
          <Card>
            <CardContent className="space-y-3 py-6">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <ShieldCheck className="h-4 w-4" /> Added to your order
              </h2>
              <ul className="space-y-2">
                {acceptedUpsells.map((step, i) => (
                  <li
                    key={`${step.button_id}_${i}`}
                    className="flex justify-between text-sm"
                  >
                    <span className="text-muted-foreground">{step.button_text}</span>
                    <span className="font-medium text-green-600 dark:text-green-500">
                      {formatAmount(step.revenue, currency)}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Grand total (base order + accepted upsells). */}
        <Card className="border-primary/30">
          <CardContent className="flex items-center justify-between py-5">
            <span className="text-base font-semibold">Grand total</span>
            <span className="text-xl font-bold">{formatAmount(grandTotal, currency)}</span>
          </CardContent>
        </Card>

        <div className="pt-2 text-center">
          <Button variant="outline" onClick={() => navigate("/")}>
            Start a new order
          </Button>
        </div>
      </div>
    </div>
  );
}
