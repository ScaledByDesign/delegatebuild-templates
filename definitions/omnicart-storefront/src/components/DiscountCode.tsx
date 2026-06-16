import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { X, Tag, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { applyPromotions } from '@/lib/data/cart';

/**
 * Map a raw Medusa promotion error to a user-friendly message.
 * Medusa returns technical messages like "budget exceeded" — we translate them here.
 */
const friendlyPromotionError = (raw: string): string => {
  const lower = raw.toLowerCase();

  // One-time-use code already redeemed
  if (
    lower.includes("budget") ||
    lower.includes("exceed") ||
    lower.includes("usage limit") ||
    lower.includes("already been used") ||
    lower.includes("campagin") ||  // fix Medusa typo if it surfaces
    lower.includes("campaign")
  ) {
    return "This code has already been used and can only be redeemed once.";
  }

  // Code requires a specific customer email
  if (
    lower.includes("email") ||
    lower.includes("customer") ||
    lower.includes("eligible")
  ) {
    return "Please enter your email address to apply this discount code.";
  }

  // Code not valid or expired
  if (
    lower.includes("not found") ||
    lower.includes("invalid") ||
    lower.includes("expired") ||
    lower.includes("not active") ||
    lower.includes("inactive")
  ) {
    return "This discount code is not valid or has expired.";
  }

  return raw;
};

/**
 * Extract user-friendly error message from Medusa API error
 */
const extractErrorMessage = (error: unknown): string => {
  if (!(error instanceof Error)) {
    return "This discount code is not valid or cannot be applied.";
  }

  const message = error.message;

  // Try to parse JSON error from Medusa API (format: "HTTP 400: {json}")
  const jsonMatch = message.match(/HTTP \d+:\s*(\{.*\})/);
  if (jsonMatch) {
    try {
      const errorData = JSON.parse(jsonMatch[1]);
      if (errorData.message) {
        return friendlyPromotionError(errorData.message);
      }
    } catch {
      // If JSON parsing fails, continue to fallback
    }
  }

  // Return the original message if it doesn't look like a raw JSON error
  if (!message.includes('{"type":') && !message.includes('"message":')) {
    return friendlyPromotionError(message);
  }

  // Fallback message
  return "This discount code is not valid or cannot be applied.";
};

interface DiscountCodeProps {
  cartId?: string; // Optional - applyPromotions gets cart ID from cookies
  appliedCodes?: string[];
  visualOnlyCodes?: string[]; // Codes displayed for UI purposes only (not removable)
  onCodesUpdated?: (codes: string[], updatedCart?: any) => void;
  className?: string;
  maxCoupons?: number; // Maximum number of real coupons allowed (default: 1)
}

const DiscountCode: React.FC<DiscountCodeProps> = ({
  cartId,
  appliedCodes = [],
  visualOnlyCodes = [],
  onCodesUpdated,
  className = "",
  maxCoupons = 1
}) => {
  const [code, setCode] = useState('');
  const [isApplying, setIsApplying] = useState(false);
  const [isRemoving, setIsRemoving] = useState<string | null>(null);
  const { toast } = useToast();

  // Check if max coupons reached (only count real applied codes, not visual-only)
  const hasMaxCoupons = appliedCodes.length >= maxCoupons;

  const handleApplyCode = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!code.trim()) {
      toast({
        variant: "destructive",
        title: "Invalid Code",
        description: "Please enter a discount code.",
      });
      return;
    }

    const codeUpper = code.trim().toUpperCase();

    if (appliedCodes.includes(codeUpper)) {
      toast({
        variant: "destructive",
        title: "Code Already Applied",
        description: "This discount code is already applied to your cart.",
      });
      return;
    }

    // Check if max coupons reached
    if (hasMaxCoupons) {
      toast({
        variant: "destructive",
        title: "Coupon Limit Reached",
        description: `Only ${maxCoupons} discount code${maxCoupons > 1 ? 's' : ''} can be applied per order. Please remove the existing code first.`,
      });
      return;
    }

    setIsApplying(true);

    try {
      // Apply the code directly - Medusa v2 validates on apply
      const newCodes = [...appliedCodes, codeUpper];
      const updatedCart = await applyPromotions(newCodes);

      // Check if the code was actually applied by verifying it's in the cart's promotions
      const appliedPromotions = updatedCart?.promotions || [];
      const wasApplied = appliedPromotions.some(
        (p: any) => p.code?.toUpperCase() === codeUpper
      );

      if (wasApplied) {
        toast({
          title: "Discount Applied",
          description: `Discount code "${codeUpper}" has been applied to your cart.`,
        });
        setCode('');
        // Use the actual codes from the cart, not our assumed newCodes
        const actualCodes = appliedPromotions.map((p: any) => p.code).filter(Boolean);
        onCodesUpdated?.(actualCodes, updatedCart);
      } else {
        // Code was silently rejected - doesn't meet conditions
        toast({
          variant: "destructive",
          title: "Code Not Applied",
          description: "Your cart doesn't have the required products for this discount code. Please check the promotion requirements.",
        });
        // Still update with actual cart state
        const actualCodes = appliedPromotions.map((p: any) => p.code).filter(Boolean);
        onCodesUpdated?.(actualCodes, updatedCart);
      }
    } catch (error: unknown) {
      // Medusa returns error if code is invalid
      toast({
        variant: "destructive",
        title: "Invalid Code",
        description: extractErrorMessage(error),
      });
    } finally {
      setIsApplying(false);
    }
  };

  const handleRemoveCode = async (codeToRemove: string) => {
    setIsRemoving(codeToRemove);

    try {
      // Remove by applying all codes except the one to remove
      const newCodes = appliedCodes.filter(c => c !== codeToRemove);
      const updatedCart = await applyPromotions(newCodes);

      toast({
        title: "Discount Removed",
        description: `Discount code "${codeToRemove}" has been removed from your cart.`,
      });

      onCodesUpdated?.(newCodes, updatedCart);
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Error",
        description: extractErrorMessage(error) || "Failed to remove discount code. Please try again.",
      });
    } finally {
      setIsRemoving(null);
    }
  };

  // Combine applied codes and visual-only codes for display
  const allDisplayCodes = [...appliedCodes, ...visualOnlyCodes.filter(vc => !appliedCodes.includes(vc))];

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Applied Codes (including visual-only) */}
      {allDisplayCodes.length > 0 && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Applied Discounts</Label>
          <div className="flex flex-wrap gap-2">
            {allDisplayCodes.map((displayCode) => {
              const isVisualOnly = visualOnlyCodes.includes(displayCode) && !appliedCodes.includes(displayCode);
              return (
                <Badge
                  key={displayCode}
                  variant="secondary"
                  className={`flex items-center gap-1 px-3 py-1 ${isVisualOnly ? 'bg-green-100 text-green-800 border-green-200' : ''}`}
                >
                  <Tag size={12} />
                  {displayCode}
                  {isVisualOnly ? (
                    <span className="text-xs ml-1">✓</span>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto p-0 ml-1 hover:bg-transparent"
                      onClick={() => handleRemoveCode(displayCode)}
                      disabled={isRemoving === displayCode}
                    >
                      {isRemoving === displayCode ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <X size={12} />
                      )}
                    </Button>
                  )}
                </Badge>
              );
            })}
          </div>
        </div>
      )}

      {/* Add New Code - hidden when max coupons reached */}
      {!hasMaxCoupons && (
        <div className="space-y-2">
          <Label htmlFor="discount-code" className="text-sm font-medium">
            Discount Code
          </Label>
          <form onSubmit={handleApplyCode} className="flex gap-2">
            <Input
              id="discount-code"
              type="text"
              placeholder="Enter discount code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="flex-1"
              disabled={isApplying}
            />
            <Button
              type="submit"
              disabled={isApplying || !code.trim()}
              className="px-6 bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed"
            >
              {isApplying ? (
                <>
                  <Loader2 size={16} className="animate-spin mr-2" />
                  Applying...
                </>
              ) : (
                'Apply'
              )}
            </Button>
          </form>
        </div>
      )}
    </div>
  );
};

export default DiscountCode;
