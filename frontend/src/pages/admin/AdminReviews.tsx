import { useState, useEffect, useMemo, useCallback } from "react"
import { motion, AnimatePresence } from "motion/react"
import {
  Star,
  Trash,
  MagnifyingGlass,
  ArrowClockwise,
  ChatCircleText,
  Package,
  User as UserIcon,
  CheckCircle,
  X
} from "@phosphor-icons/react"
import { toast } from "sonner"
import { AdminReviewItem, ProductItem } from "@/types/admin"
import { adminApi } from "@/services/adminApi"
import { Skeleton } from "@/components/ui/Skeleton"

interface AdminReviewsProps {
  products: ProductItem[]
  onRefreshAll?: () => Promise<void>
}

export function AdminReviews({ products }: AdminReviewsProps) {
  const [reviews, setReviews] = useState<AdminReviewItem[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [selectedProductId, setSelectedProductId] = useState<string>("ALL")
  const [selectedRating, setSelectedRating] = useState<number | "ALL">("ALL")
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [reviewToDelete, setReviewToDelete] = useState<AdminReviewItem | null>(null)

  const fetchReviews = useCallback(async () => {
    setIsLoading(true)
    try {
      const prodParam = selectedProductId !== "ALL" ? selectedProductId : undefined
      const ratingParam = selectedRating !== "ALL" ? selectedRating : undefined
      const data = await adminApi.getReviews(prodParam, ratingParam)
      setReviews(data)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load reviews"
      toast.error(msg)
    } finally {
      setIsLoading(false)
    }
  }, [selectedProductId, selectedRating])

  useEffect(() => {
    fetchReviews()
  }, [fetchReviews])

  const handleDeleteReview = async (reviewId: string) => {
    setDeletingId(reviewId)
    try {
      await adminApi.deleteReview(reviewId)
      toast.success("Review deleted successfully")
      setReviews(prev => prev.filter(r => r.id !== reviewId))
      setReviewToDelete(null)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete review"
      toast.error(msg)
    } finally {
      setDeletingId(null)
    }
  }

  // Filtered by search query locally
  const filteredReviews = useMemo(() => {
    if (!searchQuery.trim()) return reviews
    const query = searchQuery.toLowerCase()
    return reviews.filter(r => 
      (r.product_name && r.product_name.toLowerCase().includes(query)) ||
      (r.username && r.username.toLowerCase().includes(query)) ||
      (r.comment && r.comment.toLowerCase().includes(query)) ||
      r.order_id.toLowerCase().includes(query)
    )
  }, [reviews, searchQuery])

  // Metric stats
  const totalReviews = reviews.length
  const avgRating = totalReviews > 0
    ? (reviews.reduce((acc, r) => acc + r.rating, 0) / totalReviews).toFixed(1)
    : "0.0"
  const verifiedCount = reviews.filter(r => r.is_verified_purchase).length
  const verifiedPercentage = totalReviews > 0 ? Math.round((verifiedCount / totalReviews) * 100) : 100

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-lg text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
            <Star size={20} className="text-amber-500" weight="fill" />
            Product Reviews & Ratings
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Monitor verified customer feedback, manage ratings, and moderate reviews across all products
          </p>
        </div>

        <button
          onClick={fetchReviews}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-xs font-semibold text-zinc-700 dark:text-zinc-300 transition-all cursor-pointer self-start sm:self-auto disabled:opacity-50"
        >
          <ArrowClockwise size={14} className={isLoading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-sm">
          <span className="text-xs text-zinc-400 dark:text-zinc-500 font-medium">Total Reviews</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">{totalReviews}</span>
            <span className="text-xs text-zinc-400">across catalog</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-sm">
          <span className="text-xs text-zinc-400 dark:text-zinc-500 font-medium">Average Store Rating</span>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">{avgRating}</span>
            <div className="flex items-center text-amber-400">
              {[1, 2, 3, 4, 5].map(s => (
                <Star
                  key={s}
                  size={14}
                  weight={Number(avgRating) >= s ? "fill" : "regular"}
                  className={Number(avgRating) >= s ? "text-amber-400" : "text-zinc-300 dark:text-zinc-700"}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-sm">
          <span className="text-xs text-zinc-400 dark:text-zinc-500 font-medium">Verified Buyers</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {verifiedPercentage}%
            </span>
            <span className="text-xs text-zinc-400">({verifiedCount} verified)</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          {/* Product Filter */}
          <div className="flex items-center gap-2">
            <Package size={16} className="text-zinc-400" />
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="text-xs font-semibold px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-900 cursor-pointer max-w-[200px]"
            >
              <option value="ALL">All Products</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Rating Filter Pills */}
          <div className="flex items-center gap-1 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl">
            {(["ALL", 5, 4, 3, 2, 1] as const).map(r => (
              <button
                key={r}
                onClick={() => setSelectedRating(r)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  selectedRating === r
                    ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm"
                    : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
                }`}
              >
                {r === "ALL" ? "All Stars" : `${r} ★`}
              </button>
            ))}
          </div>
        </div>

        {/* Search input */}
        <div className="relative max-w-xs w-full">
          <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Search reviews, user, SKU..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 transition-all"
          />
        </div>
      </div>

      {/* Reviews Table / List */}
      <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="flex items-center justify-between p-4 border border-zinc-100 dark:border-zinc-800 rounded-2xl">
                <Skeleton className="h-10 w-48 rounded-xl" />
                <Skeleton className="h-6 w-24 rounded-full" />
                <Skeleton className="h-8 w-20 rounded-xl" />
              </div>
            ))}
          </div>
        ) : filteredReviews.length === 0 ? (
          <div className="py-16 text-center">
            <ChatCircleText size={40} className="mx-auto text-zinc-300 dark:text-zinc-700 mb-3" />
            <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">No reviews found</p>
            <p className="text-xs text-zinc-400 mt-1">
              {reviews.length === 0
                ? "No customer reviews have been submitted yet."
                : "No reviews match your selected filters."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {filteredReviews.map((rev) => (
              <div
                key={rev.id}
                className="p-6 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors flex flex-col md:flex-row md:items-start justify-between gap-4"
              >
                {/* Product & User Details */}
                <div className="flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                      {rev.product_name || "Product"}
                    </span>
                    <span className="text-[11px] font-mono text-zinc-400 dark:text-zinc-500">
                      SKU: #{rev.product_id.substring(0, 8)}
                    </span>
                    {rev.is_verified_purchase && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                        <CheckCircle size={11} weight="fill" />
                        Verified Purchase
                      </span>
                    )}
                  </div>

                  {/* Stars & Author info */}
                  <div className="flex items-center gap-3 text-xs">
                    <div className="flex items-center text-amber-400">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          size={13}
                          weight={rev.rating >= s ? "fill" : "regular"}
                          className={rev.rating >= s ? "text-amber-400" : "text-zinc-300 dark:text-zinc-700"}
                        />
                      ))}
                      <span className="ml-1.5 font-bold text-zinc-800 dark:text-zinc-200">
                        {rev.rating}.0
                      </span>
                    </div>

                    <span className="text-zinc-300 dark:text-zinc-700">•</span>

                    <span className="text-zinc-600 dark:text-zinc-400 flex items-center gap-1">
                      <UserIcon size={12} />
                      {rev.username || "Customer"}
                      {rev.user_email && (
                        <span className="text-zinc-400">({rev.user_email})</span>
                      )}
                    </span>

                    <span className="text-zinc-300 dark:text-zinc-700">•</span>

                    <span className="text-zinc-400 text-[11px]">
                      {new Date(rev.created_at).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric"
                      })}
                    </span>
                  </div>

                  {/* Comment Text */}
                  {rev.comment ? (
                    <p className="text-xs text-zinc-700 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-800/60 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800 mt-2">
                      "{rev.comment}"
                    </p>
                  ) : (
                    <p className="text-xs italic text-zinc-400">No commentary provided (Rating only).</p>
                  )}

                  <div className="text-[10px] font-mono text-zinc-400">
                    Order Ref: #{rev.order_id.substring(0, 8)}
                  </div>
                </div>

                {/* Moderation Actions */}
                <div className="flex items-center gap-2 self-end md:self-start">
                  <button
                    onClick={() => setReviewToDelete(rev)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/50 border border-rose-200 dark:border-rose-900/50 text-xs font-semibold transition-colors cursor-pointer"
                    title="Remove or moderate this review"
                  >
                    <Trash size={14} />
                    Delete Review
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {reviewToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setReviewToDelete(null)}
              className="absolute inset-0 bg-zinc-900/40 dark:bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              className="relative bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 shadow-2xl max-w-md w-full p-6 sm:p-8 z-10"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
                  <Trash size={22} weight="bold" />
                  <h4 className="text-base font-bold text-zinc-900 dark:text-zinc-50">Delete Customer Review?</h4>
                </div>
                <button
                  onClick={() => setReviewToDelete(null)}
                  className="w-7 h-7 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-200 flex items-center justify-center transition-colors"
                >
                  <X size={15} />
                </button>
              </div>

              <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-6">
                Are you sure you want to delete this {reviewToDelete.rating}-star review for{" "}
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                  "{reviewToDelete.product_name}"
                </span>
                ? The product's overall rating will be automatically recalculated.
              </p>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setReviewToDelete(null)}
                  className="px-4 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-semibold hover:bg-zinc-200 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteReview(reviewToDelete.id)}
                  disabled={deletingId === reviewToDelete.id}
                  className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {deletingId === reviewToDelete.id ? "Deleting..." : "Confirm Delete"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
