import { describe, it, expect, beforeEach } from 'vitest';
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
  });

  it('should update current page', () => {
    useProductStore.getState().setPage(2);
    expect(useProductStore.getState().page).toBe(2);
  });
});
