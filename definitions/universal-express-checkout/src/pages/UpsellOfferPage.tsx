import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams, useNavigate, Link } from "react-router-dom";
import { Sparkles, Loader2, Check, ShieldCheck, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatAmount } from "@/lib/omnicart";
import { stepUpsellFlow } from "@/lib/upsell-flow";
import {
  loadHandoff,
  updateHandoffSession,
} from "@/lib/checkout-session-store";
import type { FlowNode } from "@/lib/flow-types";

/**
 * Per-offer upsell page — `/upsell/:sessionId?nodeId=<buttonId>`.
 *
 * Mirrors upw-sendpaylinks' `app/upsell/[sessionId]/page.tsx`: every
 * post-purchase upsell offer is its OWN page/route (not a step inside the
 * checkout). The checkout hands off here after payment; this page renders the
 * current Flow Builder node, and Accept/Decline walks the graph by NAVIGATING
 * to the next offer route (`/upsell/:sessionId?nodeId=<next>`) or to the receipt
 * (`/success`). Because each offer is a real route, the builder can author a
 * bespoke, fully-designed page per offer (distinct hero, copy, imagery) while
 * keeping the same Accept/Decline → walk contract. The `?nodeId=`/router-state
 * handoff is this template's equivalent of upw-sendpaylinks' `externalPageUrl`
 * convention (`?sessionId=&nodeId=&flowId=`) for per-offer pages.
 *
 * Accepting charges the SAME saved payment method (one-click) — the parent flow
 * runtime re-resolves the price server-side (anti-tamper). The `?nodeId=`
 * override lets a Decline branch force a specific downsell node.
 *
 * Styling mirrors the platform offer page: gradient backdrop, white offer card
 * with a branded header, an optional countdown bar, a prominent green Accept
 * CTA (single, multi-accept, or compare-at), a low-emphasis Decline link, and
 * trust badges.
 */
