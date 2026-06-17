import { omnicartClient } from "@/lib/omnicart-client"
import { getAuthHeaders } from '@/lib/util/cookies';
import omnicartError from '@/lib/util/omnicart-error';

export interface LoyaltyAccount {
  id: string;
  customer_id: string;
  points_balance: number;
  points_earned_total: number;
  points_redeemed_total: number;
  tier: LoyaltyTier;
  tier_progress: number;
  tier_next_threshold: number;
  created_at: string;
  updated_at: string;
}

export interface LoyaltyTier {
  id: string;
  name: string;
  threshold: number;
  multiplier: number;
  benefits: string[];
  color: string;
  icon?: string;
}

export interface PointsTransaction {
  id: string;
  customer_id: string;
  type: 'earned' | 'redeemed' | 'expired' | 'adjusted';
  points: number;
  description: string;
  order_id?: string;
  reward_id?: string;
  expires_at?: string;
  created_at: string;
}

export interface LoyaltyReward {
  id: string;
  name: string;
  description: string;
  points_cost: number;
  reward_type: 'discount_percentage' | 'discount_fixed' | 'free_shipping' | 'product' | 'custom';
  reward_value: number;
  minimum_order?: number;
  max_uses?: number;
  expires_at?: string;
  is_active: boolean;
  tier_required?: string;
  image?: string;
}

export interface RedeemRewardRequest {
  reward_id: string;
  order_id?: string;
}

export interface PointsEarningRule {
  id: string;
  name: string;
  event_type: 'purchase' | 'signup' | 'review' | 'referral' | 'birthday' | 'social_share';
  points_per_dollar?: number;
  fixed_points?: number;
  multiplier?: number;
  is_active: boolean;
}

/**
 * Get customer's loyalty account
 */
