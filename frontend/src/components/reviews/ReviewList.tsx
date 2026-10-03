import React, { useState, useCallback, useMemo } from 'react';
import { motion } from 'motion/react';
import {
  Star,
  CheckCircle,
  Trash,
  ChatCircleText,
  CaretDown,
  CaretUp
} from '@phosphor-icons/react';
import { ReviewResponse, ProductReviewSummary } from '@/types/review';
import { reviewApi } from '@/services/reviewApi';
import { useAuthStore } from '@/store/useAuthStore';
import { toast } from 'sonner';

interface ReviewListProps {
  productId: string;
  summary: ProductReviewSummary | null;
  onDeleteReview?: (reviewId: string) => Promise<void>;
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
}

export const ReviewList: React.FC<ReviewListProps> = ({
  productId,
  summary,
  onDeleteReview,
  onLoadMore,
  hasMore = false,
  isLoadingMore = false
}) => {
  const { user } = useAuthStore();
  const [reviews, setReviews] = useState<ReviewResponse[]>(summary?.reviews || []);
  const [sortBy, setSortBy] = useState<'newest' | 'highest' | 'lowest' | 'helpful'>('newest');
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedReviews, setExpandedReviews] = useState<Set<string>>(new Set());

  const reviewsPerPage = 10;

  // Sort reviews
  const sortedReviews = useMemo(() => {
    const reviewArray = [...reviews];
    switch (sortBy) {
      case 'newest':
        return reviewArray.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      case 'highest':
        return reviewArray.sort((a, b) => b.rating - a.rating);
      case 'lowest':
        return reviewArray.sort((a, b) => a.rating - b.rating);
      case 'helpful':
        // Placeholder for helpful sorting - would need backend support
        return reviewArray;
      default:
        return reviewArray;
    }
  }, [reviews, sortBy]);

  // Paginated reviews
  const displayedReviews = sortedReviews.slice(0, page * reviewsPerPage);

  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;

    try {
      setIsLoading(true);
      const nextPage = page + 1;
      const data = await reviewApi.getProductReviews(productId, (nextPage - 1) * reviewsPerPage, reviewsPerPage);

      if (data.reviews.length > 0) {
        setReviews(prev => [...prev, ...data.reviews]);
        setPage(nextPage);
        onLoadMore?.();
      } else {
        // No more reviews
        return false;
      }
    } catch {
      // Error handled gracefully
    } finally {
      setIsLoading(false);
    }
  }, [productId, page, isLoadingMore, hasMore, onLoadMore]);

  // Handle delete review
  const handleDeleteReview = async (reviewId: string) => {
    if (!confirm('Are you sure you want to delete this review?')) return;
    try {
      await onDeleteReview?.(reviewId);
      setReviews(prev => prev.filter(r => r.id !== reviewId));
      toast.success('Review deleted');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete review');
    }
  };

  const toggleExpand = (reviewId: string) => {
    setExpandedReviews(prev => {
      const newSet = new Set(prev);
      if (newSet.has(reviewId)) {
        newSet.delete(reviewId);
      } else {
        newSet.add(reviewId);
      }
      return newSet;
    });
  };

  const averageRating = summary?.average_rating || 0;
  const totalReviews = summary?.total_reviews || 0;
  const distribution = summary?.rating_distribution || {};

  if (reviews.length === 0 && totalReviews === 0) {
    return (
      <div className="py-16 text-center rounded-3xl border border-dashed border-zinc-200">
        <ChatCircleText size={36} className="mx-auto text-zinc-300 mb-2" />
        <p className="text-sm font-medium text-zinc-600">No reviews yet for this product</p>
        <p className="text-xs text-zinc-400 mt-1">Be the first verified customer to share your thoughts!</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
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

      {/* Sort and Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 p-4 rounded-2xl bg-white border border-zinc-200/80">
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-zinc-600">Sort by:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'newest' | 'highest' | 'lowest' | 'helpful')}
            className="px-3 py-1.5 text-sm text-zinc-800 bg-white border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 cursor-pointer"
          >
            <option value="newest">Most Recent</option>
            <option value="highest">Highest Rated</option>
            <option value="lowest">Lowest Rated</option>
            <option value="helpful">Most Helpful</option>
          </select>
        </div>

        <div className="text-xs text-zinc-400">
          Showing {displayedReviews.length} of {reviews.length} reviews ({totalReviews} total)
        </div>
      </div>

      {/* Review List */}
      <div className="space-y-6" role="list" aria-label="Customer reviews">
        {displayedReviews.map((rev, index) => (
          <motion.div
            key={rev.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="p-6 rounded-3xl bg-white border border-zinc-100 shadow-sm hover:shadow-md transition-shadow"
            role="listitem"
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
              {user && (user.id === rev.user_id || user.role === 'admin') && onDeleteReview && (
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
              <p
                className={`mt-4 text-sm text-zinc-700 leading-relaxed font-normal ${!expandedReviews.has(rev.id) && rev.comment.length > 200 ? 'line-clamp-3' : ''}`}
              >
                {rev.comment}
              </p>
            )}

            {rev.comment && rev.comment.length > 200 && (
              <button
                type="button"
                onClick={() => toggleExpand(rev.id)}
                className="mt-2 text-xs text-zinc-500 hover:text-zinc-700 flex items-center gap-1"
              >
                {expandedReviews.has(rev.id) ? (
                  <>
                    <CaretUp size={12} />
                    Show less
                  </>
                ) : (
                  <>
                    <CaretDown size={12} />
                    Read more
                  </>
                )}
              </button>
            )}

            {/* Image Gallery - placeholder for future implementation */}
            {/* {rev.images && rev.images.length > 0 && (
              <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
                {rev.images.map((img, i) => (
                  <img key={i} src={img} alt={`Review image ${i + 1}`} className="w-24 h-24 rounded-lg object-cover" />
                ))}
              </div>
            )} */}
          </motion.div>
        ))}

        {/* Load More Button */}
        {(hasMore || displayedReviews.length < reviews.length) && (
          <div className="text-center pt-4">
            <button
              onClick={loadMore}
              disabled={isLoading || isLoadingMore}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white text-zinc-700 border border-zinc-200 text-sm font-medium hover:bg-zinc-50 transition-all disabled:opacity-50"
            >
              {isLoading || isLoadingMore ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Loading...
                </>
              ) : displayedReviews.length < reviews.length ? (
                'Load More Reviews'
              ) : (
                'Load Older Reviews'
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};