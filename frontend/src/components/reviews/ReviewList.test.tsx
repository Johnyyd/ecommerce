import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReviewList } from './ReviewList';
import { useAuthStore } from '@/store/useAuthStore';

const mockReviewsData = {
  average_rating: 4.5,
  total_reviews: 3,
  rating_distribution: { 5: 2, 4: 1, 3: 0, 2: 0, 1: 0 },
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
    {
      id: 'rev-3',
      product_id: 'prod-123',
      user_id: 'user-3',
      username: 'charlie',
      order_id: 'ord-3',
      rating: 4,
      comment: 'Good quality but shipping was slow.',
      is_verified_purchase: true,
      created_at: '2026-09-10T08:00:00Z',
    },
  ],
};

describe('ReviewList Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
    });
  });

  it('renders rating summary, star breakdown, and review comments', async () => {
    render(
      <ReviewList
        productId="prod-123"
        summary={mockReviewsData}
        onDeleteReview={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('4.5')).toBeInTheDocument();
      expect(screen.getByText(/Based on 3 verified purchases/i)).toBeInTheDocument();
      expect(screen.getByText('Superb quality and fit!')).toBeInTheDocument();
      expect(screen.getByText('Very pleased with this purchase.')).toBeInTheDocument();
      expect(screen.getByText('Good quality but shipping was slow.')).toBeInTheDocument();
      expect(screen.getAllByText('Verified Buyer').length).toBe(3);
    });
  });

  it('renders star distribution progress bars', async () => {
    render(
      <ReviewList
        productId="prod-123"
        summary={mockReviewsData}
        onDeleteReview={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.getByText('4')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('1')).toBeInTheDocument();
    });
  });

  it('renders empty state when no reviews', async () => {
    const emptyData = {
      average_rating: 0,
      total_reviews: 0,
      rating_distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
      reviews: [],
    };

    render(
      <ReviewList
        productId="prod-empty"
        summary={emptyData}
        onDeleteReview={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/No reviews yet for this product/i)).toBeInTheDocument();
    });
  });

  it('shows delete button for review author', async () => {
    useAuthStore.setState({
      user: {
        id: 'user-1',
        username: 'alice',
        email: 'alice@test.com',
        role: 'customer',
        is_active: true,
        created_at: '',
        updated_at: '',
      },
      isAuthenticated: true,
      isLoading: false,
    });

    const onDeleteReview = vi.fn();
    render(
      <ReviewList
        productId="prod-123"
        summary={mockReviewsData}
        onDeleteReview={onDeleteReview}
      />
    );

    await waitFor(() => {
      const deleteButtons = screen.getAllByRole('button', { name: /delete review/i });
      expect(deleteButtons.length).toBeGreaterThan(0);
    });
  });

  it('shows sort dropdown with options', async () => {
    render(
      <ReviewList
        productId="prod-123"
        summary={mockReviewsData}
        onDeleteReview={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Sort by:/i)).toBeInTheDocument();
      expect(screen.getByDisplayValue('Most Recent')).toBeInTheDocument();
    });
  });

  it('expands long comments when read more clicked', async () => {
    const longCommentData = {
      ...mockReviewsData,
      reviews: [
        {
          ...mockReviewsData.reviews[0],
          comment: 'A'.repeat(300), // Long comment
        },
      ],
    };

    render(
      <ReviewList
        productId="prod-123"
        summary={longCommentData}
        onDeleteReview={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Read more/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Read more/i));

    await waitFor(() => {
      expect(screen.getByText(/Show less/i)).toBeInTheDocument();
    });
  });
});