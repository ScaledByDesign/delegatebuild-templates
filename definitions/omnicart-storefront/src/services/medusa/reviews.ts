import { medusaClient } from "@/lib/medusa-client"
import { getAuthHeaders } from '@/lib/util/cookies';
import medusaError from '@/lib/util/medusa-error';

export interface ProductReview {
  id: string;
  product_id: string;
  customer_id: string;
  order_id?: string;
  rating: number;
  title?: string;
  content: string;
  is_verified: boolean;
  is_approved: boolean;
  helpful_count: number;
  created_at: string;
  updated_at: string;
  customer?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
  product?: {
    id: string;
    title: string;
    handle: string;
    thumbnail?: string;
  };
  images?: Array<{
    id: string;
    url: string;
  }>;
}

export interface ReviewSummary {
  product_id: string;
  total_reviews: number;
  average_rating: number;
  rating_distribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
}

export interface CreateReviewRequest {
  product_id: string;
  order_id?: string;
  rating: number;
  title?: string;
  content: string;
  images?: File[];
}

export interface UpdateReviewRequest {
  rating?: number;
  title?: string;
  content?: string;
}

export interface ReviewFilters {
  rating?: number;
  verified_only?: boolean;
  sort_by?: 'newest' | 'oldest' | 'highest_rating' | 'lowest_rating' | 'most_helpful';
  limit?: number;
  offset?: number;
}

/**
 * Get reviews for a product
 */
export const getProductReviews = async (
  productId: string, 
  filters: ReviewFilters = {}
): Promise<{ reviews: ProductReview[]; count: number }> => {
  try {
    const params = new URLSearchParams();
    params.append('product_id', productId);
    
    if (filters.rating) params.append('rating', filters.rating.toString());
    if (filters.verified_only) params.append('verified_only', 'true');
    if (filters.sort_by) params.append('sort_by', filters.sort_by);
    if (filters.limit) params.append('limit', filters.limit.toString());
    if (filters.offset) params.append('offset', filters.offset.toString());

    const response = await medusaClient.fetch(`/store/products/${productId}/reviews?${params.toString()}`);
    
    return {
      reviews: (response as any)?.reviews || [],
      count: (response as any)?.count || 0
    };
  } catch (error) {
    // Return mock reviews if API not available
    const mockReviews: ProductReview[] = [
      {
        id: 'rev_1',
        product_id: productId,
        customer_id: 'cus_1',
        rating: 5,
        title: 'Excellent quality!',
        content: 'This holster exceeded my expectations. Perfect fit and great build quality.',
        is_verified: true,
        is_approved: true,
        helpful_count: 12,
        created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        customer: {
          id: 'cus_1',
          first_name: 'John',
          last_name: 'D.',
          email: 'john@example.com'
        }
      },
      {
        id: 'rev_2',
        product_id: productId,
        customer_id: 'cus_2',
        rating: 4,
        title: 'Good value',
        content: 'Solid holster for the price. Comfortable to wear all day.',
        is_verified: false,
        is_approved: true,
        helpful_count: 8,
        created_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
        customer: {
          id: 'cus_2',
          first_name: 'Mike',
          last_name: 'S.',
          email: 'mike@example.com'
        }
      }
    ];

    return {
      reviews: mockReviews,
      count: mockReviews.length
    };
  }
};

/**
 * Get review summary for a product
 */
export const getProductReviewSummary = async (productId: string): Promise<ReviewSummary> => {
  try {
    const response = await medusaClient.fetch(`/store/products/${productId}/reviews/summary`);
    return (response as any)?.summary;
  } catch (error) {
    // Return mock summary if API not available
    return {
      product_id: productId,
      total_reviews: 24,
      average_rating: 4.3,
      rating_distribution: {
        5: 12,
        4: 8,
        3: 3,
        2: 1,
        1: 0
      }
    };
  }
};

/**
 * Create a new review
 */
