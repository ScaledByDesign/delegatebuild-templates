import { useMemo, useState } from "react";
import { ShoppingCart } from "lucide-react";
import { CheckoutSteps } from "@/components/checkout/CheckoutSteps";
import { OrderSummary } from "@/components/checkout/OrderSummary";
import { CartStep } from "@/components/checkout/CartStep";
import { ShippingStep } from "@/components/checkout/ShippingStep";
import { PaymentStep } from "@/components/checkout/PaymentStep";
import { UpsellStep } from "@/components/checkout/UpsellStep";
import { ConfirmationStep } from "@/components/checkout/ConfirmationStep";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  applyDiscount,
  removeDiscount,
  type OmniCart,
  type OmniCartDiscount,
} from "@/lib/omnicart";
import {
  DEMO_CART,
  EMPTY_ADDRESS,
  cartSubtotal,
  resolveDemoCoupon,
  type CheckoutStepId,
  type OrderSummary as OrderSummaryData,
  type ShippingAddress,
  type ShippingOption,
} from "@/lib/checkout-types";
import {
  startUpsellFlow,
  stepUpsellFlow,
} from "@/lib/upsell-flow";
import type { FlowNode, FlowSession } from "@/lib/flow-types";

const SHIPPING_OPTIONS: ShippingOption[] = [
  { id: "ship_standard", name: "Standard (5–7 days)", amount: 0 },
  { id: "ship_express", name: "Express (2–3 days)", amount: 1200 },
  { id: "ship_overnight", name: "Overnight", amount: 2500 },
];

/**
 * OmniCart Express Checkout — single-page guided checkout with a Flow Builder
 * driven post-purchase upsell sequence.
 *
 * OmniCart is the whitelabel commerce brand; it is powered internally by the
 * Medusa commerce framework. Wire the `omnicart` client (src/lib/omnicart.ts)
 * to a live OmniCart backend to replace the demo cart and shipping options, and
 * wire the OmniCart Flow Builder runtime (src/lib/upsell-flow.ts) to drive the
 * real multi-offer upsell graph after payment.
 *
 * Post-payment flow:
 *   payment captured → start upsell session → render current flow node →
 *   Accept (1-click charge, walk success branch) / Decline (walk decline
 *   branch) → repeat until a terminal node → confirmation.
 */
