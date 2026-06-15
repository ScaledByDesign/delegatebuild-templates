import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ShoppingCart } from "lucide-react";
import { OrderSummary } from "@/components/checkout/OrderSummary";
import { CartStep } from "@/components/checkout/CartStep";
import { ShippingStep } from "@/components/checkout/ShippingStep";
import { PaymentStep } from "@/components/checkout/PaymentStep";
import { ProcessorPicker } from "@/components/checkout/ProcessorPicker";
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
  type OmniCart,
  type OmniCartPromotion,
} from "@/lib/omnicart";
import {
  DEMO_CART,
  EMPTY_ADDRESS,
  cartSubtotal,
  resolveDemoCoupon,
  type OrderSummary as OrderSummaryData,
  type ShippingAddress,
  type ShippingOption,
} from "@/lib/checkout-types";
import { startUpsellFlow } from "@/lib/upsell-flow";
import { saveHandoff } from "@/lib/checkout-session-store";
import { getCheckoutAdapter } from "@/lib/checkout/registry";
import { PROCESSOR_CLASSES, type ProcessorKind } from "@/lib/checkout/manifest";
import type {
  CheckoutProcessorAdapter,
  ChargeTarget,
} from "@/lib/checkout/types";

// On-page section of the one-pager checkout. NOTE: this is NOT a homepage and
// NOT a standalone "cart summary" landing — `/c/:code` IS the checkout.
// `cart` is the line-item review at the top of the same page; shipping and
// payment reveal inline below it. The post-purchase upsell and the receipt are
// SEPARATE routes (`/upsell/:sessionId`, `/success`) — route names that mirror
// the upw-sendpaylinks headless checkout exactly.
type CheckoutSection = "cart" | "shipping" | "payment";

// Demo shipping options used when no OmniCart backend is configured. Once a
// live backend is wired, these are replaced at the shipping step by the real
// options returned from `listShippingOptions(cart.id)`.
const DEMO_SHIPPING_OPTIONS: ShippingOption[] = [
  { id: "ship_standard", name: "Standard (5-7 days)", amount: 0 },
  { id: "ship_express", name: "Express (2-3 days)", amount: 1200 },
  { id: "ship_overnight", name: "Overnight", amount: 2500 },
];

/**
 * Universal Express Checkout — the public checkout page at `/c/:code`.
 *
 * Mirrors upw-sendpaylinks' `app/c/[code]/page.tsx`: the route is keyed by a
 * short checkout code that resolves the order payload, there is NO homepage /
 * storefront / cart-summary landing, and the page renders straight into the
 * checkout (its `CheckoutForm`). The
 * shopper reviews line items, enters shipping, and pays — all on this one page.
 *
 * It drives ANY payment processor through one `CheckoutProcessorAdapter`
 * contract. A `ProcessorPicker` selects the active processor (Stripe, OmniCart,
 * Konnektive, Sticky.io); the page resolves that processor's adapter from the
 * registry and charges through it:
 *
 *   payment-class (Stripe, OmniCart) → two-call browser flow:
 *       adapter.initPayment()  (collect_payment_method | confirm_client_secret)
 *       adapter.chargeInitial() (succeeded | requires_action | failed | demo)
 *   CRM-class (Konnektive, Sticky.io) → single call:
 *       adapter.chargeInitial() only (no initPayment)
 *
 * On a successful charge it starts the Flow Builder upsell session and hands
 * off to `/upsell/:sessionId` (the first upsell OFFER PAGE) — or, when the flow
 * has no offers, straight to `/success`. Each upsell offer is its own route so
 * the builder can author bespoke, fully-designed upsell pages.
 *
 * Every backend call degrades gracefully: when no backend is configured the
 * Worker proxy returns a `503 { demo: true }` signal, the adapter returns its
 * `demo` branch, and the page stays in self-contained demo mode so the template
 * renders a realistic flow out of the box for every processor.
 */
