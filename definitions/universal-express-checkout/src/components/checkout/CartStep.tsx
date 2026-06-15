import { Minus, Plus, Trash2, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatAmount, type OmniCart, type OmniCartLineItem } from "@/lib/omnicart";

interface CartStepProps {
  cart: OmniCart;
  onUpdateQuantity: (itemId: string, quantity: number) => void;
  onRemove: (itemId: string) => void;
}

/** Step 1 — review OmniCart line items, adjust quantities, continue. */
export function CartStep({ cart, onUpdateQuantity, onRemove }: CartStepProps) {
  const currency = cart.currency_code || "usd";

  if (cart.items.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <ShoppingBag className="h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Your cart is empty.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Your cart</h2>
      <Card>
        <CardContent className="divide-y p-0">
          {cart.items.map((item: OmniCartLineItem) => (
            <div key={item.id} className="flex items-center gap-4 p-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <ShoppingBag className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{item.title}</p>
                {item.variant?.title && (
                  <p className="text-xs text-muted-foreground">{item.variant.title}</p>
                )}
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatAmount(item.unit_price, currency)} each
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onUpdateQuantity(item.id, Math.max(1, item.quantity - 1))}
                  aria-label="Decrease quantity"
                >
                  <Minus className="h-3.5 w-3.5" />
                </Button>
                <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                  aria-label="Increase quantity"
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="w-20 text-right font-medium">
                {formatAmount(item.unit_price * item.quantity, currency)}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={() => onRemove(item.id)}
                aria-label="Remove item"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
