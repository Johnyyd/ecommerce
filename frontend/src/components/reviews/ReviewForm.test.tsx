import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReviewForm } from './ReviewForm';
import { reviewApi } from '@/services/reviewApi';
import * as ordersApi from '@/lib/api/orders';
import { useAuthStore } from '@/store/useAuthStore';

const mockEligibleOrders = [
  {
    id: 'ord-verified',
    user_id: 'user-buyer',
    address_id: 'addr-1',
    total_amount: 150,
    status: 'DELIVERED',
    payment_method: 'VIETQR',
    items: [{ id: 'item-1', product_id: 'prod-123', quantity: 1, unit_price: 150 }],
  },
];

describe('ReviewForm Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
  });

  it('renders review form with star rating picker', async () => {
    vi.spyOn(ordersApi, 'getUserOrders').mockResolvedValueOnce(mockEligibleOrders);

    render(
      <ReviewForm
        productId="prod-123"
        onSubmitSuccess={vi.fn()}
        onClose={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Review authenticated from your delivered order/i)).toBeInTheDocument();
      expect(screen.getByText(/Product Rating:/i)).toBeInTheDocument();
      expect(screen.getByText(/Detailed Experience \(Optional\):/i)).toBeInTheDocument();
      expect(screen.getByText(/Product Photos \(Optional\)/i)).toBeInTheDocument();
    });
  });

  it('shows order selector when multiple eligible orders exist', async () => {
    const multipleOrders = [
      ...mockEligibleOrders,
      {
        id: 'ord-verified-2',
        user_id: 'user-buyer',
        address_id: 'addr-2',
        total_amount: 200,
        status: 'COMPLETED',
        payment_method: 'STRIPE',
        items: [{ id: 'item-2', product_id: 'prod-123', quantity: 1, unit_price: 200 }],
      },
    ];

    vi.spyOn(ordersApi, 'getUserOrders').mockResolvedValueOnce(multipleOrders);

    render(
      <ReviewForm
        productId="prod-123"
        onSubmitSuccess={vi.fn()}
        onClose={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Select Order:/i)).toBeInTheDocument();
      // Component uses id.slice(0, 8) so "ord-verified" -> "ord-veri"
      expect(screen.getByDisplayValue(/Order #ord-veri/)).toBeInTheDocument();
    });
  });

  it('allows selecting star rating', async () => {
    vi.spyOn(ordersApi, 'getUserOrders').mockResolvedValueOnce(mockEligibleOrders);

    render(
      <ReviewForm
        productId="prod-123"
        onSubmitSuccess={vi.fn()}
        onClose={vi.fn()}
      />
    );

    await waitFor(() => {
      const stars = screen.getAllByTestId('star-button');
      expect(stars.length).toBe(5);

      // Click on 4th star
      fireEvent.click(stars[3]);

      expect(screen.getByText('Very Good')).toBeInTheDocument();
    });
  });

  it('submits review successfully with valid data', async () => {
    vi.spyOn(ordersApi, 'getUserOrders').mockResolvedValueOnce(mockEligibleOrders);
    vi.spyOn(reviewApi, 'createReview').mockResolvedValueOnce({
      id: 'rev-new',
      product_id: 'prod-123',
      user_id: 'user-buyer',
      username: 'buyer',
      order_id: 'ord-verified',
      rating: 5,
      comment: 'Great product!',
      is_verified_purchase: true,
      created_at: new Date().toISOString(),
    });

    const onSubmitSuccess = vi.fn();
    const onClose = vi.fn();

    render(
      <ReviewForm
        productId="prod-123"
        onSubmitSuccess={onSubmitSuccess}
        onClose={onClose}
      />
    );

    await waitFor(() => {
      const stars = screen.getAllByTestId('star-button');
      fireEvent.click(stars[4]); // 5 stars
    });

    fireEvent.change(screen.getByPlaceholderText(/Share your thoughts/), {
      target: { value: 'Great product!' }
    });

    fireEvent.click(screen.getByRole('button', { name: /Submit Review/i }));

    await waitFor(() => {
      expect(reviewApi.createReview).toHaveBeenCalledWith(
        expect.objectContaining({
          product_id: 'prod-123',
          order_id: 'ord-verified',
          rating: 5,
          comment: 'Great product!',
        })
      );
      expect(onSubmitSuccess).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('shows form without order selector when no eligible orders exist', async () => {
    vi.spyOn(ordersApi, 'getUserOrders').mockResolvedValueOnce([]);

    render(
      <ReviewForm
        productId="prod-123"
        onSubmitSuccess={vi.fn()}
        onClose={vi.fn()}
      />
    );

    await waitFor(() => {
      // Form renders with star rating but no order selector
      expect(screen.getByText(/Product Rating:/i)).toBeInTheDocument();
      expect(screen.getByText(/Detailed Experience \(Optional\):/i)).toBeInTheDocument();
      expect(screen.queryByText(/Select Order:/i)).toBeNull();
    });
  });
});