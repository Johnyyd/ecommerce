import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProductReviews } from './ProductReviews';
import { reviewApi } from '@/services/reviewApi';
import * as ordersApi from '@/lib/api/orders';
import { useAuthStore } from '@/store/useAuthStore';

const mockReviewsData = {
  average_rating: 4.8,
  total_reviews: 2,
  rating_distribution: { '5': 2, '4': 0, '3': 0, '2': 0, '1': 0 },
  reviews: [
    {
      id: 'rev-1',
      product_id: 'prod-123',
      user_id: 'user-1',
      username: 'alice',
      order_id: 'ord-1',
      rating: 5,
      comment: 'Superb quality and fit!',
      is_verified_purchase: true,
      created_at: '2026-09-12T10:00:00Z',
    },
    {
      id: 'rev-2',
      product_id: 'prod-123',
      user_id: 'user-2',
      username: 'bob',
      order_id: 'ord-2',
      rating: 5,
      comment: 'Very pleased with this purchase.',
      is_verified_purchase: true,
      created_at: '2026-09-11T12:00:00Z',
    },
  ],
};

describe('ProductReviews Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
    });
  });

  it('renders rating summary, star breakdown, and review comments', async () => {
    vi.spyOn(reviewApi, 'getProductReviews').mockResolvedValueOnce(mockReviewsData);

    render(<ProductReviews productId="prod-123" />);

    await waitFor(() => {
      expect(screen.getByText('4.8')).toBeInTheDocument();
      expect(screen.getByText(/Verified Reviews \(2\)/i)).toBeInTheDocument();
      expect(screen.getByText('Superb quality and fit!')).toBeInTheDocument();
      expect(screen.getByText('Very pleased with this purchase.')).toBeInTheDocument();
      expect(screen.getAllByText('Verified Buyer').length).toBe(2);
    });
  });

  it('renders empty state when there are no reviews', async () => {
    vi.spyOn(reviewApi, 'getProductReviews').mockResolvedValueOnce({
      average_rating: 0,
      total_reviews: 0,
      rating_distribution: { '5': 0, '4': 0, '3': 0, '2': 0, '1': 0 },
      reviews: [],
    });

    render(<ProductReviews productId="prod-empty" />);

    await waitFor(() => {
      expect(screen.getByText(/No reviews yet for this product/i)).toBeInTheDocument();
    });
  });

  it('prompts user to login when unauthenticated', async () => {
    vi.spyOn(reviewApi, 'getProductReviews').mockResolvedValueOnce(mockReviewsData);

    render(<ProductReviews productId="prod-123" />);

    await waitFor(() => {
      expect(screen.getByText(/Log in/i)).toBeInTheDocument();
    });
  });

  it('shows verified purchase policy banner when authenticated without purchase', async () => {
    useAuthStore.setState({
      user: {
        id: 'user-guest',
        username: 'guest',
        email: 'g@test.com',
        role: 'customer',
        is_active: true,
        created_at: '',
        updated_at: '',
      },
      isAuthenticated: true,
      isLoading: false,
    });

    vi.spyOn(reviewApi, 'getProductReviews').mockResolvedValueOnce(mockReviewsData);
    vi.spyOn(ordersApi, 'getUserOrders').mockResolvedValueOnce([]);

    render(<ProductReviews productId="prod-123" />);

    await waitFor(() => {
      expect(
        screen.getByText(/Only customers with a completed or delivered order for this product can submit a verified review/i)
      ).toBeInTheDocument();
    });
  });

  it('shows write review button when user has completed order containing the product', async () => {
    useAuthStore.setState({
      user: {
        id: 'user-buyer',
        username: 'buyer',
        email: 'buyer@test.com',
        role: 'customer',
        is_active: true,
        created_at: '',
        updated_at: '',
      },
      isAuthenticated: true,
      isLoading: false,
    });

    vi.spyOn(reviewApi, 'getProductReviews').mockResolvedValueOnce(mockReviewsData);
    vi.spyOn(ordersApi, 'getUserOrders').mockResolvedValueOnce([
      {
        id: 'ord-verified',
        user_id: 'user-buyer',
        address_id: 'addr-1',
        total_amount: 150,
        status: 'DELIVERED',
        payment_method: 'VIETQR',
        items: [{ id: 'item-1', product_id: 'prod-123', quantity: 1, unit_price: 150 }],
      },
    ]);

    render(<ProductReviews productId="prod-123" />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Write a Verified Review/i })).toBeInTheDocument();
    });
  });
});
