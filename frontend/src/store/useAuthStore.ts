import { create } from 'zustand'
import { useCartStore } from './useCartStore'
export interface User {
  id: string
  username: string
  email: string
  is_active: boolean
  role: string
  created_at: string
  updated_at: string
}

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  setUser: (user: User | null) => void
  setIsLoading: (loading: boolean) => void
  logout: (clearAdmin?: boolean) => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  setUser: (user) => set({ user, isAuthenticated: !!user, isLoading: false }),
  setIsLoading: (loading) => set({ isLoading: loading }),
  logout: (clearAdmin = false) => {
    const currentUser = get().user
    const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'manager'
    set({ user: null, isAuthenticated: false, isLoading: false })
    useCartStore.getState().clearCart()
    if (typeof window !== 'undefined') {
      localStorage.removeItem("access_token")
      if (clearAdmin || isAdmin) {
        localStorage.removeItem("admin_access_token")
        localStorage.removeItem("admin_user")
      }
    }
  }
}))

export const clearAdminSession = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem("admin_access_token")
    localStorage.removeItem("admin_user")
  }
}