export function CheckoutPage() {
  const [step, setStep] = useState<CheckoutStepId>("cart");
  const [cart, setCart] = useState<OmniCart>(DEMO_CART);
  // Applied coupon codes (mirrors cart.discounts; kept in page state so the
  // demo fallback can re-resolve discount amounts as quantities change).
  const [discounts, setDiscounts] = useState<OmniCartDiscount[]>([]);
  const [address, setAddress] = useState<ShippingAddress>(EMPTY_ADDRESS);
  const [shippingOptionId, setShippingOptionId] = useState<string>(SHIPPING_OPTIONS[0].id);
  const [order, setOrder] = useState<OrderSummaryData | null>(null);

  // ── Upsell flow state ──────────────────────────────────────────────────────
  // The session is the runtime cursor; `flowNode` is the offer currently shown.
  // `offerIndex` is a 1-based counter for the "Exclusive offer N" affordance.
  const [flowSession, setFlowSession] = useState<FlowSession | null>(null);
  const [flowNode, setFlowNode] = useState<FlowNode | null>(null);
  const [offerIndex, setOfferIndex] = useState(0);

  const shippingAmount = useMemo(
    () => SHIPPING_OPTIONS.find((o) => o.id === shippingOptionId)?.amount ?? 0,
    [shippingOptionId],
  );

  const currency = cart.currency_code || "usd";

  const updateQuantity = (itemId: string, quantity: number) => {
    setCart((prev) => ({
      ...prev,
      items: prev.items.map((i) => (i.id === itemId ? { ...i, quantity } : i)),
    }));
  };

  const removeItem = (itemId: string) => {
    setCart((prev) => ({
      ...prev,
      items: prev.items.filter((i) => i.id !== itemId),
    }));
  };

  // Discount total = sum of applied coupons, re-resolved against the current
  // subtotal in demo mode (a wired backend supplies authoritative amounts).
  const subtotalAmount = useMemo(() => cartSubtotal(cart.items), [cart.items]);
  const taxAmount = useMemo(
    () => cart.tax_total ?? Math.round(subtotalAmount * 0.08),
    [cart.tax_total, subtotalAmount],
  );
  const discountAmount = useMemo(
    () => Math.min(subtotalAmount, discounts.reduce((sum, d) => sum + d.amount, 0)),
    [discounts, subtotalAmount],
  );

  const grandTotal = useMemo(
    () => Math.max(0, subtotalAmount + shippingAmount + taxAmount - discountAmount),
    [subtotalAmount, shippingAmount, taxAmount, discountAmount],
  );

  // ── Coupon handlers ─────────────────────────────────────────────────────--
  // Apply: try the wired OmniCart backend first; if it isn't configured (503
  // demo signal) or unreachable, fall back to the in-template demo coupon table
  // so the field is interactive out of the box. Returns an error string on
  // failure (consumed by OrderSummary), or null on success.
  const handleApplyCoupon = async (raw: string): Promise<string | null> => {
    const code = raw.trim().toUpperCase();
    if (discounts.some((d) => d.code === code)) return "That code is already applied.";

    const result = await applyDiscount(cart.id, code);
    if (result.ok && result.cart) {
      // Backend is the source of truth: adopt its cart + discounts.
      setCart(result.cart);
      setDiscounts(result.cart.discounts ?? []);
      return null;
    }

    // Demo fallback (no backend wired).
    const amount = resolveDemoCoupon(code, subtotalAmount);
    if (amount === null || amount <= 0) return "That code isn’t valid.";
    setDiscounts((prev) => [...prev, { id: code, code, amount }]);
    return null;
  };

  const handleRemoveCoupon = async (code: string) => {
    const result = await removeDiscount(cart.id, code);
    if (result.ok && result.cart) {
      setCart(result.cart);
      setDiscounts(result.cart.discounts ?? []);
      return;
    }
    setDiscounts((prev) => prev.filter((d) => d.code !== code));
  };

  // Advance to confirmation, reconciling the order total + line items with the
  // accepted upsells recorded in the flow session journey.
  const finishToConfirmation = (session: FlowSession | null, baseOrder: OrderSummaryData) => {
    if (!session) {
      setOrder(baseOrder);
    } else {
      // Append a synthetic line per accepted (revenue > 0) journey step so the
      // receipt reflects every one-click add-on charged during the flow.
      const upsellItems = session.journey
        .filter((j) => j.action === "success" && j.revenue > 0)
        .map((j, idx) => ({
          id: `${j.button_id}_${idx}`,
          title: j.button_text,
          quantity: 1,
          unit_price: j.revenue,
          thumbnail: null,
          variant: { id: j.button_id, title: "One-click add-on" },
        }));
      // One-click upsell add-ons are charged at their displayed price (no
      // extra tax/shipping in the demo), so fold their revenue into both the
      // subtotal and the charged total to keep the receipt math coherent.
      const upsellTotal = upsellItems.reduce((sum, i) => sum + i.unit_price, 0);
      setOrder({
        ...baseOrder,
        subtotal: baseOrder.subtotal + upsellTotal,
        total: session.total_revenue,
        items: [...baseOrder.items, ...upsellItems],
      });
    }
    setFlowNode(null);
    setStep("confirmation");
  };

  // Payment captured: create the order, then start the Flow Builder upsell
  // sequence. If the flow has no offers, skip straight to confirmation.
  const handlePaid = async () => {
    const baseOrder: OrderSummaryData = {
      id: `order_${Math.random().toString(36).slice(2, 10)}`,
      email: address.email || "customer@example.com",
      subtotal: subtotalAmount,
      shipping_total: shippingAmount,
      tax_total: taxAmount,
      discount_total: discountAmount,
      total: grandTotal,
      currency_code: currency,
      items: cart.items,
      discounts,
    };
    setOrder(baseOrder);

    const { session, entry_node } = await startUpsellFlow({
      orderId: baseOrder.id,
      originalOrderTotal: grandTotal,
      currencyCode: currency,
    });
    setFlowSession(session);

    if (entry_node && session.current_button_id) {
      setFlowNode(entry_node);
      setOfferIndex(1);
      setStep("upsell");
    } else {
      finishToConfirmation(session, baseOrder);
    }
  };

  // Accept the current offer: charge the saved payment method (1-click) and
  // walk the success branch. Decline walks the decline branch. Either way we
  // render the next node or advance to confirmation on a terminal node.
  const handleFlowStep = async (action: "accept" | "decline", variantId: string | null) => {
    if (!flowSession || !order) return;
    const result = await stepUpsellFlow({ session: flowSession, action, variantId });
    setFlowSession(result.session);

    // A card decline on accept: keep the customer on the same offer so they can
    // retry or decline. (A production page may surface result.payment_error.)
    if (action === "accept" && result.payment_error) {
      return;
    }

    if (result.is_terminal || !result.next_node) {
      finishToConfirmation(result.session, order);
      return;
    }
    setFlowNode(result.next_node);
    setOfferIndex((n) => n + 1);
  };

  const startOver = () => {
    setCart(DEMO_CART);
    setDiscounts([]);
    setAddress(EMPTY_ADDRESS);
    setShippingOptionId(SHIPPING_OPTIONS[0].id);
    setOrder(null);
    setFlowSession(null);
    setFlowNode(null);
    setOfferIndex(0);
    setStep("cart");
  };

  // Cart with current shipping/tax/discount reflected for the summary card.
  const summaryCart: OmniCart = useMemo(
    () => ({
      ...cart,
      subtotal: subtotalAmount,
      shipping_total: shippingAmount,
      tax_total: taxAmount,
      discount_total: discountAmount,
      discounts,
    }),
    [cart, subtotalAmount, shippingAmount, taxAmount, discountAmount, discounts],
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-primary" />
            <span className="text-lg font-semibold">OmniCart</span>
            <span className="text-sm text-muted-foreground">Express Checkout</span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-8">
          <CheckoutSteps current={step} />
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_360px]">
          <section>
            {step === "cart" && (
              <CartStep
                cart={cart}
                onUpdateQuantity={updateQuantity}
                onRemove={removeItem}
                onContinue={() => setStep("shipping")}
              />
            )}
            {step === "shipping" && (
              <ShippingStep
                address={address}
                options={SHIPPING_OPTIONS}
                selectedOptionId={shippingOptionId}
                currency={currency}
                onChangeAddress={setAddress}
                onSelectOption={setShippingOptionId}
                onBack={() => setStep("cart")}
                onContinue={() => setStep("payment")}
              />
            )}
            {step === "payment" && (
              <PaymentStep
                amount={grandTotal}
                currency={currency}
                onBack={() => setStep("shipping")}
                onPaid={handlePaid}
              />
            )}
            {step === "upsell" && flowNode && (
              <UpsellStep
                node={flowNode}
                offerIndex={offerIndex}
                onAccept={(variantId) => handleFlowStep("accept", variantId)}
                onDecline={() => handleFlowStep("decline", null)}
              />
            )}
            {step === "confirmation" && order && (
              <ConfirmationStep order={order} onStartOver={startOver} />
            )}
          </section>

          {step !== "confirmation" && step !== "upsell" && (
            <aside>
              <OrderSummary
                cart={summaryCart}
                shippingAmount={shippingAmount}
                onApplyCoupon={handleApplyCoupon}
                onRemoveCoupon={handleRemoveCoupon}
              />
            </aside>
          )}
        </div>
      </main>
    </div>
  );
}
