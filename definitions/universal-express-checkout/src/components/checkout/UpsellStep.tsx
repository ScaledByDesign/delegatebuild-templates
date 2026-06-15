import { useEffect, useMemo, useState } from "react";
import { Sparkles, Loader2, Check, ShieldCheck, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatAmount } from "@/lib/omnicart";
import type { FlowNode } from "@/lib/flow-types";

interface UpsellStepProps {
  /** The current flow node (offer) to render. */
  node: FlowNode;
  /** 1-based position in the journey (for "Offer 2 of N" style affordance). */
  offerIndex: number;
  /** Called when the customer accepts. `variantId` is set for multi-accept nodes. */
  onAccept: (variantId: string | null) => Promise<void> | void;
  /** Called when the customer declines and the flow walks the decline branch. */
  onDecline: () => Promise<void> | void;
}

/**
 * Post-purchase one-click upsell — Flow Builder node renderer.
 *
 * Renders ANY node in the merchant's upsell flow: single-offer or multi-accept
 * (1/2/3 packs), with optional compare-at price and a server-enforced timer.
 * Accepting charges the *same* saved payment method (no re-entering card
 * details); the parent page walks the flow graph to the next node or to the
 * confirmation screen. This component is stateless about the graph — it only
 * renders the current node and reports the accept/decline outcome.
 */
export function UpsellStep({ node, offerIndex, onAccept, onDecline }: UpsellStepProps) {
  const [submitting, setSubmitting] = useState<"accept" | "decline" | null>(null);
  const options = node.accept_options ?? [];
  const isMultiAccept = options.length > 0;

  // Default-select the option flagged best value, else the first.
  const [selectedId, setSelectedId] = useState<string | null>(
    isMultiAccept ? (options.find((o) => o.ctaText)?.id ?? options[0]!.id) : null,
  );

  // Resolve the displayed price + compare-at from the selection (multi-accept)
  // or the node itself (single-offer).
  const selected = useMemo(
    () => (isMultiAccept ? options.find((o) => o.id === selectedId) ?? options[0] : null),
    [isMultiAccept, options, selectedId],
  );
  const price = isMultiAccept ? selected?.price ?? 0 : node.display_price ?? 0;
  const compareAt = isMultiAccept ? selected?.compareAtPrice ?? null : node.compare_at_price ?? null;
  const currency = node.currency_code || "usd";
  const savings = compareAt && compareAt > price ? compareAt - price : 0;
  const pctOff = compareAt && compareAt > 0 ? Math.round((savings / compareAt) * 100) : 0;

  // Decorative client countdown. The server enforces the real timer and
  // auto-declines a late accept; this just nudges urgency.
  const [secondsLeft, setSecondsLeft] = useState<number | null>(node.timer ?? null);
  useEffect(() => {
    setSecondsLeft(node.timer ?? null);
    if (!node.timer) return;
    const t = setInterval(() => {
      setSecondsLeft((s) => (s === null ? null : Math.max(0, s - 1)));
    }, 1000);
    return () => clearInterval(t);
  }, [node.id, node.timer]);

  const handleAccept = async () => {
    setSubmitting("accept");
    try {
      await onAccept(isMultiAccept ? selectedId : null);
    } finally {
      setSubmitting(null);
    }
  };

  const handleDecline = async () => {
    setSubmitting("decline");
    try {
      await onDecline();
    } finally {
      setSubmitting(null);
    }
  };

  const mmss = (s: number) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm font-medium text-primary">
        <span className="flex items-center gap-2">
          <Check className="h-4 w-4" /> Payment confirmed
        </span>
        {offerIndex > 0 && (
          <span className="text-xs text-muted-foreground">Exclusive offer {offerIndex}</span>
        )}
      </div>

      <Card className="border-primary/40">
        <CardContent className="space-y-5 py-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold">{node.label}</h2>
                  {pctOff > 0 && <Badge variant="secondary">{pctOff}% off</Badge>}
                </div>
                <p className="text-sm text-muted-foreground">
                  Available only right now, on this order.
                </p>
              </div>
            </div>
            {secondsLeft !== null && secondsLeft > 0 && (
              <span className="flex shrink-0 items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                <Clock className="h-3.5 w-3.5" /> {mmss(secondsLeft)}
              </span>
            )}
          </div>

          <div className="rounded-lg border bg-muted/30 p-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div>
                <p className="font-medium">{node.button_text}</p>
                {node.pitch && (
                  <p className="mt-1 text-sm text-muted-foreground">{node.pitch}</p>
                )}
              </div>
            </div>

            {/* Multi-accept selector (e.g. 1 / 2 / 3 packs). */}
            {isMultiAccept && (
              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
                {options.map((opt) => {
                  const active = opt.id === selectedId;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setSelectedId(opt.id)}
                      className={cn(
                        "flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors",
                        active
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "border-muted-foreground/20 hover:border-primary/40",
                      )}
                    >
                      <div className="flex w-full items-center justify-between">
                        <span className="text-sm font-medium">{opt.label}</span>
                        {opt.ctaText && <Badge variant="secondary">{opt.ctaText}</Badge>}
                      </div>
                      <span className="text-base font-semibold">
                        {formatAmount(opt.price, currency)}
                      </span>
                      {opt.compareAtPrice && opt.compareAtPrice > opt.price && (
                        <span className="text-xs text-muted-foreground line-through">
                          {formatAmount(opt.compareAtPrice, currency)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {!isMultiAccept && (
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-2xl font-semibold">{formatAmount(price, currency)}</span>
                {savings > 0 && (
                  <span className="text-sm text-muted-foreground line-through">
                    {formatAmount(compareAt!, currency)}
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              size="lg"
              className="flex-1"
              disabled={submitting !== null}
              onClick={handleAccept}
            >
              {submitting === "accept" ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Adding to order…
                </>
              ) : isMultiAccept ? (
                <>{node.button_text} — {formatAmount(price, currency)}</>
              ) : (
                <>{node.button_text}</>
              )}
            </Button>
            <Button
              variant="ghost"
              size="lg"
              className="flex-1"
              disabled={submitting !== null}
              onClick={handleDecline}
            >
              {submitting === "decline" ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> …
                </>
              ) : (
                <>{node.decline_text || "No thanks"}</>
              )}
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
