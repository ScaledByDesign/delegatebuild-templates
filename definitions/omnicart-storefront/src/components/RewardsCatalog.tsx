import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useLoyaltyManagement } from '@/hooks/useLoyalty';
import { formatPoints, type LoyaltyReward } from '@/services/medusa/loyalty';
import { Gift, Percent, Truck, Crown, AlertCircle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RewardsCatalogProps {
  className?: string;
}

export const RewardsCatalog: React.FC<RewardsCatalogProps> = ({ className }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [redeemingReward, setRedeemingReward] = useState<string | null>(null);

  const {
    account,
    availableRewards,
    unavailableRewards,
    redeemReward,
    isLoadingRewards,
    isRedeeming
  } = useLoyaltyManagement();

  const allRewards = [...availableRewards, ...unavailableRewards];

  const categories = [
    { id: 'all', name: 'All Rewards', icon: Gift },
    { id: 'discount_percentage', name: 'Percentage Off', icon: Percent },
    { id: 'discount_fixed', name: 'Dollar Off', icon: Gift },
    { id: 'free_shipping', name: 'Free Shipping', icon: Truck },
  ];

  const filteredRewards = selectedCategory === 'all' 
    ? allRewards 
    : allRewards.filter(reward => reward.reward_type === selectedCategory);

  const handleRedeemReward = async (rewardId: string) => {
    setRedeemingReward(rewardId);
    try {
      await redeemReward(rewardId);
    } catch (error) {
      console.error('Failed to redeem reward:', error);
    } finally {
      setRedeemingReward(null);
    }
  };

  const getRewardIcon = (rewardType: string) => {
    switch (rewardType) {
      case 'discount_percentage':
        return Percent;
      case 'discount_fixed':
        return Gift;
      case 'free_shipping':
        return Truck;
      case 'product':
        return Gift;
      default:
        return Gift;
    }
  };

  const getRewardValue = (reward: LoyaltyReward) => {
    switch (reward.reward_type) {
      case 'discount_percentage':
        return `${reward.reward_value}% OFF`;
      case 'discount_fixed':
        return `$${reward.reward_value} OFF`;
      case 'free_shipping':
        return 'FREE SHIPPING';
      default:
        return 'REWARD';
    }
  };

  if (isLoadingRewards) {
    return (
      <div className={cn('space-y-6', className)}>
        <div className="animate-pulse space-y-4">
          <div className="h-12 bg-gray-200 rounded"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-48 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Rewards Catalog</h2>
        {account && (
          <Badge variant="outline" className="text-vnsh-red border-vnsh-red">
            {formatPoints(account.points_balance)} points available
          </Badge>
        )}
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2">
        {categories.map((category) => {
          const Icon = category.icon;
          return (
            <Button
              key={category.id}
              variant={selectedCategory === category.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory(category.id)}
              className={cn(
                'flex items-center space-x-2',
                selectedCategory === category.id && 'bg-vnsh-red hover:bg-[#0f4a1c]'
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{category.name}</span>
            </Button>
          );
        })}
      </div>

      {/* Rewards Grid */}
      {filteredRewards.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center py-12">
            <Gift className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No rewards available in this category</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRewards.map((reward) => {
            const isAvailable = availableRewards.some(r => r.id === reward.id);
            const unavailableReward = unavailableRewards.find(r => r.id === reward.id);
            const RewardIcon = getRewardIcon(reward.reward_type);
            
            return (
              <RewardCard
                key={reward.id}
                reward={reward}
                isAvailable={isAvailable}
                unavailableReason={unavailableReward?.reason}
                isRedeeming={redeemingReward === reward.id}
                onRedeem={() => handleRedeemReward(reward.id)}
                RewardIcon={RewardIcon}
                rewardValue={getRewardValue(reward)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

interface RewardCardProps {
  reward: LoyaltyReward;
  isAvailable: boolean;
  unavailableReason?: string;
  isRedeeming: boolean;
  onRedeem: () => void;
  RewardIcon: React.ComponentType<{ className?: string }>;
  rewardValue: string;
}

const RewardCard: React.FC<RewardCardProps> = ({
  reward,
  isAvailable,
  unavailableReason,
  isRedeeming,
  onRedeem,
  RewardIcon,
  rewardValue
}) => {
  return (
    <Card className={cn(
      'relative overflow-hidden transition-all duration-200',
      isAvailable ? 'hover:shadow-lg border-green-200' : 'opacity-75'
    )}>
      {/* Tier Required Badge */}
      {reward.tier_required && (
        <div className="absolute top-2 right-2">
          <Badge variant="secondary" className="bg-purple-100 text-purple-800">
            <Crown className="h-3 w-3 mr-1" />
            {reward.tier_required.replace('tier_', '').toUpperCase()}
          </Badge>
        </div>
      )}

      <CardHeader className="pb-3">
        <div className="flex items-center space-x-3">
          <div className={cn(
            'p-2 rounded-full',
            isAvailable ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'
          )}>
            <RewardIcon className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-lg">{reward.name}</CardTitle>
            <div className="text-2xl font-bold text-vnsh-red">
              {rewardValue}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <p className="text-sm text-gray-600">{reward.description}</p>

        {/* Minimum Order */}
        {reward.minimum_order && (
          <p className="text-xs text-gray-500">
            Minimum order: ${reward.minimum_order}
          </p>
        )}

        {/* Points Cost */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Cost:</span>
          <span className="text-lg font-bold text-vnsh-red">
            {formatPoints(reward.points_cost)} points
          </span>
        </div>

        {/* Status Alert */}
        {!isAvailable && unavailableReason && (
          <Alert variant="destructive" className="py-2">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              {unavailableReason}
            </AlertDescription>
          </Alert>
        )}

        {/* Redeem Button */}
        <Button
          onClick={onRedeem}
          disabled={!isAvailable || isRedeeming}
          className={cn(
            'w-full',
            isAvailable
              ? 'bg-vnsh-green hover:bg-[#0f4a1c]'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          )}
        >
          {isRedeeming ? (
            'Redeeming...'
          ) : isAvailable ? (
            <>
              <CheckCircle className="h-4 w-4 mr-2" />
              Redeem Now
            </>
          ) : (
            'Not Available'
          )}
        </Button>
      </CardContent>
    </Card>
  );
};

export default RewardsCatalog;
