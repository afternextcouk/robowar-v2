import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthState {
  token: string | null
  user: any | null
  isAuthenticated: boolean
  setToken: (token: string | null) => void
  setUser: (user: any | null) => void
  clear: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      isAuthenticated: false,
      setToken: (token) => set({ token, isAuthenticated: !!token }),
      setUser: (user) => set({ user }),
      clear: () => set({ token: null, user: null, isAuthenticated: false }),
    }),
    { name: 'robowar-auth' }
  )
)
