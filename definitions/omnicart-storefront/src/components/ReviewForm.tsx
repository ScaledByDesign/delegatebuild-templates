import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { InteractiveStarRating } from '@/components/StarRating';
import { useReviewManagement } from '@/hooks/useReviews';
import { validateReview, type CreateReviewRequest } from '@/services/medusa/reviews';
import { AlertCircle, CheckCircle } from 'lucide-react';

interface ReviewFormProps {
  productId: string;
  productTitle: string;
  onSuccess?: () => void;
  onCancel?: () => void;
  className?: string;
}

export const ReviewForm: React.FC<ReviewFormProps> = ({
  productId,
  productTitle,
  onSuccess,
  onCancel,
  className
}) => {
  const [formData, setFormData] = useState({
    rating: 0,
    title: '',
    content: ''
  });
  const [errors, setErrors] = useState<string[]>([]);
  const [showSuccess, setShowSuccess] = useState(false);

  const { submitReview, isSubmitting, canReview, canReviewReason } = useReviewManagement(productId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form
    const validation = validateReview(formData);
    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    try {
      await submitReview(formData);
      setShowSuccess(true);
      setFormData({ rating: 0, title: '', content: '' });
      setErrors([]);
      
      // Call success callback after a delay
      setTimeout(() => {
        setShowSuccess(false);
        onSuccess?.();
      }, 2000);
    } catch (error) {
      console.error('Failed to submit review:', error);
    }
  };

  const handleInputChange = (field: keyof typeof formData, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear errors when user starts typing
    if (errors.length > 0) {
      setErrors([]);
    }
  };

  if (!canReview) {
    return (
      <Card className={className}>
        <CardContent className="pt-6">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {canReviewReason || 'You need to purchase this product before you can leave a review.'}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (showSuccess) {
    return (
      <Card className={className}>
        <CardContent className="pt-6">
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              Thank you for your review! It will be published after moderation.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-lg">Write a Review</CardTitle>
        <p className="text-sm text-gray-600">
          Share your experience with {productTitle}
        </p>
      </CardHeader>
      
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Rating */}
          <InteractiveStarRating
            rating={formData.rating}
            onChange={(rating) => handleInputChange('rating', rating)}
            label="Overall Rating *"
          />

          {/* Title */}
          <div className="space-y-2">
            <label htmlFor="review-title" className="text-sm font-medium text-gray-700">
              Review Title (Optional)
            </label>
            <Input
              id="review-title"
              type="text"
              placeholder="Summarize your experience..."
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              maxLength={100}
              className="w-full"
            />
            <p className="text-xs text-gray-500">
              {formData.title.length}/100 characters
            </p>
          </div>

          {/* Content */}
          <div className="space-y-2">
            <label htmlFor="review-content" className="text-sm font-medium text-gray-700">
              Your Review *
            </label>
            <Textarea
              id="review-content"
              placeholder="Tell others about your experience with this product..."
              value={formData.content}
              onChange={(e) => handleInputChange('content', e.target.value)}
              maxLength={1000}
              rows={4}
              className="w-full resize-none"
            />
            <p className="text-xs text-gray-500">
              {formData.content.length}/1000 characters (minimum 10 characters)
            </p>
          </div>

          {/* Errors */}
          {errors.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <ul className="list-disc list-inside space-y-1">
                  {errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Actions */}
          <div className="flex space-x-3">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-vnsh-red hover:bg-[#0f4a1c]"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Review'}
            </Button>
            
            {onCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
            )}
          </div>

          {/* Guidelines */}
          <div className="text-xs text-gray-500 space-y-1">
            <p className="font-medium">Review Guidelines:</p>
            <ul className="list-disc list-inside space-y-0.5 ml-2">
              <li>Be honest and helpful to other customers</li>
              <li>Focus on the product's features and your experience</li>
              <li>Avoid inappropriate language or personal information</li>
              <li>Reviews are moderated and may take 24-48 hours to appear</li>
            </ul>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default ReviewForm;
