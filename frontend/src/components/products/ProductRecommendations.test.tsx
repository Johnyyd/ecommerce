import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { ProductRecommendations } from './ProductRecommendations'

describe('ProductRecommendations', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders loading state initially', () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise(() => {}))
    render(<ProductRecommendations productId="prod-123" />)
    expect(screen.getByText(/Curating recommendations/i)).toBeInTheDocument()
  })

  it('renders recommended products successfully', async () => {
    const mockProducts = [
      {
        id: 'rec-1',
        name: 'Ergonomic Desk Chair',
        description: 'Premium lumbar support chair',
        price: 199.99,
        stock_quantity: 10,
        image_url: 'https://example.com/chair.png'
      },
      {
        id: 'rec-2',
        name: 'Mechanical Keyboard',
        description: 'Tactile switch keyboard',
        price: 89.5,
        stock_quantity: 15
      }
    ]

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockProducts
    } as Response)

    render(<ProductRecommendations productId="prod-123" />)

    await waitFor(() => {
      expect(screen.getByText('Frequently Explored Together')).toBeInTheDocument()
      expect(screen.getByText('Ergonomic Desk Chair')).toBeInTheDocument()
      expect(screen.getByText('Mechanical Keyboard')).toBeInTheDocument()
      expect(screen.getByText('$199.99')).toBeInTheDocument()
      expect(screen.getByText('$89.50')).toBeInTheDocument()
    })
  })

  it('gracefully conceals section when empty', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => []
    } as Response)

    const { container } = render(<ProductRecommendations productId="prod-123" />)

    await waitFor(() => {
      expect(container.querySelector('section')).toBeNull()
    })
  })

  it('gracefully conceals section when fetch fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'))

    const { container } = render(<ProductRecommendations productId="prod-123" />)

    await waitFor(() => {
      expect(container.querySelector('section')).toBeNull()
    })
  })
})