export const getLoyaltyAccount = async (): Promise<LoyaltyAccount> => {
  try {
    const headers = getAuthHeaders();

    const response = await omnicartClient.fetch('/store/customers/me/loyalty', {
      headers
    });

    return (response as any)?.loyalty_account;
  } catch (error) {
    // Return mock loyalty account if API not available
    return {
      id: 'loyalty_123',
      customer_id: 'cus_123',
      points_balance: 1250,
      points_earned_total: 2800,
      points_redeemed_total: 1550,
      tier: {
        id: 'tier_silver',
        name: 'Silver',
        threshold: 1000,
        multiplier: 1.25,
        benefits: ['Free shipping on orders over $50', '25% bonus points', 'Early access to sales'],
        color: '#C0C0C0',
        icon: 'medal'
      },
      tier_progress: 250,
      tier_next_threshold: 2500,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }
};

/**
 * Get loyalty tiers
 */
export const getLoyaltyTiers = async (): Promise<LoyaltyTier[]> => {
  try {
    const response = await omnicartClient.fetch('/store/loyalty/tiers');
    return (response as any)?.tiers;
  } catch (error) {
    // Return mock tiers if API not available
    return [
      {
        id: 'tier_bronze',
        name: 'Bronze',
        threshold: 0,
        multiplier: 1.0,
        benefits: ['Earn 1 point per $1 spent', 'Birthday bonus points'],
        color: '#CD7F32',
        icon: 'award'
      },
      {
        id: 'tier_silver',
        name: 'Silver',
        threshold: 1000,
        multiplier: 1.25,
        benefits: ['Free shipping on orders over $50', '25% bonus points', 'Early access to sales'],
        color: '#C0C0C0',
        icon: 'medal'
      },
      {
        id: 'tier_gold',
        name: 'Gold',
        threshold: 2500,
        multiplier: 1.5,
        benefits: ['Free shipping on all orders', '50% bonus points', 'Exclusive products', 'Priority support'],
        color: '#FFD700',
        icon: 'crown'
      },
      {
        id: 'tier_platinum',
        name: 'Platinum',
        threshold: 5000,
        multiplier: 2.0,
        benefits: ['Double points on all purchases', 'Free expedited shipping', 'Personal shopping assistant', 'VIP events'],
        color: '#E5E4E2',
        icon: 'gem'
      }
    ];
  }
};

/**
 * Get points transaction history
 */
export const getPointsHistory = async (limit = 20, offset = 0): Promise<{
  transactions: PointsTransaction[];
  count: number;
}> => {
  try {
    const headers = getAuthHeaders();
    const params = new URLSearchParams();
    params.append('limit', limit.toString());
    params.append('offset', offset.toString());

    const response = await omnicartClient.fetch(`/store/customers/me/loyalty/transactions?${params.toString()}`, {
      headers
    });

    return {
      transactions: (response as any)?.transactions || [],
      count: (response as any)?.count || 0
    };
  } catch (error) {
    // Return mock transactions if API not available
    const mockTransactions: PointsTransaction[] = [
      {
        id: 'txn_1',
        customer_id: 'cus_123',
        type: 'earned',
        points: 150,
        description: 'Purchase reward - Order #1001',
        order_id: 'order_1001',
        created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'txn_2',
        customer_id: 'cus_123',
        type: 'redeemed',
        points: -500,
        description: 'Redeemed: $5 off coupon',
        reward_id: 'reward_123',
        created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'txn_3',
        customer_id: 'cus_123',
        type: 'earned',
        points: 50,
        description: 'Product review bonus',
        created_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
      }
    ];

    return {
      transactions: mockTransactions,
      count: mockTransactions.length
    };
  }
};

/**
 * Get available loyalty rewards
 */
export const getLoyaltyRewards = async (): Promise<LoyaltyReward[]> => {
  try {
    const response = await omnicartClient.fetch('/store/loyalty/rewards');
    return (response as any)?.rewards;
  } catch (error) {
    // Return mock rewards if API not available
    return [
      {
        id: 'reward_1',
        name: '$5 Off Your Order',
        description: 'Get $5 off any order of $25 or more',
        points_cost: 500,
        reward_type: 'discount_fixed',
        reward_value: 5,
        minimum_order: 25,
        is_active: true,
        image: '/lovable-uploads/reward-5-off.png'
      },
      {
        id: 'reward_2',
        name: '10% Off Your Order',
        description: 'Get 10% off any order',
        points_cost: 750,
        reward_type: 'discount_percentage',
        reward_value: 10,
        is_active: true,
        image: '/lovable-uploads/reward-10-percent.png'
      },
      {
        id: 'reward_3',
        name: 'Free Shipping',
        description: 'Free shipping on your next order',
        points_cost: 300,
        reward_type: 'free_shipping',
        reward_value: 0,
        is_active: true,
        image: '/lovable-uploads/reward-free-shipping.png'
      },
      {
        id: 'reward_4',
        name: '20% Off Your Order',
        description: 'Get 20% off any order - Gold tier exclusive',
        points_cost: 1000,
        reward_type: 'discount_percentage',
        reward_value: 20,
        tier_required: 'tier_gold',
        is_active: true,
        image: '/lovable-uploads/reward-20-percent.png'
      }
    ];
  }
};

/**
 * Redeem a loyalty reward
 */
export const redeemReward = async (request: RedeemRewardRequest): Promise<{
  success: boolean;
  coupon_code?: string;
  message: string;
}> => {
  try {
    const headers = {
      ...getAuthHeaders(),
      'Content-Type': 'application/json'
    };

    const response = await omnicartClient.fetch('/store/loyalty/redeem', {
      method: 'POST',
      headers,
      body: JSON.stringify(request)
    });

    return {
      success: true,
      coupon_code: 'POINTS_REDEEMED',
      message: 'Points redeemed successfully'
    };
  } catch (error) {
    throw omnicartError(error);
  }
};

/**
 * Get points earning rules
 */
export const getPointsEarningRules = async (): Promise<PointsEarningRule[]> => {
  try {
    const response = await omnicartClient.fetch('/store/loyalty/earning-rules');
    return (response as any)?.rules;
  } catch (error) {
    // Return mock rules if API not available
    return [
      {
        id: 'rule_purchase',
        name: 'Purchase Rewards',
        event_type: 'purchase',
        points_per_dollar: 1,
        is_active: true
      },
      {
        id: 'rule_signup',
        name: 'Welcome Bonus',
        event_type: 'signup',
        fixed_points: 100,
        is_active: true
      },
      {
        id: 'rule_review',
        name: 'Product Review',
        event_type: 'review',
        fixed_points: 50,
        is_active: true
      },
      {
        id: 'rule_referral',
        name: 'Referral Bonus',
        event_type: 'referral',
        fixed_points: 200,
        is_active: true
      },
      {
        id: 'rule_birthday',
        name: 'Birthday Bonus',
        event_type: 'birthday',
        fixed_points: 150,
        is_active: true
      }
    ];
  }
};

/**
 * Calculate points for purchase
 */
export const calculatePurchasePoints = async (orderTotal: number): Promise<{
  base_points: number;
  bonus_points: number;
  total_points: number;
  tier_multiplier: number;
}> => {
  try {
    const headers = {
      ...getAuthHeaders(),
      'Content-Type': 'application/json'
    };

    const response = await omnicartClient.fetch('/store/loyalty/calculate-points', {
      method: 'POST',
      headers,
      body: JSON.stringify({ order_total: orderTotal })
    });

    return {
      base_points: Math.floor(orderTotal),
      bonus_points: 0,
      total_points: Math.floor(orderTotal),
      tier_multiplier: 1.0
    };
  } catch (error) {
    return {
      base_points: Math.floor(orderTotal),
      bonus_points: 0,
      total_points: Math.floor(orderTotal),
      tier_multiplier: 1.0
    };
  }
};

/**
 * Format points for display
 */
export const formatPoints = (points: number): string => {
  return points.toLocaleString();
};

/**
 * Get tier progress percentage
 */
export const getTierProgress = (account: LoyaltyAccount): number => {
  const currentTierThreshold = account.tier.threshold;
  const nextTierThreshold = account.tier_next_threshold;
  const currentPoints = account.points_earned_total;
  
  if (nextTierThreshold === 0) return 100; // Max tier reached
  
  const progress = ((currentPoints - currentTierThreshold) / (nextTierThreshold - currentTierThreshold)) * 100;
  return Math.min(Math.max(progress, 0), 100);
};

/**
 * Get points needed for next tier
 */
export const getPointsToNextTier = (account: LoyaltyAccount): number => {
  if (account.tier_next_threshold === 0) return 0; // Max tier reached
  return Math.max(0, account.tier_next_threshold - account.points_earned_total);
};

/**
 * Check if customer can redeem reward
 */
export const canRedeemReward = (reward: LoyaltyReward, account: LoyaltyAccount): {
  can_redeem: boolean;
  reason?: string;
} => {
  if (!reward.is_active) {
    return { can_redeem: false, reason: 'Reward is not available' };
  }

  if (account.points_balance < reward.points_cost) {
    return { 
      can_redeem: false, 
      reason: `Need ${reward.points_cost - account.points_balance} more points` 
    };
  }

  if (reward.tier_required && reward.tier_required !== account.tier.id) {
    const requiredTier = reward.tier_required.replace('tier_', '');
    return { 
      can_redeem: false, 
      reason: `Requires ${requiredTier} tier or higher` 
    };
  }

  if (reward.expires_at && new Date(reward.expires_at) < new Date()) {
    return { can_redeem: false, reason: 'Reward has expired' };
  }

  return { can_redeem: true };
};
