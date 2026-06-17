import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ShoppingCart } from "lucide-react";
import { loadStripe } from "@stripe/stripe-js";
import { OrderSummary } from "@/components/checkout/OrderSummary";
import { CartStep } from "@/components/checkout/CartStep";
import { ShippingStep } from "@/components/checkout/ShippingStep";
import { PaymentStep, type PaymentResult } from "@/components/checkout/PaymentStep";
import { ProcessorPicker } from "@/components/checkout/ProcessorPicker";
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
  type OmniCartLineItem,
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
  CheckoutCustomer,
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

// ---------------------------------------------------------------------------
// BRAND PALETTE (build-time injectable)
// ---------------------------------------------------------------------------
// The build agent injects the merchant's brand palette here. These values are
// the SOURCE OF TRUTH for the checkout's look and are applied immediately on
// first paint (no network round-trip). At runtime `/api/omnicart-config` may
// still override them per-checkout-code, but the injected palette is what makes
// a freshly generated storefront match the requested brand out of the box.
//
// To re-skin: change the values below. Colors are CSS color strings (hex/rgb).
// `theme` (light) is intentionally the DEFAULT — this is a customer-facing
// storefront, not a dashboard, so it should not follow the OS dark preference.
// Exported as the build agent's brand-injection point (not a shared util), so
// the react-refresh component-only rule does not apply here.
// eslint-disable-next-line react-refresh/only-export-components
export const BRAND_THEME = {
  // Primary brand color — drives CTAs, links, focus rings, selected states.
  primaryColor: "#2563eb",
  // Accent / secondary brand color — drives highlights and success accents.
  accentColor: "#16a34a",
  // Page surface (background) and ink (foreground). Keep light by default.
  backgroundColor: "#ffffff",
  foregroundColor: "#0a0a0a",
  // Body/heading font stack.
  fontFamily: "Inter, sans-serif",
  // Optional merchant logo URL (shown in the header instead of the wordmark).
  logoUrl: "" as string,
  supportEmail: "support@example.com",
  statementName: "MERCHANT",
};

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
// ---------------------------------------------------------------------------
// CHECKOUT CONFIG (resolved from the checkout code)
// ---------------------------------------------------------------------------
// The merchant's published checkout config drives which products seed the cart.
// `/api/omnicart-config` resolves it live from CORE; CONFIG_SNAPSHOT (below) is
// the baked offline fallback used when CORE is unreachable.
interface ConfigCombination {
  id: string;
  priceId?: string;
  priceCents?: number;
  priceOverrideCents?: number;
  imageUrl?: string | null;
  optionValueIds: Record<string, string>;
}
interface ConfigProduct {
  id: string;
  label: string;
  priceId?: string;
  priceCents?: number;
  priceOverrideCents?: number;
  quantity?: number;
  imageUrl?: string | null;
  defaultCombinationId?: string;
  combinations?: ConfigCombination[];
}
interface ConfigOption {
  id: string;
  label: string;
  priceId?: string;
  priceCents?: number;
  imageUrl?: string | null;
  defaultCombinationId?: string;
  combinations?: ConfigCombination[];
}
interface ConfigVariant {
  quantity: number;
  label: string;
  oneTimePrice: number;
  imageUrl?: string | null;
  metadata?: { priceId?: string };
}
interface ConfigSection {
  kind: "bundle" | "multi_product" | "product_variations" | "quantity_selector" | string;
  productName?: string;
  // bundle
  packages?: { id: string; products?: ConfigProduct[] }[];
  defaultPackageId?: string;
  // multi_product
  options?: ConfigOption[];
  defaultOptionId?: string;
  // product_variations
  combinations?: ConfigCombination[];
  defaultCombinationId?: string;
  // quantity_selector
  variants?: ConfigVariant[];
}
interface CheckoutConfig {
  sections?: ConfigSection[];
}

/** Join a combination's option values into a human-facing variant suffix. */
function comboTitle(combo: ConfigCombination): string {
  return Object.values(combo.optionValueIds).join(" / ");
}

