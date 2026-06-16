import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useCustomer } from '@/hooks/useCustomer';
import {
  getProductReviews,
  getProductReviewSummary,
  createReview,
  updateReview,
  deleteReview,
  markReviewHelpful,
  getCustomerReviews,
  canReviewProduct,
  type ProductReview,
  type ReviewSummary,
  type CreateReviewRequest,
  type UpdateReviewRequest,
  type ReviewFilters
} from '@/services/medusa/reviews';

/**
 * Hook for fetching product reviews
 */
export const useProductReviews = (productId: string, filters: ReviewFilters = {}) => {
  return useQuery({
    queryKey: ['product-reviews', productId, filters],
    queryFn: () => getProductReviews(productId, filters),
    enabled: !!productId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

/**
 * Hook for fetching product review summary
 */
export const useProductReviewSummary = (productId: string) => {
  return useQuery({
    queryKey: ['product-review-summary', productId],
    queryFn: () => getProductReviewSummary(productId),
    enabled: !!productId,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};

/**
 * Hook for checking if customer can review a product
 */
export const useCanReviewProduct = (productId: string) => {
  const { customer } = useCustomer();
  
  return useQuery({
    queryKey: ['can-review-product', productId, customer?.id],
    queryFn: () => canReviewProduct(productId),
    enabled: !!productId && !!customer,
    staleTime: 5 * 60 * 1000,
  });
};

/**
 * Hook for fetching customer's reviews
 */
export const useCustomerReviews = () => {
  const { customer } = useCustomer();
  
  return useQuery({
    queryKey: ['customer-reviews', customer?.id],
    queryFn: getCustomerReviews,
    enabled: !!customer,
    staleTime: 5 * 60 * 1000,
  });
};

/**
 * Hook for creating reviews
 */
export const useCreateReview = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createReview,
    onSuccess: (review) => {
      toast({
        title: "Review submitted",
        description: "Thank you for your review! It will be published after moderation.",
      });
      
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['product-reviews', review.product_id] });
      queryClient.invalidateQueries({ queryKey: ['product-review-summary', review.product_id] });
      queryClient.invalidateQueries({ queryKey: ['customer-reviews'] });
      queryClient.invalidateQueries({ queryKey: ['can-review-product', review.product_id] });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Failed to submit review",
        description: error.message,
      });
    },
  });
};

/**
 * Hook for updating reviews
 */
export const useUpdateReview = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ reviewId, updates }: { reviewId: string; updates: UpdateReviewRequest }) =>
      updateReview(reviewId, updates),
    onSuccess: (review) => {
      toast({
        title: "Review updated",
        description: "Your review has been updated successfully.",
      });
      
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['product-reviews', review.product_id] });
      queryClient.invalidateQueries({ queryKey: ['product-review-summary', review.product_id] });
      queryClient.invalidateQueries({ queryKey: ['customer-reviews'] });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Failed to update review",
        description: error.message,
      });
    },
  });
};

/**
 * Hook for deleting reviews
 */
export const useDeleteReview = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ reviewId, productId }: { reviewId: string; productId: string }) => {
      return deleteReview(reviewId).then(() => ({ productId }));
    },
    onSuccess: ({ productId }) => {
      toast({
        title: "Review deleted",
        description: "Your review has been deleted successfully.",
      });
      
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['product-reviews', productId] });
      queryClient.invalidateQueries({ queryKey: ['product-review-summary', productId] });
      queryClient.invalidateQueries({ queryKey: ['customer-reviews'] });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Failed to delete review",
        description: error.message,
      });
    },
  });
};

/**
 * Hook for marking reviews as helpful
 */
export const useMarkReviewHelpful = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ reviewId, productId }: { reviewId: string; productId: string }) => {
      return markReviewHelpful(reviewId).then(() => ({ reviewId, productId }));
    },
    onSuccess: ({ productId }) => {
      toast({
        title: "Thank you!",
        description: "Your feedback has been recorded.",
      });
      
      // Invalidate product reviews to update helpful count
      queryClient.invalidateQueries({ queryKey: ['product-reviews', productId] });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });
};

/**
 * Combined hook for review management
 */
export const useReviewManagement = (productId: string) => {
  const { customer } = useCustomer();
  const createReview = useCreateReview();
  const updateReview = useUpdateReview();
  const deleteReview = useDeleteReview();
  const markHelpful = useMarkReviewHelpful();
  
  const canReviewQuery = useCanReviewProduct(productId);
  const reviewsQuery = useProductReviews(productId);
  const summaryQuery = useProductReviewSummary(productId);

  const submitReview = async (reviewData: Omit<CreateReviewRequest, 'product_id'>) => {
    if (!customer) {
      throw new Error('You must be logged in to submit a review');
    }

    const orderInfo = canReviewQuery.data;
    await createReview.mutateAsync({
      ...reviewData,
      product_id: productId,
      order_id: orderInfo?.order_id
    });
  };

  const editReview = async (reviewId: string, updates: UpdateReviewRequest) => {
    await updateReview.mutateAsync({ reviewId, updates });
  };

  const removeReview = async (reviewId: string) => {
    await deleteReview.mutateAsync({ reviewId, productId });
  };

  const markAsHelpful = async (reviewId: string) => {
    await markHelpful.mutateAsync({ reviewId, productId });
  };

  return {
    // Data
    reviews: reviewsQuery.data?.reviews || [],
    reviewCount: reviewsQuery.data?.count || 0,
    summary: summaryQuery.data,
    canReview: canReviewQuery.data?.can_review || false,
    canReviewReason: canReviewQuery.data?.reason,
    
    // Loading states
    isLoadingReviews: reviewsQuery.isLoading,
    isLoadingSummary: summaryQuery.isLoading,
    isLoadingCanReview: canReviewQuery.isLoading,
    isSubmitting: createReview.isPending,
    isUpdating: updateReview.isPending,
    isDeleting: deleteReview.isPending,
    
    // Actions
    submitReview,
    editReview,
    removeReview,
    markAsHelpful,
    
    // Refetch functions
    refetchReviews: reviewsQuery.refetch,
    refetchSummary: summaryQuery.refetch,
    refetchCanReview: canReviewQuery.refetch,
  };
};
