export interface ReviewCreate {
  product_id: string;
  order_id: string;
  rating: number;
  comment?: string;
}

export interface ReviewResponse {
  id: string;
  product_id: string;
  user_id: string;
  username: string;
  order_id: string;
  rating: number;
  comment?: string | null;
  is_verified_purchase: boolean;
  created_at: string;
}

export interface ProductReviewSummary {
  average_rating: number;
  total_reviews: number;
  rating_distribution: Record<string, number>;
  reviews: ReviewResponse[];
}