/**
 * BUILD-TIME INJECTABLE: the merchant's resolved checkout config, pulled down
 * from CORE at generation time and baked in as an OFFLINE FALLBACK. At runtime
 * the LIVE config (`/api/omnicart-config`) is preferred; if CORE is unreachable
 * the page seeds the cart from THIS snapshot rather than the generic demo cart.
 * Leave `null` to fall back to `DEMO_CART`.
 */
const CONFIG_SNAPSHOT: CheckoutConfig | null = null;

function resolveItemsFromConfig(config: CheckoutConfig | null): OmniCartLineItem[] {
  if (!config || !Array.isArray(config.sections)) return [];

  for (const s of config.sections) {
    if (s.kind === "bundle" && Array.isArray(s.packages) && s.packages.length > 0) {
      const pkg = s.packages.find((p) => p.id === s.defaultPackageId) || s.packages[0];
      if (pkg && Array.isArray(pkg.products)) {
        return pkg.products.map((p, idx) => {
          let unitPrice = p.priceOverrideCents ?? p.priceCents ?? 0;
          let variantTitle = p.label;
          let variantId = p.priceId || p.id;
          if (Array.isArray(p.combinations) && p.combinations.length > 0) {
            const combo = p.combinations.find((c) => c.id === p.defaultCombinationId) || p.combinations[0];
            if (combo) {
              unitPrice = combo.priceOverrideCents ?? combo.priceCents ?? unitPrice;
              variantId = combo.priceId || combo.id;
              variantTitle = `${p.label} (${comboTitle(combo)})`;
            }
          }
          return {
            id: `item_bundle_${p.id}_${idx}`,
            title: p.label,
            quantity: p.quantity || 1,
            unit_price: unitPrice,
            thumbnail: p.imageUrl || null,
            variant: { id: variantId, title: variantTitle },
          };
        });
      }
    }

    if (s.kind === "multi_product" && Array.isArray(s.options) && s.options.length > 0) {
      const opt = s.options.find((o) => o.id === s.defaultOptionId) || s.options[0];
      if (opt) {
        let unitPrice = opt.priceCents ?? 0;
        let variantTitle = opt.label;
        let variantId = opt.priceId || opt.id;
        if (Array.isArray(opt.combinations) && opt.combinations.length > 0) {
          const combo = opt.combinations.find((c) => c.id === opt.defaultCombinationId) || opt.combinations[0];
          if (combo) {
            unitPrice = combo.priceOverrideCents ?? combo.priceCents ?? unitPrice;
            variantId = combo.priceId || combo.id;
            variantTitle = `${opt.label} (${comboTitle(combo)})`;
          }
        }
        return [{
          id: `item_multi_${opt.id}`,
          title: opt.label,
          quantity: 1,
          unit_price: unitPrice,
          thumbnail: opt.imageUrl || null,
          variant: { id: variantId, title: variantTitle },
        }];
      }
    }

    if (s.kind === "product_variations" && Array.isArray(s.combinations) && s.combinations.length > 0) {
      const combo = s.combinations.find((c) => c.id === s.defaultCombinationId) || s.combinations[0];
      if (combo) {
        return [{
          id: `item_var_${combo.id}`,
          title: s.productName || "Product",
          quantity: 1,
          unit_price: combo.priceOverrideCents ?? combo.priceCents ?? 0,
          thumbnail: combo.imageUrl || null,
          variant: { id: combo.priceId || combo.id, title: comboTitle(combo) },
        }];
      }
    }

    if (s.kind === "quantity_selector" && Array.isArray(s.variants) && s.variants.length > 0) {
      const variant = s.variants[0];
      if (variant) {
        return [{
          id: `item_qty_${variant.quantity}`,
          title: s.productName || "Product",
          quantity: variant.quantity,
          unit_price: variant.oneTimePrice,
          thumbnail: variant.imageUrl || null,
          variant: { id: variant.metadata?.priceId || `var_${variant.quantity}`, title: variant.label },
        }];
      }
    }
  }

  return [];
}

