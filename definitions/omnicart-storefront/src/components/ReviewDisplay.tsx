import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { StarRating, RatingDistributionBar } from '@/components/StarRating';
import { useReviewManagement } from '@/hooks/useReviews';
import { formatReviewDate, type ProductReview, type ReviewFilters } from '@/services/medusa/reviews';
import { ThumbsUp, Filter, ChevronDown, ChevronUp, Verified } from 'lucide-react';
import { cn } from '@/lib/utils';
import ReviewForm from '@/components/ReviewForm';

interface ReviewDisplayProps {
  productId: string;
  className?: string;
}

export const ReviewDisplay: React.FC<ReviewDisplayProps> = ({ productId, className }) => {
  const [filters, setFilters] = useState<ReviewFilters>({
    sort_by: 'newest',
    limit: 10
  });
  const [showFilters, setShowFilters] = useState(false);

  const {
    reviews,
    reviewCount,
    summary,
    markAsHelpful,
    isLoadingReviews,
    isLoadingSummary
  } = useReviewManagement(productId);

  const handleFilterChange = (newFilters: Partial<ReviewFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  const handleMarkHelpful = (reviewId: string) => {
    markAsHelpful(reviewId);
  };

  if (isLoadingSummary || isLoadingReviews) {
    return (
      <div className={cn('space-y-6', className)}>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-20 bg-gray-200 rounded"></div>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Review Summary */}
      {summary && (
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Overall Rating */}
              <div className="text-center md:text-left">
                <div className="flex items-center justify-center md:justify-start space-x-2 mb-2">
                  <span className="text-3xl font-bold">{summary.average_rating.toFixed(1)}</span>
                  <StarRating rating={summary.average_rating} size="lg" />
                </div>
                <p className="text-gray-600">
                  Based on {summary.total_reviews} review{summary.total_reviews !== 1 ? 's' : ''}
                </p>
              </div>

              {/* Rating Distribution */}
              <div className="space-y-1">
                {[5, 4, 3, 2, 1].map(rating => (
                  <RatingDistributionBar
                    key={rating}
                    rating={rating}
                    count={summary.rating_distribution[rating as keyof typeof summary.rating_distribution]}
                    total={summary.total_reviews}
                    onClick={() => handleFilterChange({ rating })}
                  />
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">
            Customer Reviews ({reviewCount})
          </h3>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center space-x-2"
          >
            <Filter className="h-4 w-4" />
            <span>Filter</span>
            {showFilters ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>

        {showFilters && (
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Sort By */}
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    Sort by
                  </label>
                  <select
                    value={filters.sort_by}
                    onChange={(e) => handleFilterChange({ sort_by: e.target.value as ReviewFilters['sort_by'] })}
                    className="w-full p-2 border border-gray-300 rounded-md text-sm"
                  >
                    <option value="newest">Newest first</option>
                    <option value="oldest">Oldest first</option>
                    <option value="highest_rating">Highest rating</option>
                    <option value="lowest_rating">Lowest rating</option>
                    <option value="most_helpful">Most helpful</option>
                  </select>
                </div>

                {/* Rating Filter */}
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    Rating
                  </label>
                  <select
                    value={filters.rating || ''}
                    onChange={(e) => handleFilterChange({ 
                      rating: e.target.value ? parseInt(e.target.value) : undefined 
                    })}
                    className="w-full p-2 border border-gray-300 rounded-md text-sm"
                  >
                    <option value="">All ratings</option>
                    <option value="5">5 stars</option>
                    <option value="4">4 stars</option>
                    <option value="3">3 stars</option>
                    <option value="2">2 stars</option>
                    <option value="1">1 star</option>
                  </select>
                </div>

                {/* Verified Only */}
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    Review type
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={filters.verified_only || false}
                      onChange={(e) => handleFilterChange({ verified_only: e.target.checked })}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm">Verified purchases only</span>
                  </label>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Reviews List */}
      <div className="space-y-4">
        {reviews.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center py-12">
              <p className="text-gray-500">No reviews found matching your criteria.</p>
            </CardContent>
          </Card>
        ) : (
          reviews.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              onMarkHelpful={() => handleMarkHelpful(review.id)}
            />
          ))
        )}
      </div>
    </div>
  );
};

interface ReviewCardProps {
  review: ProductReview;
  onMarkHelpful: () => void;
}

const ReviewCard: React.FC<ReviewCardProps> = ({ review, onMarkHelpful }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const shouldTruncate = review.content.length > 300;
  const displayContent = shouldTruncate && !isExpanded 
    ? review.content.substring(0, 300) + '...'
    : review.content;

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <StarRating rating={review.rating} size="sm" />
                {review.is_verified && (
                  <Badge variant="secondary" className="text-xs">
                    <Verified className="h-3 w-3 mr-1" />
                    Verified Purchase
                  </Badge>
                )}
              </div>
              
              {review.title && (
                <h4 className="font-medium text-gray-900">{review.title}</h4>
              )}
              
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <span>
                  {review.customer?.first_name} {review.customer?.last_name?.charAt(0)}.
                </span>
                <span>•</span>
                <span>{formatReviewDate(review.created_at)}</span>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="space-y-2">
            <p className="text-gray-700 leading-relaxed">{displayContent}</p>
            
            {shouldTruncate && (
              <Button
                variant="link"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-0 h-auto text-vnsh-red hover:text-red-700"
              >
                {isExpanded ? 'Show less' : 'Read more'}
              </Button>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <Button
              variant="ghost"
              size="sm"
              onClick={onMarkHelpful}
              className="text-gray-600 hover:text-vnsh-red"
            >
              <ThumbsUp className="h-4 w-4 mr-1" />
              Helpful ({review.helpful_count})
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ReviewDisplay;

// Combined Reviews Section Component
interface ReviewsSectionProps {
  productId: string;
  productTitle: string;
  className?: string;
}

export const ReviewsSection: React.FC<ReviewsSectionProps> = ({
  productId,
  productTitle,
  className
}) => {
  const [showReviewForm, setShowReviewForm] = useState(false);
  const { canReview } = useReviewManagement(productId);

  return (
    <div className={cn('space-y-6', className)}>
      {/* Write Review Button */}
      {canReview && !showReviewForm && (
        <div className="text-center">
          <Button
            onClick={() => setShowReviewForm(true)}
            className="bg-vnsh-red hover:bg-[#0f4a1c]"
          >
            Write a Review
          </Button>
        </div>
      )}

      {/* Review Form */}
      {showReviewForm && (
        <ReviewForm
          productId={productId}
          productTitle={productTitle}
          onSuccess={() => setShowReviewForm(false)}
          onCancel={() => setShowReviewForm(false)}
        />
      )}

      {/* Reviews Display */}
      <ReviewDisplay productId={productId} />
    </div>
  );
};
