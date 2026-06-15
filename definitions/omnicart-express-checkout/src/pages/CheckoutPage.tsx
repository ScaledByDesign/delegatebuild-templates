import { useEffect, useMemo, useState } from "react";
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
  createCart,
  addLineItem,
  updateLineItem,
  removeLineItem,
  updateCartContact,
  listShippingOptions,
  addShippingMethod,
  listPaymentProviders,
  createPaymentCollection,
  initPaymentSession,
  completeCart,
  type OmniCart,
  type OmniCartPromotion,
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

// Demo shipping options used when no OmniCart backend is configured. Once a
// live backend is wired, these are replaced at the shipping step by the real
// options returned from `listShippingOptions(cart.id)`.
const DEMO_SHIPPING_OPTIONS: ShippingOption[] = [
  { id: "ship_standard", name: "Standard (5-7 days)", amount: 0 },
  { id: "ship_express", name: "Express (2-3 days)", amount: 1200 },
  { id: "ship_overnight", name: "Overnight", amount: 2500 },
];

/**
 * OmniCart Express Checkout - single-page guided checkout with a Flow Builder
 * driven post-purchase upsell sequence.
 *
 * OmniCart is the whitelabel commerce brand; it is powered internally by the
 * Medusa commerce framework. The full v2 cart lifecycle is wired here:
 *
 *   mount        -> createCart(region) + seed line items from the demo cart
 *   cart edits   -> updateLineItem / removeLineItem (live) or local (demo)
 *   shipping     -> updateCartContact(email + address) + listShippingOptions +
 *                   addShippingMethod
 *   payment      -> createPaymentCollection + initPaymentSession (provider) and
 *                   completeCart on capture
 *   upsell       -> OmniCart Flow Builder one-click sequence (lib/upsell-flow)
 *
 * Every backend call degrades gracefully: when no backend is configured the
 * Worker proxy returns a `503 { demo: true }` signal, the client reports
 * `demo: true`, and the page stays in the self-contained demo mode so the
 * template renders a realistic flow out of the box.
 */
