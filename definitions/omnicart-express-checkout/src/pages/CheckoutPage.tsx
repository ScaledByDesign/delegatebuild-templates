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
import type { OmniCart } from "@/lib/omnicart";
import {
  DEMO_CART,
  DEMO_UPSELL,
  EMPTY_ADDRESS,
  cartSubtotal,
  type CheckoutStepId,
  type OrderSummary as OrderSummaryData,
  type ShippingAddress,
  type ShippingOption,
  type UpsellOffer,
} from "@/lib/checkout-types";

const SHIPPING_OPTIONS: ShippingOption[] = [
  { id: "ship_standard", name: "Standard (5–7 days)", amount: 0 },
  { id: "ship_express", name: "Express (2–3 days)", amount: 1200 },
  { id: "ship_overnight", name: "Overnight", amount: 2500 },
];

/**
 * OmniCart Express Checkout — single-page guided checkout.
 *
 * OmniCart is the whitelabel commerce brand; it is powered internally by the
 * Medusa commerce framework. Wire the `omnicart` client (src/lib/omnicart.ts)
 * to a live OmniCart backend to replace the demo cart and shipping options.
 */
export function CheckoutPage() {
  const [step, setStep] = useState<CheckoutStepId>("cart");
  const [cart, setCart] = useState<OmniCart>(DEMO_CART);
  const [address, setAddress] = useState<ShippingAddress>(EMPTY_ADDRESS);
  const [shippingOptionId, setShippingOptionId] = useState<string>(SHIPPING_OPTIONS[0].id);
  const [order, setOrder] = useState<OrderSummaryData | null>(null);

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

  const grandTotal = useMemo(() => {
    const subtotal = cartSubtotal(cart.items);
    const tax = Math.round(subtotal * 0.08);
    return subtotal + shippingAmount + tax;
  }, [cart.items, shippingAmount]);

  // Payment captured: create the order, then present the one-click upsell
  // before showing the final confirmation.
  const handlePaid = () => {
    setOrder({
      id: `order_${Math.random().toString(36).slice(2, 10)}`,
      email: address.email || "customer@example.com",
      total: grandTotal,
      currency_code: currency,
      items: cart.items,
    });
    setStep("upsell");
  };

  // One-click upsell accepted: charge the same saved payment method and append
  // the upsell item to the existing order. In a wired backend, call the
  // `omnicart` client here to add the variant to the order's payment session.
  const handleAcceptUpsell = async (offer: UpsellOffer) => {
    await new Promise((r) => setTimeout(r, 500));
    setOrder((prev) =>
      prev
        ? {
            ...prev,
            total: prev.total + offer.offer_price,
            items: [
              ...prev.items,
              {
                id: offer.id,
                title: offer.title,
                quantity: 1,
                unit_price: offer.offer_price,
                thumbnail: null,
                variant: { id: offer.variant_id, title: "One-click add-on" },
              },
            ],
          }
        : prev,
    );
    setStep("confirmation");
  };

  const startOver = () => {
    setCart(DEMO_CART);
    setAddress(EMPTY_ADDRESS);
    setShippingOptionId(SHIPPING_OPTIONS[0].id);
    setOrder(null);
    setStep("cart");
  };

  // Cart with current shipping/tax reflected for the summary card.
  const summaryCart: OmniCart = useMemo(() => {
    const subtotal = cartSubtotal(cart.items);
    return {
      ...cart,
      subtotal,
      shipping_total: shippingAmount,
      tax_total: Math.round(subtotal * 0.08),
    };
  }, [cart, shippingAmount]);

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
            {step === "upsell" && (
              <UpsellStep
                offer={DEMO_UPSELL}
                currency={currency}
                onAccept={handleAcceptUpsell}
                onDecline={() => setStep("confirmation")}
              />
            )}
            {step === "confirmation" && order && (
              <ConfirmationStep order={order} onStartOver={startOver} />
            )}
          </section>

          {step !== "confirmation" && step !== "upsell" && (
            <aside>
              <OrderSummary cart={summaryCart} shippingAmount={shippingAmount} />
            </aside>
          )}
        </div>
      </main>
    </div>
  );
}
