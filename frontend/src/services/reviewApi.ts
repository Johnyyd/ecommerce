import { ReviewCreate, ReviewResponse, ProductReviewSummary } from '@/types/review';

const API_BASE_URL = '/api/v1';

async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const token = localStorage.getItem('access_token') || localStorage.getItem('token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, { ...options, headers });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'API request failed');
  }
  return response.json();
}

export const reviewApi = {
  async getProductReviews(productId: string, skip = 0, limit = 50): Promise<ProductReviewSummary> {
    const res = await fetch(`${API_BASE_URL}/reviews/product/${productId}?skip=${skip}&limit=${limit}`);
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Failed to fetch reviews');
    }
    return res.json();
  },

  async createReview(data: ReviewCreate): Promise<ReviewResponse> {
    return fetchWithAuth(`${API_BASE_URL}/reviews/`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async deleteReview(reviewId: string): Promise<boolean> {
    await fetchWithAuth(`${API_BASE_URL}/reviews/${reviewId}`, {
      method: 'DELETE',
    });
    return true;
  }
};