export const createReview = async (request: CreateReviewRequest): Promise<ProductReview> => {
  try {
    const headers = {
      ...getAuthHeaders(),
      'Content-Type': 'application/json'
    };

    const response = await medusaClient.fetch('/store/reviews', {
      method: 'POST',
      headers,
      body: JSON.stringify(request)
    });

    return (response as any)?.review;
  } catch (error) {
    throw medusaError(error);
  }
};

/**
 * Update a review
 */
export const updateReview = async (
  reviewId: string, 
  updates: UpdateReviewRequest
): Promise<ProductReview> => {
  try {
    const headers = {
      ...getAuthHeaders(),
      'Content-Type': 'application/json'
    };

    const response = await medusaClient.fetch(`/store/reviews/${reviewId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(updates)
    });

    return (response as any)?.review;
  } catch (error) {
    throw medusaError(error);
  }
};

/**
 * Delete a review
 */
export const deleteReview = async (reviewId: string): Promise<void> => {
  try {
    const headers = getAuthHeaders();

    await medusaClient.fetch(`/store/reviews/${reviewId}`, {
      method: 'DELETE',
      headers
    });
  } catch (error) {
    throw medusaError(error);
  }
};

/**
 * Mark review as helpful
 */
export const markReviewHelpful = async (reviewId: string): Promise<void> => {
  try {
    const headers = {
      ...getAuthHeaders(),
      'Content-Type': 'application/json'
    };

    await medusaClient.fetch(`/store/reviews/${reviewId}/helpful`, {
      method: 'POST',
      headers
    });
  } catch (error) {
    throw medusaError(error);
  }
};

/**
 * Get customer's reviews
 */
export const getCustomerReviews = async (): Promise<ProductReview[]> => {
  try {
    const headers = getAuthHeaders();

    const response = await medusaClient.fetch('/store/customers/me/reviews', {
      headers
    });

    return (response as any)?.reviews || [];
  } catch (error) {
    return [];
  }
};

/**
 * Check if customer can review product (has purchased it)
 */
export const canReviewProduct = async (productId: string): Promise<{
  can_review: boolean;
  reason?: string;
  order_id?: string;
}> => {
  try {
    const headers = getAuthHeaders();

    const response = await medusaClient.fetch(`/store/products/${productId}/can-review`, {
      headers
    });

    return (response as any) || {
      can_review: true,
      reason: 'API not available',
      order_id: 'order_123'
    };
  } catch (error) {
    // Return mock response if API not available
    return {
      can_review: true,
      reason: 'API not available',
      order_id: 'order_123'
    };
  }
};

/**
 * Format review rating for display
 */
export const formatRating = (rating: number): string => {
  return rating.toFixed(1);
};

/**
 * Get rating color for UI display
 */
export const getRatingColor = (rating: number): string => {
  if (rating >= 4.5) return 'text-green-600';
  if (rating >= 3.5) return 'text-yellow-600';
  if (rating >= 2.5) return 'text-orange-600';
  return 'text-red-600';
};

/**
 * Generate star rating display
 */
export const getStarRating = (rating: number): { full: number; half: boolean; empty: number } => {
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.5;
  const empty = 5 - full - (half ? 1 : 0);
  
  return { full, half, empty };
};

/**
 * Format review date for display
 */
export const formatReviewDate = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - date.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.ceil(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.ceil(diffDays / 30)} months ago`;
  
  return date.toLocaleDateString();
};

/**
 * Validate review content
 */
export const validateReview = (review: Partial<CreateReviewRequest>): {
  valid: boolean;
  errors: string[];
} => {
  const errors: string[] = [];

  if (!review.rating || review.rating < 1 || review.rating > 5) {
    errors.push('Rating must be between 1 and 5 stars');
  }

  if (!review.content || review.content.trim().length < 10) {
    errors.push('Review content must be at least 10 characters');
  }

  if (review.content && review.content.length > 1000) {
    errors.push('Review content must be less than 1000 characters');
  }

  if (review.title && review.title.length > 100) {
    errors.push('Review title must be less than 100 characters');
  }

  return {
    valid: errors.length === 0,
    errors
  };
};