export function CheckoutPage() {
  const [step, setStep] = useState<CheckoutStepId>("cart");
  const [cart, setCart] = useState<OmniCart>(DEMO_CART);
  // True once a live OmniCart backend has created/returned a real cart. In this
  // mode all cart mutations go through the backend, which is authoritative.
  const [liveCart, setLiveCart] = useState(false);
  // Applied promotions (mirrors the OmniCart v2 `cart.promotions` array). In v2
  // a promotion carries no per-promotion amount, so the cart-level
  // `discount_total` is authoritative once a backend is wired.
  const [promotions, setPromotions] = useState<OmniCartPromotion[]>([]);
  // Demo-only: code -> minor-unit amount, so the in-template demo fallback can
  // still compute a discount total (and re-resolve it as quantities change)
  // even though v2 promotions don't expose a per-promotion amount. Ignored
  // once a live backend supplies `cart.discount_total`.
  const [demoDiscounts, setDemoDiscounts] = useState<Record<string, number>>({});
  // True once a wired backend has returned an authoritative repriced cart; in
  // that mode we trust `cart.discount_total` instead of the demo amounts.
  const [backendPricing, setBackendPricing] = useState(false);
  const [address, setAddress] = useState<ShippingAddress>(EMPTY_ADDRESS);
  // Shipping options shown at the shipping step: seeded with the demo set and
  // replaced with the backend's options once the cart goes live.
  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>(DEMO_SHIPPING_OPTIONS);
  const [shippingOptionId, setShippingOptionId] = useState<string>(DEMO_SHIPPING_OPTIONS[0].id);
  const [order, setOrder] = useState<OrderSummaryData | null>(null);
  // Payment collection created for the live cart (drives initPaymentSession).
  const [paymentCollectionId, setPaymentCollectionId] = useState<string | null>(null);
  // In-flight backend work + last recoverable error, surfaced inline.
  const [busy, setBusy] = useState(false);
  const [flowError, setFlowError] = useState<string | null>(null);

  // -- Upsell flow state ------------------------------------------------------
  // The session is the runtime cursor; `flowNode` is the offer currently shown.
  // `offerIndex` is a 1-based counter for the "Exclusive offer N" affordance.
  const [flowSession, setFlowSession] = useState<FlowSession | null>(null);
  const [flowNode, setFlowNode] = useState<FlowNode | null>(null);
  const [offerIndex, setOfferIndex] = useState(0);

  // -- Lifecycle bootstrap ----------------------------------------------------
  // On mount, try to create a real OmniCart cart and seed it with the demo
  // cart's variants. If no backend is wired (demo signal) or the call fails,
  // we stay in demo mode with local cart state.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const created = await createCart(DEMO_CART.region_id);
      if (cancelled) return;
      if (created.demo || !created.ok || !created.data) {
        // No backend wired (or unreachable): keep the self-contained demo cart.
        return;
      }
      // Seed the live cart with the demo line items so the template still shows
      // a populated cart. Real storefronts would add items as the shopper does.
      let live = created.data;
      for (const item of DEMO_CART.items) {
        const variantId = item.variant?.id;
        if (!variantId) continue;
        const added = await addLineItem(live.id, variantId, item.quantity);
        if (cancelled) return;
        if (added.ok && added.data) live = added.data;
      }
      setCart(live);
      setLiveCart(true);
      setBackendPricing(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const shippingAmount = useMemo(
    () => shippingOptions.find((o) => o.id === shippingOptionId)?.amount ?? 0,
    [shippingOptions, shippingOptionId],
  );

  const currency = cart.currency_code || "usd";

  // Cart edits: when live, mutate through the backend (authoritative); when in
  // demo mode, edit local state so the template stays interactive.
  const updateQuantity = async (itemId: string, quantity: number) => {
    if (liveCart) {
      const res = await updateLineItem(cart.id, itemId, quantity);
      if (res.ok && res.data) {
        setCart(res.data);
        setPromotions(res.data.promotions ?? []);
        return;
      }
      if (!res.demo) {
        setFlowError(res.error ?? "Could not update item.");
        return;
      }
      // demo signal: fall through to local edit
    }
    setCart((prev) => ({
      ...prev,
      items: prev.items.map((i) => (i.id === itemId ? { ...i, quantity } : i)),
    }));
  };

  const removeItem = async (itemId: string) => {
    if (liveCart) {
      const res = await removeLineItem(cart.id, itemId);
      if (res.ok && res.data) {
        setCart(res.data);
        setPromotions(res.data.promotions ?? []);
        return;
      }
      if (!res.demo) {
        setFlowError(res.error ?? "Could not remove item.");
        return;
      }
    }
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
  const discountAmount = useMemo(() => {
    // Backend mode: the repriced cart's `discount_total` is the source of truth.
    if (backendPricing) return cart.discount_total ?? 0;
    // Demo mode: sum the locally-resolved coupon amounts, capped at subtotal.
    const demoTotal = Object.values(demoDiscounts).reduce((sum, a) => sum + a, 0);
    return Math.min(subtotalAmount, demoTotal);
  }, [backendPricing, cart.discount_total, demoDiscounts, subtotalAmount]);

  const grandTotal = useMemo(
    () => Math.max(0, subtotalAmount + shippingAmount + taxAmount - discountAmount),
    [subtotalAmount, shippingAmount, taxAmount, discountAmount],
  );

  // -- Coupon handlers --------------------------------------------------------
  // Apply: try the wired OmniCart backend first; if it isn't configured (503
  // demo signal) or unreachable, fall back to the in-template demo coupon table
  // so the field is interactive out of the box. Returns an error string on
  // failure (consumed by OrderSummary), or null on success.
  const handleApplyCoupon = async (raw: string): Promise<string | null> => {
    const code = raw.trim().toUpperCase();
    if (promotions.some((p) => p.code === code)) return "That code is already applied.";

    const result = await applyDiscount(cart.id, code);
    if (result.ok && result.cart) {
      // Backend is the source of truth: adopt its repriced cart + promotions
      // and trust its `discount_total` from here on.
      setCart(result.cart);
      setPromotions(result.cart.promotions ?? []);
      setBackendPricing(true);
      return null;
    }

    // Demo fallback (no backend wired): synthesize a promotion entry and track
    // its resolved amount locally so the totals still add up.
    const amount = resolveDemoCoupon(code, subtotalAmount);
    if (amount === null || amount <= 0) return "That code isn’t valid.";
    setPromotions((prev) => [...prev, { id: code, code }]);
    setDemoDiscounts((prev) => ({ ...prev, [code]: amount }));
    return null;
  };

  const handleRemoveCoupon = async (code: string) => {
    const result = await removeDiscount(cart.id, code);
    if (result.ok && result.cart) {
      setCart(result.cart);
      setPromotions(result.cart.promotions ?? []);
      setBackendPricing(true);
      return;
    }
    setPromotions((prev) => prev.filter((p) => p.code !== code));
    setDemoDiscounts((prev) => {
      const next = { ...prev };
      delete next[code];
      return next;
    });
  };

  // -- Shipping step ----------------------------------------------------------
  // Persist the contact + shipping address on the cart, load the real shipping
  // options for the cart, and apply the chosen method. In demo mode (no backend)
  // each call reports `demo: true` and we simply advance with the demo options.
  const handleShippingContinue = async () => {
    setFlowError(null);
    if (liveCart) {
      setBusy(true);
      try {
        const contact = await updateCartContact(cart.id, {
          email: address.email || undefined,
          shipping_address: {
            first_name: address.first_name,
            last_name: address.last_name,
            phone: address.phone,
            address_1: address.address_1,
            city: address.city,
            province: address.province,
            postal_code: address.postal_code,
            country_code: address.country_code.toLowerCase(),
          },
        });
        if (contact.ok && contact.data) {
          setCart(contact.data);
          setPromotions(contact.data.promotions ?? []);
        } else if (!contact.demo) {
          setFlowError(contact.error ?? "Could not save your details.");
          setBusy(false);
          return;
        }

        const opts = await listShippingOptions(cart.id);
        if (opts.ok && opts.data && opts.data.length > 0) {
          const mapped: ShippingOption[] = opts.data.map((o) => ({
            id: o.id,
            name: o.name,
            amount: o.amount ?? 0,
          }));
          setShippingOptions(mapped);
          // Keep the current selection if still offered; otherwise pick the first.
          const selected = mapped.some((o) => o.id === shippingOptionId)
            ? shippingOptionId
            : mapped[0].id;
          setShippingOptionId(selected);
          const applied = await addShippingMethod(cart.id, selected);
          if (applied.ok && applied.data) {
            setCart(applied.data);
            setPromotions(applied.data.promotions ?? []);
          } else if (!applied.demo) {
            setFlowError(applied.error ?? "Could not set shipping method.");
            setBusy(false);
            return;
          }
        }
        // If opts.demo: leave the demo shipping options in place and advance.
      } finally {
        setBusy(false);
      }
    }
    setStep("payment");
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

  // Payment captured: complete the live cart into a real order when wired,
  // otherwise synthesize a demo order. Then start the Flow Builder upsell
  // sequence; if the flow has no offers, skip straight to confirmation.
  const handlePaid = async () => {
    setFlowError(null);
    let baseOrder: OrderSummaryData = {
      id: `order_${Math.random().toString(36).slice(2, 10)}`,
      email: address.email || "customer@example.com",
      subtotal: subtotalAmount,
      shipping_total: shippingAmount,
      tax_total: taxAmount,
      discount_total: discountAmount,
      total: grandTotal,
      currency_code: currency,
      items: cart.items,
      promotions,
    };

    if (liveCart) {
      // Create the payment collection + provider session, then complete the
      // cart. The PaymentStep has already collected/confirmed the payment
      // method on-page; completion authorizes and places the order.
      const providers = await listPaymentProviders(cart.region_id || "");
      const providerId =
        providers.ok && providers.data && providers.data.length > 0
          ? providers.data[0].id
          : "pp_system_default";

      let collectionId = paymentCollectionId;
      if (!collectionId) {
        const pc = await createPaymentCollection(cart.id);
        if (pc.ok && pc.data) {
          collectionId = pc.data.id;
          setPaymentCollectionId(collectionId);
        } else if (!pc.demo) {
          setFlowError(pc.error ?? "Could not start payment.");
          return;
        }
      }
      if (collectionId) {
        const session = await initPaymentSession(collectionId, providerId);
        if (!session.ok && !session.demo) {
          setFlowError(session.error ?? "Could not initialize payment.");
          return;
        }
      }

      const completed = await completeCart(cart.id);
      if (completed.ok && completed.order) {
        const o = completed.order;
        baseOrder = {
          id: o.id,
          email: o.email || baseOrder.email,
          subtotal: o.subtotal ?? subtotalAmount,
          shipping_total: o.shipping_total ?? shippingAmount,
          tax_total: o.tax_total ?? taxAmount,
          discount_total: o.discount_total ?? discountAmount,
          total: o.total ?? grandTotal,
          currency_code: o.currency_code || currency,
          items: o.items && o.items.length > 0 ? o.items : cart.items,
          promotions: cart.promotions ?? promotions,
        };
      } else if (!completed.demo) {
        setFlowError(completed.error ?? "We could not complete your order.");
        return;
      }
      // completed.demo: keep the synthesized demo order created above.
    }

    setOrder(baseOrder);

    const { session, entry_node } = await startUpsellFlow({
      orderId: baseOrder.id,
      originalOrderTotal: baseOrder.total,
      currencyCode: baseOrder.currency_code,
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
    setLiveCart(false);
    setPromotions([]);
    setDemoDiscounts({});
    setBackendPricing(false);
    setAddress(EMPTY_ADDRESS);
    setShippingOptions(DEMO_SHIPPING_OPTIONS);
    setShippingOptionId(DEMO_SHIPPING_OPTIONS[0].id);
    setPaymentCollectionId(null);
    setFlowError(null);
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
      promotions,
    }),
    [cart, subtotalAmount, shippingAmount, taxAmount, discountAmount, promotions],
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

        {flowError && (
          <div className="mb-6 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {flowError}
          </div>
        )}

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
                options={shippingOptions}
                selectedOptionId={shippingOptionId}
                currency={currency}
                busy={busy}
                onChangeAddress={setAddress}
                onSelectOption={setShippingOptionId}
                onBack={() => setStep("cart")}
                onContinue={handleShippingContinue}
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
