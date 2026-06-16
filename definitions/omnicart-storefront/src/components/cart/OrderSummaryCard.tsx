import React from "react"
import { Link } from "react-router-dom"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { CartItem as CartItemType } from "@/hooks/useCart"
import { cn } from "@/lib/utils"

const formatCurrency = (value: number, currencyCode: string) => {
  if (!Number.isFinite(value)) {
    return "—"
  }

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currencyCode,
      minimumFractionDigits: 2,
    }).format(value)
  } catch (error) {
    return `$${value.toFixed(2)}`
  }
}

interface OrderSummaryCardProps {
  heading?: string
  items: CartItemType[]
  showItems?: boolean
  subtotal: number
  shipping: number
  discount: number
  total: number
  currencyCode?: string
  discountPercent?: number | null
  checkoutHref?: string
  checkoutLabel?: string
  className?: string
  loyaltyPoints?: number | null
  showLoyalty?: boolean
  note?: string
}

const OrderSummaryCard: React.FC<OrderSummaryCardProps> = ({
  heading = "Order Summary",
  items,
  showItems = true,
  subtotal,
  shipping,
  discount,
  total,
  currencyCode = "USD",
  discountPercent,
  checkoutHref = "/express-checkout",
  checkoutLabel = "Proceed to Checkout",
  className,
  loyaltyPoints,
  showLoyalty = false,
  note = "Taxes calculated at checkout",
}) => {
  const hasDiscount = discount > 0
  const shouldShowLoyalty = showLoyalty && (loyaltyPoints ?? 0) > 0

  return (
    <div className={cn("relative bg-white rounded-lg shadow-sm p-4", className)}>
      <h2 className="font-bold text-xl mb-4">{heading}</h2>

      {showItems && items.length > 0 ? (
        <div className="space-y-3 mb-4">
          {items.filter((item: any) => !item.metadata?.is_mystery_gift).map((item) => (
            <div key={item.id} className="flex justify-between text-sm gap-2">
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{item.title}</div>
                {item.variant?.title && item.variant.title !== 'Default Title' && (
                  <div className="text-xs text-gray-600 mt-0.5">
                    {item.variant.title.split(' / ').map((part, index) => {
                      const [key, value] = part.includes(':')
                        ? part.split(':').map(s => s.trim())
                        : ['Option', part.trim()];
                      return (
                        <span key={index} className="mr-2">
                          {key}: {value}
                        </span>
                      );
                    })}
                  </div>
                )}
                <span className="text-gray-600">×{item.quantity}</span>
              </div>
              {/* Medusa v2 stores prices in major units (dollars, not cents) */}
              <div className="font-medium whitespace-nowrap">{formatCurrency((item.unit_price || 0) * item.quantity, currencyCode)}</div>
            </div>
          ))}
        </div>
      ) : null}

      <div className={cn("border-t pt-3 space-y-3", showItems ? "" : "")}>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Subtotal</span>
          <span>{formatCurrency(subtotal, currencyCode)}</span>
        </div>

        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Shipping</span>
          <span>{shipping === 0 ? "Free" : formatCurrency(shipping, currencyCode)}</span>
        </div>

        {hasDiscount ? (
          <div className="flex justify-between text-sm text-green-600">
            <span>
              Discount
              {typeof discountPercent === "number" && discountPercent > 0 ? ` (${discountPercent}%)` : ""}
            </span>
            <span>-{formatCurrency(discount, currencyCode)}</span>
          </div>
        ) : null}

        <div className="flex justify-between font-bold text-lg pt-2 border-t">
          <span>Total</span>
          <span>{formatCurrency(total, currencyCode)}</span>
        </div>
      </div>

      <Button asChild className="w-full bg-vnsh-green hover:bg-[#0f4a1c] mt-4">
        <Link to={checkoutHref}>
          {checkoutLabel}
          <ArrowRight size={16} className="ml-2" />
        </Link>
      </Button>

      {shouldShowLoyalty ? (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 mt-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-green-700 font-medium">Points you'll earn:</span>
            <span className="text-green-800 font-bold">~{loyaltyPoints}</span>
          </div>
          <p className="text-xs text-green-600 mt-1">
            Earn points with every purchase and unlock exclusive rewards!
          </p>
        </div>
      ) : null}

      {note ? (
        <div className="text-sm text-gray-500 text-center mt-4">{note}</div>
      ) : null}
    </div>
  )
}

export default OrderSummaryCard
