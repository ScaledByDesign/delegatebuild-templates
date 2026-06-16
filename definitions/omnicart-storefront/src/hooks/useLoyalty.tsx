import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useCustomer } from '@/hooks/useCustomer';
import {
  getLoyaltyAccount,
  getLoyaltyTiers,
  getPointsHistory,
  getLoyaltyRewards,
  redeemReward,
  getPointsEarningRules,
  calculatePurchasePoints,
  getTierProgress,
  getPointsToNextTier,
  canRedeemReward,
  type LoyaltyAccount,
  type LoyaltyTier,
  type PointsTransaction,
  type LoyaltyReward,
  type RedeemRewardRequest
} from '@/services/medusa/loyalty';

// Feature flag to avoid calling loyalty endpoints when backend doesn't support them
const FEATURE_LOYALTY: boolean = (import.meta as any)?.env?.VITE_FEATURE_LOYALTY === 'true';

/**
 * Hook for fetching loyalty account data
 */
export const useLoyaltyAccount = () => {
  const { customer } = useCustomer();

  return useQuery({
    queryKey: ['loyalty-account', customer?.id],
    queryFn: getLoyaltyAccount,
    enabled: FEATURE_LOYALTY && !!customer,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

/**
 * Hook for fetching loyalty tiers
 */
export const useLoyaltyTiers = () => {
  return useQuery({
    queryKey: ['loyalty-tiers'],
    queryFn: getLoyaltyTiers,
    staleTime: 30 * 60 * 1000, // 30 minutes
    enabled: FEATURE_LOYALTY,
  });
};

/**
 * Hook for fetching points history
 */
export const usePointsHistory = (limit = 20, offset = 0) => {
  const { customer } = useCustomer();

  return useQuery({
    queryKey: ['points-history', customer?.id, limit, offset],
    queryFn: () => getPointsHistory(limit, offset),
    enabled: FEATURE_LOYALTY && !!customer,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

/**
 * Hook for fetching loyalty rewards
 */
export const useLoyaltyRewards = () => {
  return useQuery({
    queryKey: ['loyalty-rewards'],
    queryFn: getLoyaltyRewards,
    staleTime: 10 * 60 * 1000, // 10 minutes
    enabled: FEATURE_LOYALTY,
  });
};

/**
 * Hook for fetching points earning rules
 */
export const usePointsEarningRules = () => {
  return useQuery({
    queryKey: ['points-earning-rules'],
    queryFn: getPointsEarningRules,
    staleTime: 30 * 60 * 1000, // 30 minutes
    enabled: FEATURE_LOYALTY,
  });
};

/**
 * Hook for redeeming rewards
 */
export const useRedeemReward = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: redeemReward,
    onSuccess: (result) => {
      if (result.success) {
        toast({
          title: "Reward redeemed!",
          description: result.coupon_code 
            ? `Your coupon code: ${result.coupon_code}`
            : result.message,
        });
        
        // Invalidate related queries
        queryClient.invalidateQueries({ queryKey: ['loyalty-account'] });
        queryClient.invalidateQueries({ queryKey: ['points-history'] });
      } else {
        toast({
          variant: "destructive",
          title: "Redemption failed",
          description: result.message,
        });
      }
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Failed to redeem reward",
        description: error.message,
      });
    },
  });
};

/**
 * Hook for calculating purchase points
 */
export const useCalculatePurchasePoints = () => {
  return useMutation({
    mutationFn: calculatePurchasePoints,
  });
};

/**
 * Combined hook for loyalty management
 */
export const useLoyaltyManagement = () => {
  const { customer } = useCustomer();
  const accountQuery = useLoyaltyAccount();
  const tiersQuery = useLoyaltyTiers();
  const rewardsQuery = useLoyaltyRewards();
  const rulesQuery = usePointsEarningRules();
  const redeemMutation = useRedeemReward();

  const account = accountQuery.data;
  const tiers = tiersQuery.data || [];
  const rewards = rewardsQuery.data || [];
  const rules = rulesQuery.data || [];

  // Helper functions
  const getTierProgressPercentage = (): number => {
    if (!account) return 0;
    return getTierProgress(account);
  };

  const getPointsNeededForNextTier = (): number => {
    if (!account) return 0;
    return getPointsToNextTier(account);
  };

  const getNextTier = (): LoyaltyTier | null => {
    if (!account || !tiers.length) return null;
    
    const currentTierIndex = tiers.findIndex(tier => tier.id === account.tier.id);
    if (currentTierIndex === -1 || currentTierIndex === tiers.length - 1) return null;
    
    return tiers[currentTierIndex + 1];
  };

  const getAvailableRewards = (): LoyaltyReward[] => {
    if (!account) return [];
    
    return rewards.filter(reward => {
      const { can_redeem } = canRedeemReward(reward, account);
      return can_redeem;
    });
  };

  const getUnavailableRewards = (): Array<LoyaltyReward & { reason: string }> => {
    if (!account) return [];
    
    return rewards
      .map(reward => {
        const { can_redeem, reason } = canRedeemReward(reward, account);
        return can_redeem ? null : { ...reward, reason: reason || 'Cannot redeem' };
      })
      .filter(Boolean) as Array<LoyaltyReward & { reason: string }>;
  };

  const redeemRewardById = async (rewardId: string, orderId?: string) => {
    if (!customer) {
      throw new Error('You must be logged in to redeem rewards');
    }

    await redeemMutation.mutateAsync({ reward_id: rewardId, order_id: orderId });
  };

  const getPointsEarningRule = (eventType: string) => {
    return rules.find(rule => rule.event_type === eventType && rule.is_active);
  };

  return {
    // Data
    account,
    tiers,
    rewards,
    rules,
    availableRewards: getAvailableRewards(),
    unavailableRewards: getUnavailableRewards(),
    nextTier: getNextTier(),
    
    // Computed values
    tierProgress: getTierProgressPercentage(),
    pointsToNextTier: getPointsNeededForNextTier(),
    
    // Loading states
    isLoadingAccount: accountQuery.isLoading,
    isLoadingTiers: tiersQuery.isLoading,
    isLoadingRewards: rewardsQuery.isLoading,
    isLoadingRules: rulesQuery.isLoading,
    isRedeeming: redeemMutation.isPending,
    
    // Actions
    redeemReward: redeemRewardById,
    getPointsEarningRule,
    
    // Refetch functions
    refetchAccount: accountQuery.refetch,
    refetchRewards: rewardsQuery.refetch,
  };
};

/**
 * Hook for loyalty points display (for navigation badge)
 */
export const useLoyaltyPoints = () => {
  const { data: account, isLoading } = useLoyaltyAccount();

  return {
    points: account?.points_balance || 0,
    tier: account?.tier,
    isLoading,
  };
};

/**
 * Hook for checking reward redemption eligibility
 */
export const useRewardEligibility = (rewardId: string) => {
  const { account, rewards } = useLoyaltyManagement();
  
  const reward = rewards.find(r => r.id === rewardId);
  
  if (!reward || !account) {
    return { canRedeem: false, reason: 'Reward not found' };
  }

  const { can_redeem, reason } = canRedeemReward(reward, account);
  
  return {
    canRedeem: can_redeem,
    reason,
    reward,
    account
  };
};