export function UpsellOfferPage() {
  const { sessionId = "" } = useParams<{ sessionId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const nodeIdParam = searchParams.get("nodeId");

  // Rehydrate the paid order + flow session persisted at checkout handoff.
  const handoff = useMemo(() => loadHandoff(sessionId), [sessionId]);

  const [submitting, setSubmitting] = useState<"accept" | "decline" | null>(null);

  // Resolve the node to render. The handoff stores the flow session cursor; the
  // entry offer arrives with ?nodeId, and each subsequent step navigates with
  // the next node id. We keep a local copy of the node so the card renders
  // immediately on navigation.
  const [node, setNode] = useState<FlowNode | null>(null);
  const [offerIndex, setOfferIndex] = useState(1);

  useEffect(() => {
    // The node object travels in router state when we navigate between offers
    // (set below in handleStep). On the first load (entry), or a hard refresh,
    // fall back to the demo flow's node table via stepUpsellFlow's session.
    const stateNode = (window.history.state?.usr?.node ?? null) as FlowNode | null;
    const stateIndex = (window.history.state?.usr?.offerIndex ?? 1) as number;
    if (stateNode && (!nodeIdParam || stateNode.id === nodeIdParam)) {
      setNode(stateNode);
      setOfferIndex(stateIndex);
    }
  }, [nodeIdParam]);

  const options = node?.accept_options ?? [];
  const isMultiAccept = options.length > 0;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  useEffect(() => {
    if (isMultiAccept) {
      setSelectedId(options.find((o) => o.ctaText)?.id ?? options[0]!.id);
    } else {
      setSelectedId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node?.id]);

  const selected = useMemo(
    () => (isMultiAccept ? options.find((o) => o.id === selectedId) ?? options[0] : null),
    [isMultiAccept, options, selectedId],
  );
  const price = isMultiAccept ? selected?.price ?? 0 : node?.display_price ?? 0;
  const compareAt = isMultiAccept ? selected?.compareAtPrice ?? null : node?.compare_at_price ?? null;
  const currency = node?.currency_code || "usd";
  const savings = compareAt && compareAt > price ? compareAt - price : 0;
  const pctOff = compareAt && compareAt > 0 ? Math.round((savings / compareAt) * 100) : 0;

  // Decorative client countdown. The server enforces the real timer and
  // auto-declines a late accept; this just nudges urgency.
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  useEffect(() => {
    setSecondsLeft(node?.timer ?? null);
    if (!node?.timer) return;
    const t = setInterval(() => {
      setSecondsLeft((s) => (s === null ? null : Math.max(0, s - 1)));
    }, 1000);
    return () => clearInterval(t);
  }, [node?.id, node?.timer]);

  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  // Accept/Decline → walk the graph, then NAVIGATE to the next offer route or
  // to the success receipt. Mirrors upw-sendpaylinks' /api/upsell/accept|decline
  // → handleNextStep branching (hasMoreOffers | showDownsell | completion).
  const handleStep = async (action: "accept" | "decline") => {
    if (!handoff) return;
    setSubmitting(action);
    try {
      const result = await stepUpsellFlow({
        session: handoff.session,
        action,
        variantId: action === "accept" && isMultiAccept ? selectedId : null,
      });
      updateHandoffSession(sessionId, result.session);

      // A card decline on accept: stay on the same offer so the customer can
      // retry or decline. (A production page would surface payment_error.)
      if (action === "accept" && result.payment_error) {
        setSubmitting(null);
        return;
      }

      if (result.is_terminal || !result.next_node) {
        navigate(`/success?session=${encodeURIComponent(sessionId)}`);
        return;
      }
      // Navigate to the NEXT offer page (its own route), carrying the node in
      // router state so it renders without a backend re-fetch.
      navigate(
        `/upsell/${encodeURIComponent(sessionId)}?nodeId=${encodeURIComponent(result.next_node.id)}`,
        { state: { node: result.next_node, offerIndex: offerIndex + 1 } },
      );
    } finally {
      setSubmitting(null);
    }
  };

  // No handoff (e.g. someone opened /upsell/:sessionId directly) → friendly error.
  if (!handoff) {
    return (
      <ErrorShell message="We couldn't find your upsell session.">
        <Link to="/" className="text-sm font-medium text-primary underline">
          Start a new order →
        </Link>
      </ErrorShell>
    );
  }

  // Handoff present but the offer node isn't resolved (hard refresh on a deep
  // link) → send the customer to their receipt rather than a blank offer.
  if (!node) {
    return (
      <ErrorShell message="This offer is no longer available.">
        <Link
          to={`/success?session=${encodeURIComponent(sessionId)}`}
          className="text-sm font-medium text-primary underline"
        >
          View your order →
        </Link>
      </ErrorShell>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-slate-900 dark:to-background">
      {/* Countdown bar — purely visual; the server enforces the real timer. */}
      {secondsLeft !== null && secondsLeft > 0 && (
        <div className="bg-red-100 py-2 text-center text-sm font-semibold text-red-800 dark:bg-red-950/40 dark:text-red-300">
          <Clock className="mr-1 inline h-4 w-4" /> This offer expires in {mmss(secondsLeft)}
        </div>
      )}

      <div className="mx-auto max-w-2xl px-4 py-8">
        {/* Payment-confirmed affordance + offer counter */}
        <div className="mb-4 flex items-center justify-between text-sm font-medium">
          <span className="flex items-center gap-2 text-primary">
            <Check className="h-4 w-4" /> Payment confirmed
          </span>
          <span className="text-xs text-muted-foreground">Exclusive offer {offerIndex}</span>
        </div>

        <Card className="overflow-hidden border-primary/30 shadow-xl">
          {/* Branded header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-6 text-center text-white">
            <p className="mb-1 text-xs uppercase tracking-wide text-blue-100">
              Wait — don&apos;t miss this
            </p>
            <h1 className="text-2xl font-bold leading-tight">{node.label}</h1>
            <p className="mt-1 text-sm text-blue-100">Available only right now, on this order.</p>
          </div>

          <CardContent className="space-y-5 py-6">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold">{node.button_text}</h2>
                  {pctOff > 0 && <Badge variant="secondary">{pctOff}% off</Badge>}
                </div>
                {node.pitch && (
                  <p className="mt-1 text-sm text-muted-foreground">{node.pitch}</p>
                )}
              </div>
            </div>

            {/* Multi-accept selector (e.g. 1 / 2 / 3 packs). */}
            {isMultiAccept && (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
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

            {/* Single-offer price */}
            {!isMultiAccept && (
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-bold text-green-600 dark:text-green-500">
                  {formatAmount(price, currency)}
                </span>
                {savings > 0 && (
                  <span className="text-lg text-muted-foreground line-through">
                    {formatAmount(compareAt!, currency)}
                  </span>
                )}
              </div>
            )}

            {/* One-click notice */}
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 dark:border-yellow-900/40 dark:bg-yellow-950/20">
              <p className="text-sm text-yellow-800 dark:text-yellow-300">
                ⚡ <strong>One-click purchase:</strong> charged to the payment method you just
                used. No need to re-enter card details.
              </p>
            </div>

            {/* CTAs */}
            <div className="flex flex-col gap-2">
              <Button
                size="lg"
                className="bg-green-600 text-base font-bold hover:bg-green-700"
                disabled={submitting !== null}
                onClick={() => handleStep("accept")}
              >
                {submitting === "accept" ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Adding to order…
                  </>
                ) : (
                  <>
                    ✓ {node.button_text} — {formatAmount(price, currency)}
                  </>
                )}
              </Button>
              <button
                type="button"
                className="py-2 text-center text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
                disabled={submitting !== null}
                onClick={() => handleStep("decline")}
              >
                {submitting === "decline" ? "…" : node.decline_text || "No thanks, I'll pass"}
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Trust badges */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
          <span>🔒 Secure Checkout</span>
          <span>💳 Same Payment Method</span>
          <span>📦 Ships Together</span>
        </div>
      </div>
    </div>
  );
}

/** Centered error/notice shell matching the platform's /u error styling. */
function ErrorShell({
  message,
  children,
}: {
  message: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-md">
        <CardContent className="space-y-3 py-8 text-center">
          <h1 className="text-xl font-bold">{message}</h1>
          {children}
        </CardContent>
      </Card>
    </div>
  );
}
