import React from 'react';
import { Progress } from '@/components/ui/progress';
import { Truck, CheckCircle, Gift } from 'lucide-react';
import { useRegion } from '@/hooks/useRegion';

interface FreeShippingProgressProps {
  currentTotal: number;
  freeShippingThreshold?: number;
  className?: string;
}

const FreeShippingProgress: React.FC<FreeShippingProgressProps> = ({
  currentTotal,
  freeShippingThreshold = 50,
  className = ""
}) => {
  const { formatPrice } = useRegion();
  
  const remainingAmount = Math.max(0, freeShippingThreshold - currentTotal);
  const progressPercentage = Math.min(100, (currentTotal / freeShippingThreshold) * 100);
  const hasQualified = currentTotal >= freeShippingThreshold;

  const getProgressColor = () => {
    if (hasQualified) return 'bg-vnsh-green';
    if (progressPercentage > 75) return 'bg-blue-500';
    if (progressPercentage > 50) return 'bg-yellow-500';
    return 'bg-gray-400';
  };

  const getIcon = () => {
    if (hasQualified) {
      return <CheckCircle className="w-5 h-5 text-vnsh-green" />;
    }
    return <Truck className="w-5 h-5 text-gray-600" />;
  };

  const getMessage = () => {
    if (hasQualified) {
      return (
        <div className="flex items-center gap-2 text-green-700 font-medium">
          <CheckCircle className="w-4 h-4" />
          <span>You qualify for free shipping!</span>
        </div>
      );
    }

    if (remainingAmount <= 10) {
      return (
        <div className="flex items-center gap-2 text-blue-700 font-medium">
          <Gift className="w-4 h-4" />
          {/* Medusa v2 stores prices in major units (dollars) - formatPrice expects dollars */}
          <span>You're almost there! Add {formatPrice(remainingAmount)} more for free shipping</span>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2 text-gray-700">
        <Truck className="w-4 h-4" />
        {/* Medusa v2 stores prices in major units (dollars) - formatPrice expects dollars */}
        <span>Add {formatPrice(remainingAmount)} more for free shipping</span>
      </div>
    );
  };

  return (
    <div className={`bg-white rounded-lg border p-4 space-y-3 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {getIcon()}
          <span className="font-medium text-gray-900">
            {hasQualified ? 'Free Shipping Unlocked!' : 'Free Shipping'}
          </span>
        </div>
        {/* Medusa v2 stores prices in major units (dollars) - formatPrice expects dollars */}
        <div className="text-sm text-gray-500">
          {formatPrice(currentTotal)} / {formatPrice(freeShippingThreshold)}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <Progress
          value={progressPercentage}
          className="h-2"
        />
        <div className="flex justify-between text-xs text-gray-500">
          <span>{formatPrice(0)}</span>
          <span>{formatPrice(freeShippingThreshold)}</span>
        </div>
      </div>

      {/* Message */}
      <div className="text-sm">
        {getMessage()}
      </div>

      {/* Milestones */}
      {!hasQualified && (
        <div className="flex justify-between text-xs text-gray-400 pt-2 border-t">
          <div className={`flex items-center gap-1 ${progressPercentage >= 25 ? 'text-blue-600' : ''}`}>
            <div className={`w-2 h-2 rounded-full ${progressPercentage >= 25 ? 'bg-blue-600' : 'bg-gray-300'}`} />
            <span>25%</span>
          </div>
          <div className={`flex items-center gap-1 ${progressPercentage >= 50 ? 'text-blue-600' : ''}`}>
            <div className={`w-2 h-2 rounded-full ${progressPercentage >= 50 ? 'bg-blue-600' : 'bg-gray-300'}`} />
            <span>50%</span>
          </div>
          <div className={`flex items-center gap-1 ${progressPercentage >= 75 ? 'text-blue-600' : ''}`}>
            <div className={`w-2 h-2 rounded-full ${progressPercentage >= 75 ? 'bg-blue-600' : 'bg-gray-300'}`} />
            <span>75%</span>
          </div>
          <div className={`flex items-center gap-1 ${hasQualified ? 'text-[#176326]' : ''}`}>
            <div className={`w-2 h-2 rounded-full ${hasQualified ? 'bg-[#176326]' : 'bg-gray-300'}`} />
            <span>Free!</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default FreeShippingProgress;
