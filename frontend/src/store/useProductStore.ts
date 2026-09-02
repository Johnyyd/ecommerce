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
  fetchProducts: () => Promise<void>
}

export const useProductStore = create<ProductState>((set) => ({
  products: [],
  isLoading: false,
  error: null,
  fetchProducts: async () => {
    set({ isLoading: true, error: null })
    try {
      const response = await fetch('/api/v1/products')
      if (!response.ok) {
        throw new Error('Failed to fetch products')
      }
      const data = await response.json()
      set({ products: data, isLoading: false })
    } catch (error: any) {
      set({ error: error.message || 'An error occurred', isLoading: false })
    }
  },
}))
