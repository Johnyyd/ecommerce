import { create } from 'zustand'

export interface Product {
  id: string
  name: string
  description: string
  price: number
  stock_quantity: number
}

interface ProductState {
  products: Product[]
  isLoading: boolean
  error: string | null
  page: number
  total: number
  limit: number
  fetchProducts: (page?: number) => Promise<void>
  setPage: (page: number) => void
}

export const useProductStore = create<ProductState>((set, get) => ({
  products: [],
  isLoading: false,
  error: null,
  page: 1,
  total: 0,
  limit: 6,
  setPage: (page: number) => set({ page }),
  fetchProducts: async (pageArg?: number) => {
    set({ isLoading: true, error: null })
    try {
      const page = pageArg ?? get().page;
      const limit = get().limit;
      const skip = (page - 1) * limit;
      
      const response = await fetch(`/api/v1/products?skip=${skip}&limit=${limit}`)
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
