import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

const memoryStorage = {
  getItem: (name: string) => {
    if (typeof globalThis === 'undefined') return null
    return (globalThis as typeof globalThis & { __ecommerceCartStorage?: Record<string, string> }).__ecommerceCartStorage?.[name] ?? null
  },
  setItem: (name: string, value: string) => {
    if (typeof globalThis === 'undefined') return
    ;(globalThis as typeof globalThis & { __ecommerceCartStorage?: Record<string, string> }).__ecommerceCartStorage ??= {}
    ;(globalThis as typeof globalThis & { __ecommerceCartStorage?: Record<string, string> }).__ecommerceCartStorage![name] = value
  },
  removeItem: (name: string) => {
    if (typeof globalThis === 'undefined') return
    delete (globalThis as typeof globalThis & { __ecommerceCartStorage?: Record<string, string> }).__ecommerceCartStorage?.[name]
  },
}

const cartStorage = () => {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage
  }
  return memoryStorage
}

export interface CartItem {
  id: string
  name: string
  price: number
  quantity: number
  image?: string
}

interface CartState {
  items: CartItem[]
  isOpen: boolean
  addItem: (item: CartItem) => void
  removeItem: (id: string) => void
  updateQuantity: (id: string, quantity: number) => void
  clearCart: () => void
  toggleCart: () => void
  setCartOpen: (isOpen: boolean) => void
  getTotal: () => number
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,
      addItem: (item) =>
        set((state) => {
          const existingItem = state.items.find((i) => i.id === item.id)
          if (existingItem) {
            return {
              items: state.items.map((i) =>
                i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
              ),
              isOpen: true,
            }
          }
          return { items: [...state.items, { ...item, quantity: 1 }], isOpen: true }
        }),
      removeItem: (id) =>
        set((state) => ({
          items: state.items.filter((i) => i.id !== id),
        })),
      updateQuantity: (id, quantity) =>
        set((state) => ({
          items:
            quantity <= 0
              ? state.items.filter((i) => i.id !== id)
              : state.items.map((i) =>
                  i.id === id ? { ...i, quantity } : i
                ),
        })),
      clearCart: () => set({ items: [] }),
      toggleCart: () => set((state) => ({ isOpen: !state.isOpen })),
      setCartOpen: (isOpen) => set({ isOpen }),
      getTotal: () => {
        return get().items.reduce((sum, item) => sum + item.price * item.quantity, 0)
      },
    }),
    {
      name: 'ecommerce-cart',
      storage: createJSONStorage(cartStorage),
      partialize: (state) => ({ items: state.items }), // Only persist items, not UI state like isOpen
    }
  )
)
