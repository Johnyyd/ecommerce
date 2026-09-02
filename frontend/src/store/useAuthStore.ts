import { create } from 'zustand'

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
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  setUser: (user) => set({ user, isAuthenticated: !!user, isLoading: false }),
  setIsLoading: (loading) => set({ isLoading: loading }),
  logout: () => set({ user: null, isAuthenticated: false, isLoading: false })
}))
