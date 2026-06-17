import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useLoyaltyManagement } from '@/hooks/useLoyalty';
import { formatPoints } from '@/services/omnicart/loyalty';
import { Award, Crown, Medal, Gem, TrendingUp, Gift } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoyaltyDashboardProps {
  className?: string;
}

export const LoyaltyDashboard: React.FC<LoyaltyDashboardProps> = ({ className }) => {
  const {
    account,
    nextTier,
    tierProgress,
    pointsToNextTier,
    isLoadingAccount
  } = useLoyaltyManagement();

  if (isLoadingAccount) {
    return (
      <div className={cn('space-y-6', className)}>
        <div className="animate-pulse space-y-4">
          <div className="h-32 bg-gray-200 rounded-lg"></div>
          <div className="h-24 bg-gray-200 rounded-lg"></div>
          <div className="h-20 bg-gray-200 rounded-lg"></div>
        </div>
      </div>
    );
  }

  if (!account) {
    return (
      <Card className={className}>
        <CardContent className="pt-6 text-center py-12">
          <Award className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">Unable to load loyalty information</p>
        </CardContent>
      </Card>
    );
  }

  const getTierIcon = (tierName: string) => {
    switch (tierName.toLowerCase()) {
      case 'bronze':
        return Award;
      case 'silver':
        return Medal;
      case 'gold':
        return Crown;
      case 'platinum':
        return Gem;
      default:
        return Award;
    }
  };

  const TierIcon = getTierIcon(account.tier.name);

  return (
    <div className={cn('space-y-6', className)}>
      {/* Points Balance Card */}
      <Card className="bg-gradient-to-r from-vnsh-red to-red-600 text-white">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-100 text-sm font-medium">Available Points</p>
              <p className="text-3xl font-bold">{formatPoints(account.points_balance)}</p>
            </div>
            <div className="bg-white/20 p-3 rounded-full">
              <Gift className="h-8 w-8" />
            </div>
          </div>
          
          <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-red-100">Total Earned</p>
              <p className="font-semibold">{formatPoints(account.points_earned_total)}</p>
            </div>
            <div>
              <p className="text-red-100">Total Redeemed</p>
              <p className="font-semibold">{formatPoints(account.points_redeemed_total)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Current Tier Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <TierIcon className="h-5 w-5" style={{ color: account.tier.color }} />
            <span>Current Tier: {account.tier.name}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span>Points Multiplier</span>
            <Badge variant="secondary" className="bg-green-100 text-green-800">
              {account.tier.multiplier}x
            </Badge>
          </div>
          
          <div>
            <h4 className="font-medium mb-2">Tier Benefits</h4>
            <ul className="space-y-1 text-sm text-gray-600">
              {account.tier.benefits.map((benefit, index) => (
                <li key={index} className="flex items-start space-x-2">
                  <span className="text-vnsh-red mt-1">•</span>
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Tier Progress Card */}
      {nextTier && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-vnsh-red" />
              <span>Progress to {nextTier.name}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Progress</span>
                <span>{Math.round(tierProgress)}%</span>
              </div>
              <Progress value={tierProgress} className="h-2" />
            </div>
            
            <div className="text-center">
              <p className="text-sm text-gray-600">
                {formatPoints(pointsToNextTier)} more points needed
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Unlock {nextTier.multiplier}x points and exclusive benefits
              </p>
            </div>
            
            <div className="bg-gray-50 p-3 rounded-lg">
              <h4 className="font-medium text-sm mb-2 flex items-center">
                <span style={{ color: nextTier.color }}>★</span>
                <span className="ml-1">{nextTier.name} Benefits</span>
              </h4>
              <ul className="space-y-1 text-xs text-gray-600">
                {nextTier.benefits.slice(0, 3).map((benefit, index) => (
                  <li key={index} className="flex items-start space-x-2">
                    <span className="text-vnsh-red mt-0.5">•</span>
                    <span>{benefit}</span>
                  </li>
                ))}
                {nextTier.benefits.length > 3 && (
                  <li className="text-gray-500 italic">
                    +{nextTier.benefits.length - 3} more benefits
                  </li>
                )}
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-2xl font-bold text-vnsh-red">
              {account.tier.multiplier}x
            </div>
            <p className="text-sm text-gray-600">Points Multiplier</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-2xl font-bold text-vnsh-red">
              {formatPoints(account.points_earned_total)}
            </div>
            <p className="text-sm text-gray-600">Lifetime Points</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default LoyaltyDashboard;
