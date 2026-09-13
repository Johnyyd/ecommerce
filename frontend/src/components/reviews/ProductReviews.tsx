import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Star, 
  CheckCircle, 
  Trash, 
  ChatCircleText, 
  ShieldCheck, 
  Info 
} from '@phosphor-icons/react';
import { reviewApi } from '@/services/reviewApi';
import { getUserOrders, OrderResponse } from '@/lib/api/orders';
import { ProductReviewSummary } from '@/types/review';
import { useAuthStore } from '@/store/useAuthStore';
import { toast } from 'sonner';

interface ProductReviewsProps {
  productId: string;
}

export const ProductReviews: React.FC<ProductReviewsProps> = ({ productId }) => {
  const { user, isAuthenticated } = useAuthStore();
  const [summary, setSummary] = useState<ProductReviewSummary | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [eligibleOrders, setEligibleOrders] = useState<OrderResponse[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  
  // New review form states
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [comment, setComment] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);

  // Fetch reviews summary
  const loadReviews = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await reviewApi.getProductReviews(productId);
      setSummary(data);
    } catch {
      // Review fetch error handled gracefully
    } finally {
      setIsLoading(false);
    }
  }, [productId]);

  // Check eligible completed orders for verified purchase
  const checkEligibility = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const orders = await getUserOrders();
      const validOrders = orders.filter(order => {
        const hasProduct = order.items.some(item => item.product_id === productId);
        const isEligibleStatus = ['DELIVERED', 'COMPLETED', 'PROCESSING'].includes(order.status.toUpperCase());
        return hasProduct && isEligibleStatus;
      });
      setEligibleOrders(validOrders);
      if (validOrders.length > 0) {
        setSelectedOrderId(validOrders[0].id);
      }
    } catch {
      // Order fetch error handled gracefully
    }
  }, [isAuthenticated, productId]);

  useEffect(() => {
    loadReviews();
    checkEligibility();
  }, [loadReviews, checkEligibility]);

  // Handle submit review
  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderId) {
      toast.error('Please select a completed order containing this item');
      return;
    }
    if (rating < 1 || rating > 5) {
      toast.error('Please select a star rating (1-5 stars)');
      return;
    }

    try {
      setIsSubmitting(true);
      await reviewApi.createReview({
        product_id: productId,
        order_id: selectedOrderId,
        rating,
        comment: comment.trim() || undefined,
      });

      toast.success('Verified review submitted successfully!');
      setComment('');
      setIsFormOpen(false);
      await loadReviews();
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit review');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle delete review (BOLA/IDOR protected on backend)
  const handleDeleteReview = async (reviewId: string) => {
    if (!confirm('Are you sure you want to delete this review?')) return;
    try {
      await reviewApi.deleteReview(reviewId);
      toast.success('Review deleted');
      await loadReviews();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete review');
    }
  };

  const reviews = summary?.reviews || [];
  const averageRating = summary?.average_rating || 0;
  const totalReviews = summary?.total_reviews || 0;
  const distribution = summary?.rating_distribution || {};

  return (
    <section className="mt-20 border-t border-zinc-100 pt-16" aria-labelledby="reviews-heading">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div>
          <span className="text-xs font-semibold tracking-widest text-zinc-400 uppercase">
            Customer Feedback
          </span>
          <h2 id="reviews-heading" className="text-3xl font-medium tracking-tight text-zinc-900 mt-1">
            Verified Reviews ({totalReviews})
          </h2>
        </div>

        {/* Action Button: Write Review */}
        {eligibleOrders.length > 0 && !isFormOpen && (
          <button
            onClick={() => setIsFormOpen(true)}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-800 transition-all active:scale-95 shadow-sm"
          >
            <ChatCircleText size={18} weight="bold" />
            Write a Verified Review
          </button>
        )}
      </div>

      {/* Review Submission Form Modal / Card */}
      <AnimatePresence>
        {isFormOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: -10 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -10 }}
            transition={{ type: 'spring', damping: 25, stiffness: 280 }}
            className="mb-12 overflow-hidden"
          >
            <div className="p-8 rounded-3xl bg-zinc-50 border border-zinc-200/80 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2 text-emerald-700 font-medium text-sm">
                  <ShieldCheck size={20} weight="fill" />
                  <span>Review authenticated from your delivered order</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="text-xs text-zinc-400 hover:text-zinc-600 uppercase tracking-wider"
                >
                  Cancel
                </button>
              </div>

              <form onSubmit={handleSubmitReview} className="space-y-6">
                {/* Order Selector if multiple */}
                {eligibleOrders.length > 1 && (
                  <div>
                    <label className="block text-xs font-medium text-zinc-600 mb-2">
                      Select Order:
                    </label>
                    <select
                      value={selectedOrderId}
                      onChange={(e) => setSelectedOrderId(e.target.value)}
                      className="w-full max-w-sm px-4 py-2.5 rounded-xl bg-white border border-zinc-200 text-sm text-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900"
                    >
                      {eligibleOrders.map(order => (
                        <option key={order.id} value={order.id}>
                          Order #{order.id.slice(0, 8)} ({order.status})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Star Rating Picker with Motion */}
                <div>
                  <label className="block text-xs font-medium text-zinc-600 mb-2">
                    Product Rating:
                  </label>
                  <div className="flex items-center gap-1.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(0)}
                        className="p-1 text-zinc-300 hover:text-amber-400 focus:outline-none transition-colors"
                      >
                        <motion.div
                          whileHover={{ scale: 1.25 }}
                          whileTap={{ scale: 0.9 }}
                          transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                        >
                          <Star
                            size={28}
                            weight={(hoverRating || rating) >= star ? 'fill' : 'regular'}
                            className={(hoverRating || rating) >= star ? 'text-amber-400' : 'text-zinc-300'}
                          />
                        </motion.div>
                      </button>
                    ))}
                    <span className="ml-3 text-sm font-semibold text-zinc-800">
                      {rating === 5 && 'Excellent'}
                      {rating === 4 && 'Very Good'}
                      {rating === 3 && 'Average'}
                      {rating === 2 && 'Below Average'}
                      {rating === 1 && 'Poor'}
                    </span>
                  </div>
                </div>

                {/* Comment Textarea */}
                <div>
                  <label className="block text-xs font-medium text-zinc-600 mb-2">
                    Detailed Experience (Optional):
                  </label>
                  <textarea
                    rows={4}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Share your thoughts on the materials, craftsmanship, texture, and fit..."
                    className="w-full p-4 rounded-2xl bg-white border border-zinc-200 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all resize-none"
                    maxLength={1000}
                  />
                  <div className="flex justify-between text-xs text-zinc-400 mt-1">
                    <span>Max 1000 characters</span>
                    <span>{comment.length}/1000</span>
                  </div>
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    className="px-6 py-2.5 rounded-full text-sm font-medium text-zinc-600 hover:bg-zinc-200/60 transition-colors"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-6 py-2.5 rounded-full bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-800 transition-all disabled:opacity-50 active:scale-95 shadow-sm"
                  >
                    {isSubmitting ? 'Submitting...' : 'Submit Review'}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rating Overview & Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 mb-12 p-8 rounded-3xl bg-zinc-50 border border-zinc-100">
        {/* Left: Big Rating Number */}
        <div className="md:col-span-4 flex flex-col justify-center items-center md:items-start md:border-r border-zinc-200/80 md:pr-8">
          <div className="flex items-baseline gap-2">
            <span className="text-6xl font-semibold tracking-tight text-zinc-900">
              {averageRating.toFixed(1)}
            </span>
            <span className="text-xl text-zinc-400">/ 5.0</span>
          </div>
          
          <div className="flex items-center gap-1 my-3">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                size={20}
                weight={averageRating >= star ? 'fill' : averageRating >= star - 0.5 ? 'duotone' : 'regular'}
                className={averageRating >= star - 0.5 ? 'text-amber-400' : 'text-zinc-300'}
              />
            ))}
          </div>
          
          <p className="text-xs text-zinc-500">
            Based on {totalReviews} verified purchases from authentic customers
          </p>
        </div>

        {/* Right: Star breakdown progress bars */}
        <div className="md:col-span-8 flex flex-col justify-center space-y-2.5">
          {[5, 4, 3, 2, 1].map((starNum) => {
            const count = distribution[starNum] || 0;
            const percentage = totalReviews > 0 ? (count / totalReviews) * 100 : 0;
            return (
              <div key={starNum} className="flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1 w-12 text-zinc-600 font-medium">
                  <span>{starNum}</span>
                  <Star size={12} weight="fill" className="text-amber-400" />
                </div>
                <div className="flex-1 h-2 bg-zinc-200/80 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                    className="h-full bg-zinc-900 rounded-full"
                  />
                </div>
                <span className="w-10 text-right text-zinc-400 font-mono">
                  {Math.round(percentage)}%
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Verified Purchase Policy Banner */}
      {!isAuthenticated ? (
        <div className="flex items-center gap-3 p-4 mb-8 rounded-2xl bg-zinc-100/80 text-xs text-zinc-600">
          <Info size={20} className="text-zinc-400 flex-shrink-0" />
          <span>
            <a href="/login" className="font-semibold text-zinc-900 underline">Log in</a> to check eligible orders for verified customer reviews.
          </span>
        </div>
      ) : eligibleOrders.length === 0 ? (
        <div className="flex items-center gap-3 p-4 mb-8 rounded-2xl bg-zinc-100/80 text-xs text-zinc-600">
          <ShieldCheck size={20} className="text-emerald-600 flex-shrink-0" />
          <span>
            Only customers with a completed or delivered order for this product can submit a verified review.
          </span>
        </div>
      ) : null}

      {/* Review List */}
      {isLoading ? (
        <div className="py-12 text-center text-sm text-zinc-400">Loading reviews...</div>
      ) : reviews.length === 0 ? (
        <div className="py-16 text-center rounded-3xl border border-dashed border-zinc-200">
          <ChatCircleText size={36} className="mx-auto text-zinc-300 mb-2" />
          <p className="text-sm font-medium text-zinc-600">No reviews yet for this product</p>
          <p className="text-xs text-zinc-400 mt-1">Be the first verified customer to share your thoughts!</p>
        </div>
      ) : (
        <div className="space-y-6">
          {reviews.map((rev) => (
            <motion.div
              key={rev.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-6 rounded-3xl bg-white border border-zinc-100 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  {/* User Avatar Initials */}
                  <div className="w-10 h-10 rounded-full bg-zinc-900 text-white font-semibold text-xs flex items-center justify-center uppercase shadow-inner">
                    {rev.username ? rev.username.slice(0, 2) : 'CU'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-zinc-900">{rev.username}</span>
                      {rev.is_verified_purchase && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle size={12} weight="fill" />
                          Verified Buyer
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <div className="flex items-center">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            size={14}
                            weight={rev.rating >= star ? 'fill' : 'regular'}
                            className={rev.rating >= star ? 'text-amber-400' : 'text-zinc-300'}
                          />
                        ))}
                      </div>
                      <span className="text-[11px] text-zinc-400">
                        {new Date(rev.created_at).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Delete button if author or admin */}
                {user && (user.id === rev.user_id || user.role === 'admin') && (
                  <button
                    onClick={() => handleDeleteReview(rev.id)}
                    title="Delete review"
                    className="p-2 rounded-full text-zinc-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <Trash size={16} />
                  </button>
                )}
              </div>

              {rev.comment && (
                <p className="mt-4 text-sm text-zinc-700 leading-relaxed font-normal">
                  {rev.comment}
                </p>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </section>
  );
};
