import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useProductStore } from './useProductStore';

describe('useProductStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useProductStore.setState({
      products: [],
      total: 0,
      isLoading: false,
      error: null,
      page: 1,
      limit: 6,
    });
  });

  it('should initialize with correct default state', () => {
    const state = useProductStore.getState();
    expect(state.products).toEqual([]);
    expect(state.total).toBe(0);
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
    expect(state.page).toBe(1);
    expect(state.limit).toBe(6);
    expect(state.facets).toEqual({});
  });

  it('should update current page', () => {
    useProductStore.getState().setPage(2);
    expect(useProductStore.getState().page).toBe(2);
  });

  it('should route to search endpoint and store facets when query is provided', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        items: [{ id: 'p1', name: 'Leather Bag', price: 120, stock_quantity: 5 }],
        total: 1,
        facets: { category_id: { cat1: 1 } },
        source: 'meilisearch'
      })
    } as Response);

    useProductStore.getState().setFilters({ q: 'Leather' });
    await useProductStore.getState().fetchProducts();

    expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining('/api/v1/products/search'));
    expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining('q=Leather'));
    expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining('facets=category_id%2Cbrand'));

    const state = useProductStore.getState();
    expect(state.products.length).toBe(1);
    expect(state.products[0].name).toBe('Leather Bag');
    expect(state.facets).toEqual({ category_id: { cat1: 1 } });
  });

  it('should clear filters and facets on clearFilters', () => {
    useProductStore.setState({
      filters: { q: 'Bag', min_price: 50 },
      facets: { brand: { Apple: 2 } },
      page: 3
    });

    useProductStore.getState().clearFilters();

    const state = useProductStore.getState();
    expect(state.filters).toEqual({});
    expect(state.facets).toEqual({});
    expect(state.page).toBe(1);
  });
});
