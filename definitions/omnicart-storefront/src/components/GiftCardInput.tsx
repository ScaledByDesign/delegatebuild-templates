import React, { useState } from 'react';
import { Gift, X, Check, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  validateGiftCard,
  applyGiftCardToCart,
  removeGiftCardFromCart,
  formatGiftCardValue,
  isValidGiftCardCode,
  type GiftCard
} from '@/services/medusa/giftCards';

interface GiftCardInputProps {
  cartId: string;
  appliedGiftCards?: Array<{
    code: string;
    value: number;
  }>;
  onGiftCardApplied?: (giftCard: GiftCard) => void;
  onGiftCardRemoved?: (code: string) => void;
  disabled?: boolean;
}

export const GiftCardInput: React.FC<GiftCardInputProps> = ({
  cartId,
  appliedGiftCards = [],
  onGiftCardApplied,
  onGiftCardRemoved,
  disabled = false
}) => {
  const [giftCardCode, setGiftCardCode] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Mutation for applying gift card
  const applyGiftCardMutation = useMutation({
    mutationFn: async (code: string) => {
      // First validate the gift card
      setIsValidating(true);
      const validation = await validateGiftCard(code);
      setIsValidating(false);

      if (!validation.valid) {
        throw new Error(validation.error || 'Invalid gift card');
      }

      // Apply to cart
      const cart = await applyGiftCardToCart(cartId, code);
      return { cart, giftCard: validation.gift_card };
    },
    onSuccess: (data) => {
      toast({
        title: "Gift card applied!",
        description: `${formatGiftCardValue(data.giftCard!.balance)} credit applied to your order.`,
      });
      setGiftCardCode('');
      if (onGiftCardApplied && data.giftCard) {
        onGiftCardApplied(data.giftCard);
      }
      // Refresh cart data
      queryClient.invalidateQueries({ queryKey: ['cart'] });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Failed to apply gift card",
        description: error.message,
      });
    },
  });

  // Mutation for removing gift card
  const removeGiftCardMutation = useMutation({
    mutationFn: (code: string) => removeGiftCardFromCart(cartId, code),
    onSuccess: (_, code) => {
      toast({
        title: "Gift card removed",
        description: "Gift card has been removed from your order.",
      });
      if (onGiftCardRemoved) {
        onGiftCardRemoved(code);
      }
      // Refresh cart data
      queryClient.invalidateQueries({ queryKey: ['cart'] });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to remove gift card. Please try again.",
      });
    },
  });

  const handleApplyGiftCard = () => {
    if (!giftCardCode.trim()) {
      toast({
        variant: "destructive",
        title: "Missing code",
        description: "Please enter a gift card code.",
      });
      return;
    }

    const code = giftCardCode.trim().toUpperCase();

    if (!isValidGiftCardCode(code)) {
      toast({
        variant: "destructive",
        title: "Invalid format",
        description: "Please enter a valid gift card code (e.g., GC-ABC123).",
      });
      return;
    }

    // Check if already applied
    if (appliedGiftCards.some(gc => gc.code === code)) {
      toast({
        variant: "destructive",
        title: "Already applied",
        description: "This gift card is already applied to your order.",
      });
      return;
    }

    applyGiftCardMutation.mutate(code);
  };

  const handleRemoveGiftCard = (code: string) => {
    removeGiftCardMutation.mutate(code);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleApplyGiftCard();
    }
  };

  return (
    <div className="space-y-4">
      {/* Applied Gift Cards */}
      {appliedGiftCards.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700">Applied Gift Cards</h4>
          {appliedGiftCards.map((giftCard) => (
            <Card key={giftCard.code} className="border-green-200 bg-green-50">
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Gift className="h-4 w-4 text-vnsh-green" />
                    <span className="font-mono text-sm font-medium">
                      {giftCard.code}
                    </span>
                    <Badge className="text-vnsh-green bg-green-100">
                      -{formatGiftCardValue(giftCard.value)}
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveGiftCard(giftCard.code)}
                    disabled={removeGiftCardMutation.isPending || disabled}
                    className="h-6 w-6 p-0 text-vnsh-green hover:text-[#0f4a1c] hover:bg-green-100"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Gift Card Input */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Gift Card Code
        </label>
        <div className="flex space-x-2">
          <div className="relative flex-1">
            <Gift className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Enter gift card code (e.g., GC-ABC123)"
              value={giftCardCode}
              onChange={(e) => setGiftCardCode(e.target.value.toUpperCase())}
              onKeyPress={handleKeyPress}
              disabled={disabled || applyGiftCardMutation.isPending || isValidating}
              className="pl-10"
            />
          </div>
          <Button
            onClick={handleApplyGiftCard}
            disabled={
              disabled || 
              applyGiftCardMutation.isPending || 
              isValidating || 
              !giftCardCode.trim()
            }
            className="bg-vnsh-red hover:bg-[#0f4a1c]"
          >
            {applyGiftCardMutation.isPending || isValidating ? (
              <div className="flex items-center space-x-1">
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                <span>Applying...</span>
              </div>
            ) : (
              <div className="flex items-center space-x-1">
                <Check className="h-4 w-4" />
                <span>Apply</span>
              </div>
            )}
          </Button>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Enter your gift card code to apply it to this order
        </p>
      </div>

      {/* Gift Card Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <div className="flex items-start space-x-2">
          <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-blue-800">
            <p className="font-medium mb-1">Gift Card Information:</p>
            <ul className="space-y-0.5">
              <li>• Gift cards are applied before taxes and shipping</li>
              <li>• Unused balance remains on your gift card</li>
              <li>• Multiple gift cards can be used per order</li>
              <li>• Gift cards never expire</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GiftCardInput;