export function CheckoutPage() {
  // The checkout short code from the route. Mirrors `params.code` in
  // upw-sendpaylinks' `/c/[code]`; a live build resolves the order payload
  // from it via `resolveCheckoutLink(code)`.
  const { code = "demo" } = useParams<{ code: string }>();
  const navigate = useNavigate();

  // Customer-facing storefront: force LIGHT on mount. The base reference's
  // useTheme hook seeds dark from the OS `prefers-color-scheme`; a checkout
  // must not inherit that. The `.checkout-root` scoped tokens already pin light
  // visuals, but we also strip the document `.dark` class so nested base
  // components (e.g. shadcn portals rendered outside `.checkout-root`) stay light.
  useEffect(() => {
    document.documentElement.classList.remove("dark");
  }, []);

  interface CheckoutTheme {
    logoUrl?: string;
    primaryColor: string;
    accentColor: string;
    backgroundColor: string;
    foregroundColor: string;
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
  // Stripe publishable key from /api/omnicart-config (empty in demo mode). Used
  const [stripePublishableKey, setStripePublishableKey] = useState<string>(
    () =>
      import.meta.env?.VITE_STRIPE_PUBLISHABLE_KEY ||
      import.meta.env?.VITE_STRIPE_PUBLIC_KEY ||
      "",
  );
  // PaymentIntent client secret minted by the active payment-class adapter's
  // `initPayment` (or surfaced from an SCA `requires_action`). Null in demo mode
  // and for CRM-class processors (which collect server-side, no Elements).
  const [paymentClientSecret, setPaymentClientSecret] = useState<string | null>(null);
  // Seed from the build-time injected BRAND_THEME so the storefront paints in
  // the merchant's brand on first render (no flash of default colors, no
  // network dependency). `/api/omnicart-config` may still override per-code.
  const [theme, setTheme] = useState<CheckoutTheme>({
    logoUrl: BRAND_THEME.logoUrl || undefined,
    primaryColor: BRAND_THEME.primaryColor,
    accentColor: BRAND_THEME.accentColor,
    backgroundColor: BRAND_THEME.backgroundColor,
    foregroundColor: BRAND_THEME.foregroundColor,
    fontFamily: BRAND_THEME.fontFamily,
    supportEmail: BRAND_THEME.supportEmail,
    statementName: BRAND_THEME.statementName,
  });

  // -- Lifecycle bootstrap ----------------------------------------------------
  // On mount, try to load the checkout configuration and theme, and then
  // create the cart, seeding it dynamically with the resolved products.
  useEffect(() => {
    let cancelled = false;

    async function init() {
      let stripePubKey = stripePublishableKey;
      let resolvedConfig: CheckoutConfig | null = null;

      try {
        const res = await fetch(`/api/omnicart-config?code=${encodeURIComponent(code)}`);
        if (res.ok) {
          const cfg = (await res.json()) as {
            success?: boolean;
            data?: {
              theme?: Partial<CheckoutTheme>;
              stripePublishableKey?: string;
              config?: CheckoutConfig;
            };
          };
          if (cfg.success && cfg.data) {
            if (cfg.data.theme && !cancelled) {
              // Merge the per-checkout theme OVER the injected BRAND_THEME
              // defaults so a partial config (e.g. only primary/accent)
              // doesn't blank out the brand background/foreground/font.
              setTheme((prev) => ({ ...prev, ...cfg.data.theme }));
            }
            if (cfg.data.stripePublishableKey && !cancelled) {
              stripePubKey = cfg.data.stripePublishableKey;
              setStripePublishableKey(cfg.data.stripePublishableKey);
            }
            if (cfg.data.config) {
              resolvedConfig = cfg.data.config;
            }
          }
        }
      } catch (err) {
        console.error("Failed to load config theme/config", err);
      }

      if (cancelled) return;

      // CORE unreachable / no live config → use the baked config snapshot so the
      // cart still seeds the merchant's real products (not just the demo cart).
      if (!resolvedConfig) resolvedConfig = CONFIG_SNAPSHOT;

      // Seed dynamically from config or fall back to DEMO_CART
      let itemsToSeed = DEMO_CART.items;
      if (resolvedConfig && resolvedConfig.sections) {
        const parsedItems = resolveItemsFromConfig(resolvedConfig);
        if (parsedItems.length > 0) {
          itemsToSeed = parsedItems;
        }
      }

      const initialSubtotal = itemsToSeed.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
      const initialTax = Math.round(initialSubtotal * 0.08);
      const initialTotal = initialSubtotal + initialTax;

      const baseCartState: OmniCart = {
        ...DEMO_CART,
        items: itemsToSeed,
        subtotal: initialSubtotal,
        tax_total: initialTax,
        total: initialTotal,
      };

      if (!cancelled) {
        setCart(baseCartState);
      }

      // Try to bootstrap live cart if backend is wired
      const created = await createCart(DEMO_CART.region_id);
      if (cancelled) return;
      if (created.demo || !created.ok || !created.data) {
        // No backend wired: keep baseCartState in local demo mode.
        return;
      }

      let live = created.data;
      for (const item of itemsToSeed) {
        const variantId = item.variant?.id;
        if (!variantId) continue;
        const added = await addLineItem(live.id, variantId, item.quantity);
        if (cancelled) return;
        if (added.ok && added.data) live = added.data;
      }

      if (!cancelled) {
        setCart(live);
        setLiveCart(true);
        setBackendPricing(true);
      }
    }

    init();

    return () => {
      cancelled = true;
    };
    // Bootstrap runs once per checkout code; stripePublishableKey is read only as
    // a seed, so it intentionally stays out of the dependency list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

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

  // Customer identity captured from the form, reused by initPayment + charge.
  const buildCustomer = (fallbackEmail: string): CheckoutCustomer => ({
    email: address.email || fallbackEmail,
    first_name: address.first_name || undefined,
    last_name: address.last_name || undefined,
    phone: address.phone || undefined,
  });

  // Confirm an SCA / 3-D Secure challenge in-browser when `chargeInitial`
  // returns `requires_action`. Loads Stripe.js with the publishable key and
  // runs `handleNextAction` against the returned PaymentIntent client secret.
  // Returns true once the intent reaches `succeeded` (the page then retries the
  // charge). Without a publishable key (demo / CRM-class) there is nothing to
  // confirm — return false so the caller surfaces a recoverable message.
  const confirmSca = async (clientSecret: string): Promise<boolean> => {
    if (!stripePublishableKey) return false;
    try {
      const stripe = await loadStripe(stripePublishableKey);
      if (!stripe) return false;
      const { error, paymentIntent } = await stripe.handleNextAction({ clientSecret });
      if (error) {
        console.error("SCA confirmation failed", error);
        return false;
      }
      return paymentIntent?.status === "succeeded";
    } catch (err) {
      console.error("SCA confirmation threw", err);
      return false;
    }
  };

  // -- Prepare the live payment session (payment-class only) -------------------
  // FIRST call of the two-call browser flow: as soon as the active processor is
  // payment-class, the address is valid, and no client secret is minted yet,
  // ask the adapter to `initPayment`. When it returns `confirm_client_secret`
  // (e.g. OmniCart/Medusa pre-creates a PaymentIntent) we thread that secret +
  // publishable key into PaymentStep so the shopper confirms the card on-page.
  // CRM-class processors and the `demo` branch mount no Stripe Elements.
  useEffect(() => {
    if (!adapter) return;
    if (PROCESSOR_CLASSES[processor] !== "payment") return;
    if (!adapter.initPayment) return;
    if (!isAddressValid) return;
    if (paymentClientSecret) return;

    let cancelled = false;
    (async () => {
      try {
        const init = await adapter.initPayment!({
          cart,
          customer: buildCustomer("customer@example.com"),
          chargeTarget: buildChargeTarget(),
        });
        if (cancelled) return;
        if ("status" in init && init.status === "failed") {
          // Don't block the page: PaymentStep stays in its demo fallback.
          setFlowError(init.userMessage);
          return;
        }
        if ("mode" in init && init.mode === "confirm_client_secret") {
          setPaymentClientSecret(init.clientSecret);
          if (init.publishableKey) setStripePublishableKey(init.publishableKey);
        }
        // `collect_payment_method` (no pre-minted secret) and `demo` leave the
        // step in its demo fallback in this client-only template — a wired
        // Stripe build mints the secret server-side at charge time instead.
      } catch (err) {
        if (!cancelled) console.error("initPayment failed", err);
      }
    })();
    return () => {
      cancelled = true;
    };
    // buildChargeTarget / buildCustomer close over cart + address + totals; the
    // primitive deps below are sufficient to re-run when those change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adapter, processor, isAddressValid, paymentClientSecret, cart.id, grandTotal]);

  // Reset any minted payment session when the processor changes so we don't
  // confirm one processor's client secret against another.
  useEffect(() => {
    setPaymentClientSecret(null);
  }, [processor]);

  // Payment captured: the PaymentStep has already confirmed the card / wallet
  // on-page (payment-class with a live client secret) — `payment` carries the
  // PaymentIntent + saved payment-method ids. Charge through the ACTIVE adapter
  // via the universal contract (CRM-class processors charge here for the first
  // time), then start the Flow Builder upsell session and HAND OFF to the first
  // upsell offer route (`/upsell/:sessionId`). When the flow has no offers we go
  // straight to the receipt (`/success`). Route names mirror upw-sendpaylinks'
  // CheckoutForm.handlePaymentSuccess: create-session → `/upsell/{sessionId}`,
  // else `/success`.
  const handlePaid = async (payment?: PaymentResult) => {
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
      const customer = buildCustomer(demoOrder.email);

      // Stable idempotency key for THIS pay attempt: reused across the SCA retry
      // below so a 3-D Secure round-trip can't double-charge. A fresh attempt
      // (user retries after a decline) gets a new key.
      const idempotencyKey =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `idem_${Date.now()}_${Math.random().toString(36).slice(2)}`;

      // The card / wallet was already confirmed on-page by PaymentStep for
      // payment-class processors with a live client secret (the FIRST call,
      // `initPayment`, ran in the prepare effect). Forward the minted
      // payment-method id to the server charge so it can confirm + save it.
      if (payment?.paymentMethodId) {
        chargeTarget.metadata = {
          ...chargeTarget.metadata,
          paymentMethodId: payment.paymentMethodId,
        };
      }

      // chargeInitial (all processors). For payment-class this confirms the
      // server-side PaymentIntent / completes the cart; for CRM-class
      // (Konnektive, Sticky.io) this is the FIRST and only charge call.
      let result = await active.chargeInitial({
        cart,
        customer,
        chargeTarget,
        idempotencyKey,
      });

      // SCA / 3-D Secure: confirm the returned client secret in-browser, then
      // retry the charge with the same idempotency key.
      if (result.status === "requires_action") {
        const handled = await confirmSca(result.clientSecret);
        if (!handled) {
          setFlowError(
            "We couldn't verify this payment with your bank. Please try again or use a different card.",
          );
          return;
        }
        result = await active.chargeInitial({
          cart,
          customer,
          chargeTarget,
          idempotencyKey,
        });
      }

      if (result.status === "failed") {
        setFlowError(result.userMessage);
        return;
      }
      if (result.status === "requires_action") {
        // Still pending after the retry — surface a recoverable message.
        setFlowError(
          "We couldn't complete your payment after verification. Please try again.",
        );
        return;
      }
      const baseOrder: OrderSummaryData =
        result.status === "succeeded" ? result.order : demoOrder;

      // Start the post-purchase Flow Builder upsell session. Thread the saved
      // payment method so the upsell runtime can charge it off-session for
      // 1-click upsells (the worker re-resolves pricing server-side; we only
      // pass the stored-payment-method token / order linkage, never a price).
      const { session, entry_node } = await startUpsellFlow({
        orderId: baseOrder.id,
        originalOrderTotal: baseOrder.total,
        currencyCode: baseOrder.currency_code,
        paymentMethodId: payment?.paymentMethodId,
        paymentIntentId: payment?.paymentIntentId,
      });

      // Persist the handoff so the separate upsell/receipt routes can rehydrate
      // the paid order + flow cursor (mirror of server-side session retrieval).
      // The saved payment method rides along for the 1-click upsell charge.
      saveHandoff({
        code,
        order: baseOrder,
        session,
        paymentMethodId: payment?.paymentMethodId,
      });

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
    <div
      className="checkout-root min-h-screen bg-background text-foreground"
      style={{
        fontFamily: theme.fontFamily,
        background: theme.backgroundColor,
        color: theme.foregroundColor,
      }}
    >
      {/*
        Storefront theming is SELF-CONTAINED and LIGHT BY DEFAULT.
        Two layers:
        1. Scope the shadcn HSL token variables to `.checkout-root` and PIN them
           to LIGHT values. Because this rule also wins inside `html.dark`, the
           base ThemeToggle / OS dark preference can NOT darken the checkout.
           (These tokens are consumed as `hsl(var(--token))`, so they MUST stay
           in "H S% L%" form — never raw hex.)
        2. Brand primary/accent are injected hex colors, applied directly to the
           `.text-/.bg-/.border-primary|accent` utilities + page background, so
           the merchant palette shows through immediately on first paint.
      */}
      <style>{`
        .checkout-root {
          --background: 0 0% 100%;
          --foreground: 0 0% 3.9%;
          --card: 0 0% 100%;
          --card-foreground: 0 0% 3.9%;
          --popover: 0 0% 100%;
          --popover-foreground: 0 0% 3.9%;
          --primary-foreground: 0 0% 100%;
          --secondary: 0 0% 96.1%;
          --secondary-foreground: 0 0% 9%;
          --muted: 0 0% 96.1%;
          --muted-foreground: 0 0% 45.1%;
          --accent: 0 0% 96.1%;
          --accent-foreground: 0 0% 9%;
          --border: 0 0% 89.8%;
          --input: 0 0% 89.8%;
        }
        /* Brand primary/accent (injected hex) — direct color hooks that win
           over Tailwind's token utilities, and also set the focus ring. */
        .checkout-root { background: ${theme.backgroundColor}; color: ${theme.foregroundColor}; }
        .checkout-root .text-primary { color: ${theme.primaryColor} !important; }
        .checkout-root .bg-primary { background-color: ${theme.primaryColor} !important; }
        .checkout-root .border-primary { border-color: ${theme.primaryColor} !important; }
        .checkout-root .ring-primary { --tw-ring-color: ${theme.primaryColor} !important; }
        .checkout-root .focus-visible\\:ring-primary:focus-visible { --tw-ring-color: ${theme.primaryColor} !important; }
        .checkout-root .has-\\[\\:checked\\]\\:border-primary:has(:checked) { border-color: ${theme.primaryColor} !important; }
        .checkout-root .text-accent { color: ${theme.accentColor} !important; }
        .checkout-root .bg-accent { background-color: ${theme.accentColor} !important; }
        .checkout-root .border-accent { border-color: ${theme.accentColor} !important; }
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
              stripePublishableKey={
                PROCESSOR_CLASSES[processor] === "payment" ? stripePublishableKey : undefined
              }
              clientSecret={
                PROCESSOR_CLASSES[processor] === "payment" ? paymentClientSecret : null
              }
              busy={paying}
              isAddressValid={isAddressValid}
              onPaid={handlePaid}
              onInvalidAddress={() => setShowValidationErrors(true)}
            />
          </section>

          <aside className="lg:sticky lg:top-8 lg:self-start">
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