export function CheckoutPage() {
  // The checkout short code from the route. Mirrors `params.code` in
  // upw-sendpaylinks' `/c/[code]`; a live build resolves the order payload
  // from it via `resolveCheckoutLink(code)`.
  const { code = "demo" } = useParams<{ code: string }>();
  const navigate = useNavigate();

  interface CheckoutTheme {
    logoUrl?: string;
    primaryColor: string;
    accentColor: string;
    fontFamily: string;
    supportEmail: string;
    statementName: string;
  }

  const [showValidationErrors, setShowValidationErrors] = useState(false);
  // Active payment processor (manifest-driven). Drives which adapter the page
  // resolves from the registry and charges through. OmniCart is the default so
  // the retained cart lifecycle is exercised out of the box.
  const [processor, setProcessor] = useState<ProcessorKind>("omnicart");
  // The resolved adapter for the active processor (lazy-loaded via the registry).
  const [adapter, setAdapter] = useState<CheckoutProcessorAdapter | null>(null);
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
  // In-flight backend work + last recoverable error, surfaced inline.
  const [busy, setBusy] = useState(false);
  const [paying, setPaying] = useState(false);
  const [flowError, setFlowError] = useState<string | null>(null);
  const [theme, setTheme] = useState<CheckoutTheme>({
    primaryColor: "#2563eb",
    accentColor: "#16a34a",
    fontFamily: "Inter, sans-serif",
    supportEmail: "support@example.com",
    statementName: "MERCHANT",
  });

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

  // Resolve the adapter for the active processor whenever it changes. The
  // registry lazy-loads (and caches) the adapter module on first use.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const resolved = await getCheckoutAdapter(processor);
      if (!cancelled) setAdapter(resolved);
    })();
    return () => {
      cancelled = true;
    };
  }, [processor]);

  // Load the builder's theme configurations on mount
  useEffect(() => {
    let active = true;
    fetch(`/api/omnicart-config?code=${encodeURIComponent(code)}`)
      .then((r) => r.json())
      .then((cfg) => {
        if (!active) return;
        if (cfg.success && cfg.data?.theme) {
          setTheme(cfg.data.theme);
        }
      })
      .catch((err) => console.error("Failed to load config theme", err));
    return () => {
      active = false;
    };
  }, [code]);

  const requiredAddressFields: (keyof ShippingAddress)[] = [
    "first_name",
    "last_name",
    "email",
    "address_1",
    "city",
    "postal_code",
    "country_code",
  ];
  const isAddressValid = requiredAddressFields.every((k) => (address[k] ?? "").toString().trim().length > 0);

  // Debounced reactive shipping address syncing
  useEffect(() => {
    if (!liveCart) return;
    if (!isAddressValid) return;

    let active = true;
    const timer = setTimeout(async () => {
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
        if (!active) return;
        if (contact.ok && contact.data) {
          setCart(contact.data);
          setPromotions(contact.data.promotions ?? []);
        }

        const opts = await listShippingOptions(cart.id);
        if (!active) return;
        if (opts.ok && opts.data && opts.data.length > 0) {
          const mapped: ShippingOption[] = opts.data.map((o) => ({
            id: o.id,
            name: o.name,
            amount: o.amount ?? 0,
          }));
          setShippingOptions(mapped);
          const selected = mapped.some((o) => o.id === shippingOptionId)
            ? shippingOptionId
            : mapped[0].id;
          setShippingOptionId(selected);
        }
      } catch (err) {
        console.error("Failed to sync address", err);
      } finally {
        if (active) setBusy(false);
      }
    }, 1000);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [address, liveCart, cart.id, isAddressValid, shippingOptionId]);

  // Reactive shipping method syncing
  useEffect(() => {
    if (!liveCart) return;
    let active = true;
    (async () => {
      setBusy(true);
      try {
        const applied = await addShippingMethod(cart.id, shippingOptionId);
        if (!active) return;
        if (applied.ok && applied.data) {
          setCart(applied.data);
          setPromotions(applied.data.promotions ?? []);
        }
      } catch (err) {
        console.error("Failed to apply shipping option", err);
      } finally {
        if (active) setBusy(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [shippingOptionId, liveCart, cart.id]);

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
  const handleApplyCoupon = async (raw: string): Promise<string | null> => {
    const code = raw.trim().toUpperCase();
    if (promotions.some((p) => p.code === code)) return "That code is already applied.";

    const result = await applyDiscount(cart.id, code);
    if (result.ok && result.cart) {
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

  // Build the authoritative charge target from the current cart + totals.
  const buildChargeTarget = (): ChargeTarget => ({
    currency,
    totalCents: grandTotal,
    lineItems: cart.items.map((i) => ({
      priceId: i.variant?.id ?? i.id,
      quantity: i.quantity,
      unitPriceCents: i.unit_price,
      sku: i.variant?.id,
      title: i.title,
    })),
    metadata: {
      checkoutCode: code,
      campaignId: "demo-campaign",
      productId: cart.items[0]?.variant?.id ?? "demo-product",
      offerId: "demo-offer",
      billingModelId: "demo-billing-model",
      shippingId: shippingOptionId,
    },
  });

  // Payment captured: charge through the ACTIVE adapter via the universal
  // contract, then start the Flow Builder upsell session and HAND OFF to the
  // first upsell offer route (`/upsell/:sessionId`). When the flow has no offers
  // we go straight to the receipt (`/success`). Route names mirror
  // upw-sendpaylinks' CheckoutForm.handlePaymentSuccess handoff exactly:
  // create-session → upsellUrl `/upsell/{sessionId}`, else `/success`.
  const handlePaid = async () => {
    setFlowError(null);
    setPaying(true);
    try {
      const active = adapter ?? (await getCheckoutAdapter(processor));

      // Ensure shipping address is synced to the backend before processing payment
      if (liveCart && isAddressValid) {
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
          }
        } catch (e) {
          console.error("Final sync on pay failed", e);
        }
      }

      const demoOrder: OrderSummaryData = {
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

      const chargeTarget = buildChargeTarget();
      const customer = {
        email: address.email || demoOrder.email,
        first_name: address.first_name || undefined,
        last_name: address.last_name || undefined,
        phone: address.phone || undefined,
      };

      // FIRST call (payment-class only): initPayment.
      if (PROCESSOR_CLASSES[processor] === "payment" && active.initPayment) {
        const init = await active.initPayment({ cart, customer, chargeTarget });
        if ("status" in init && init.status === "failed") {
          setFlowError(init.userMessage);
          return;
        }
      }

      // chargeInitial (all processors).
      const result = await active.chargeInitial({
        cart,
        customer,
        chargeTarget,
        idempotencyKey: demoOrder.id,
      });
      if (result.status === "failed") {
        setFlowError(result.userMessage);
        return;
      }
      if (result.status === "requires_action") {
        setFlowError(
          "Your bank needs to verify this payment (3-D Secure). Please complete the verification and try again.",
        );
        return;
      }
      const baseOrder: OrderSummaryData =
        result.status === "succeeded" ? result.order : demoOrder;

      // Start the post-purchase Flow Builder upsell session.
      const { session, entry_node } = await startUpsellFlow({
        orderId: baseOrder.id,
        originalOrderTotal: baseOrder.total,
        currencyCode: baseOrder.currency_code,
      });

      // Persist the handoff so the separate upsell/receipt routes can rehydrate
      // the paid order + flow cursor (mirror of server-side session retrieval).
      saveHandoff({ code, order: baseOrder, session });

      if (entry_node && session.current_button_id) {
        // Hand off to the FIRST upsell offer page. Each offer is its own route.
        // Mirror: upw-sendpaylinks redirects to upsellUrl `/upsell/{sessionId}`.
        navigate(
          `/upsell/${encodeURIComponent(session.id)}?nodeId=${encodeURIComponent(entry_node.id)}`,
        );
      } else {
        // No upsell offers — go straight to the receipt.
        // Mirror: upw-sendpaylinks redirects to `successUrl?orderId=&transactionId=`.
        navigate(
          `/success?session=${encodeURIComponent(session.id)}&orderId=${encodeURIComponent(baseOrder.id)}`,
        );
      }
    } finally {
      setPaying(false);
    }
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
    <div className="min-h-screen bg-background text-foreground" style={{ fontFamily: theme.fontFamily }}>
      <style>{`
        :root {
          --primary: ${theme.primaryColor};
          --primary-foreground: #ffffff;
          --ring: ${theme.primaryColor};
        }
        .text-primary { color: ${theme.primaryColor} !important; }
        .bg-primary { background-color: ${theme.primaryColor} !important; }
        .border-primary { border-color: ${theme.primaryColor} !important; }
        .focus-visible\\:ring-primary:focus-visible { --tw-ring-color: ${theme.primaryColor} !important; }
        .has-\\[\\:checked\\]\\:border-primary:has(:checked) { border-color: ${theme.primaryColor} !important; }
        
        /* Accents */
        .text-accent { color: ${theme.accentColor} !important; }
        .bg-accent { background-color: ${theme.accentColor} !important; }
        .border-accent { border-color: ${theme.accentColor} !important; }
      `}</style>
      
      {/* Announcement Banner */}
      <div className="bg-amber-500 text-amber-950 text-xs font-semibold py-2 px-4 text-center">
        🔥 Welcome to our store. Free shipping over $50. 🔥
      </div>

      <header className="border-b">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            {theme.logoUrl ? (
              <img src={theme.logoUrl} alt="Store Logo" className="h-8 object-contain" />
            ) : (
              <>
                <ShoppingCart className="h-5 w-5 text-primary" />
                <span className="text-lg font-semibold">Universal</span>
                <span className="text-sm text-muted-foreground">Express Checkout</span>
              </>
            )}
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        {flowError && (
          <div className="mb-6 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {flowError}
          </div>
        )}

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_360px]">
          <section className="space-y-8">
            <div className="space-y-6">
              <div className="rounded-lg border bg-muted/30 p-4">
                <ProcessorPicker
                  value={processor}
                  onChange={setProcessor}
                  disabled={busy || paying}
                />
              </div>
              <CartStep
                cart={cart}
                onUpdateQuantity={updateQuantity}
                onRemove={removeItem}
              />
            </div>

            <ShippingStep
              address={address}
              options={shippingOptions}
              selectedOptionId={shippingOptionId}
              currency={currency}
              busy={busy}
              onChangeAddress={setAddress}
              onSelectOption={setShippingOptionId}
              showValidationErrors={showValidationErrors}
            />

            <PaymentStep
              amount={grandTotal}
              currency={currency}
              busy={paying}
              isAddressValid={isAddressValid}
              onPaid={handlePaid}
              onInvalidAddress={() => setShowValidationErrors(true)}
            />
          </section>

          <aside>
            <OrderSummary
              cart={summaryCart}
              shippingAmount={shippingAmount}
              onApplyCoupon={handleApplyCoupon}
              onRemoveCoupon={handleRemoveCoupon}
            />
          </aside>
        </div>
      </main>
    </div>
  );
}
