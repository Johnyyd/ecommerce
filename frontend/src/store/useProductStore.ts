import { create } from 'zustand'

export interface Product {
  id: string
  name: string
  description: string
  price: number
  stock_quantity: number
  category_id?: string
  brand?: string
  rating?: number
  image_url?: string
}

export interface FilterOptions {
  q?: string
  category_id?: string
  brand?: string
  min_price?: number
  max_price?: number
}

interface ProductState {
  products: Product[]
  isLoading: boolean
  error: string | null
  page: number
  total: number
  limit: number
  filters: FilterOptions
  fetchProducts: (page?: number) => Promise<void>
  setPage: (page: number) => void
  setFilters: (filters: Partial<FilterOptions>) => void
  clearFilters: () => void
}

export const useProductStore = create<ProductState>((set, get) => ({
  products: [],
  isLoading: false,
  error: null,
  page: 1,
  total: 0,
  limit: 12,
  filters: {},
  setPage: (page: number) => set({ page }),
  setFilters: (newFilters) => set((state) => ({ 
    filters: { ...state.filters, ...newFilters }, 
    page: 1 
  })),
  clearFilters: () => set({ filters: {}, page: 1 }),
  fetchProducts: async (pageArg?: number) => {
    set({ isLoading: true, error: null })
    try {
      const page = pageArg ?? get().page;
      const limit = get().limit;
      const skip = (page - 1) * limit;
      const filters = get().filters;
      
      const queryParams = new URLSearchParams({
        skip: skip.toString(),
        limit: limit.toString(),
      });
      
      if (filters.q) queryParams.append('q', filters.q);
      if (filters.category_id) queryParams.append('category_id', filters.category_id);
      if (filters.brand) queryParams.append('brand', filters.brand);
      if (filters.min_price !== undefined) queryParams.append('min_price', filters.min_price.toString());
      if (filters.max_price !== undefined) queryParams.append('max_price', filters.max_price.toString());

      const response = await fetch(`/api/v1/products?${queryParams.toString()}`)
      if (!response.ok) {
        throw new Error('Failed to fetch products')
      }
      const data = await response.json()
      set({ products: data.items, total: data.total, isLoading: false, page })
    } catch (error: any) {
      set({ error: error.message || 'An error occurred', isLoading: false })
    }
  },
}))
