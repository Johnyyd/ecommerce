import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Star,
  ShieldCheck,
  ChatCircleText
} from '@phosphor-icons/react';
import { reviewApi } from '@/services/reviewApi';
import { getUserOrders, OrderResponse } from '@/lib/api/orders';
import { useAuthStore } from '@/store/useAuthStore';
import { toast } from 'sonner';

interface ReviewFormProps {
  productId: string;
  onSubmitSuccess: () => void;
  onClose: () => void;
  initialRating?: number;
}

export const ReviewForm: React.FC<ReviewFormProps> = ({
  productId,
  onSubmitSuccess,
  onClose,
  initialRating = 5
}) => {
  const { isAuthenticated } = useAuthStore();
  const [eligibleOrders, setEligibleOrders] = useState<OrderResponse[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');

  // Form states
  const [rating, setRating] = useState<number>(initialRating);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [comment, setComment] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);

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
    checkEligibility();
  }, [checkEligibility]);

  // Handle image selection
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const remainingSlots = 5 - images.length;
    const newFiles = files.slice(0, remainingSlots);

    if (newFiles.length > 0) {
      const updatedImages = [...images, ...newFiles];
      setImages(updatedImages);

      // Create previews
      newFiles.forEach(file => {
        const reader = new FileReader();
        reader.onload = (event) => {
          setImagePreviews(prev => [...prev, event.target?.result as string]);
        };
        reader.readAsDataURL(file);
      });
    }
  };

  // Remove image
  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

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
    if (images.length > 5) {
      toast.error('Maximum 5 images allowed');
      return;
    }

    try {
      setIsSubmitting(true);

      // TODO: Upload images first if backend supports it
      // For now, we'll submit without images
      await reviewApi.createReview({
        product_id: productId,
        order_id: selectedOrderId,
        rating,
        comment: comment.trim() || undefined,
      });

      toast.success('Verified review submitted successfully!');
      setComment('');
      setImages([]);
      setImagePreviews([]);
      onClose();
      onSubmitSuccess();
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit review');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
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
              onClick={onClose}
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
                    data-testid="star-button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="p-1 text-zinc-300 hover:text-amber-400 focus:outline-none transition-colors"
                    aria-label={`Star ${star}`}
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

            {/* Image Upload Section */}
            <ReviewImageUpload
              images={images}
              imagePreviews={imagePreviews}
              onAddImages={handleImageSelect}
              onRemoveImage={removeImage}
              maxImages={5}
            />

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
                onClick={onClose}
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
    </AnimatePresence>
  );
};

// ReviewImageUpload Component
interface ReviewImageUploadProps {
  images: File[];
  imagePreviews: string[];
  onAddImages: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveImage: (index: number) => void;
  maxImages: number;
}

const ReviewImageUpload: React.FC<ReviewImageUploadProps & { isSubmitting?: boolean }> = ({
  images,
  imagePreviews,
  onAddImages,
  onRemoveImage,
  maxImages,
  isSubmitting = false
}) => {
  const inputRef = React.useRef<HTMLInputElement>(null);

  const triggerFileSelect = () => {
    if (images.length < maxImages && !isSubmitting) {
      inputRef.current?.click();
    } else if (images.length >= maxImages) {
      toast.error(`Maximum ${maxImages} images allowed`);
    }
  };

  return (
    <div>
      <label className="block text-xs font-medium text-zinc-600 mb-2 flex items-center gap-2">
        Product Photos (Optional):
        <span className="text-xs text-zinc-400">({images.length}/{maxImages})</span>
      </label>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={onAddImages}
        className="hidden"
        id="review-image-upload"
      />

      <button
        type="button"
        onClick={triggerFileSelect}
        disabled={images.length >= maxImages || isSubmitting}
        className="w-full md:w-1/2 px-4 py-3 border-2 border-dashed border-zinc-200 rounded-2xl text-center text-sm text-zinc-500 hover:border-zinc-300 hover:bg-zinc-50/50 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <ChatCircleText size={20} className="mx-auto mb-1 opacity-50" />
        <div className="text-xs">
          {images.length >= maxImages
            ? 'Maximum images reached'
            : 'Click or drag to add up to 5 product photos'}
        </div>
      </button>

      {/* Image Previews */}
      {imagePreviews.length > 0 && (
        <div className="flex flex-wrap gap-3 mt-4" role="list" aria-label="Review image previews">
          {imagePreviews.map((preview, index) => (
            <div
              key={index}
              className="relative w-20 h-20 rounded-xl overflow-hidden bg-zinc-100 border border-zinc-200"
              role="listitem"
            >
              <img
                src={preview}
                alt={`Review photo ${index + 1}`}
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => onRemoveImage(index)}
                className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-500 text-white text-xs flex items-center justify-center hover:bg-red-600 transition-colors shadow-sm"
                aria-label={`Remove image ${index + 1}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export { ReviewImageUpload };