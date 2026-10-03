import { create } from "zustand"

export type Theme = "light" | "dark" | "system"

interface ThemeState {
  theme: Theme
  isDark: boolean
  isTransitioning: boolean
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
  initTheme: () => void
  startTransition: () => void
  endTransition: () => void
}

function resolveIsDark(theme: Theme): boolean {
  if (theme === "dark") return true
  if (theme === "light") return false
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
  }
  return false
}

function applyThemeClass(isDark: boolean, isTransitioning: boolean = false) {
  if (typeof document !== "undefined") {
    if (isTransitioning) {
      document.documentElement.classList.add("theme-transitioning")
    }
    if (isDark) {
      document.documentElement.classList.add("dark")
    } else {
      document.documentElement.classList.remove("dark")
    }
    if (isTransitioning) {
      // Remove transitioning class after a short delay
      setTimeout(() => {
        document.documentElement.classList.remove("theme-transitioning")
      }, 200)
    }
  }
}

let mediaQueryListener: ((e: MediaQueryListEvent) => void) | null = null

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: "system",
  isDark: false,
  isTransitioning: false,

  initTheme: () => {
    let savedTheme = "system" as Theme
    if (typeof localStorage !== "undefined") {
      const stored = localStorage.getItem("app-theme") as Theme | null
      if (stored && ["light", "dark", "system"].includes(stored)) {
        savedTheme = stored
      }
    }
    const isDark = resolveIsDark(savedTheme)
    applyThemeClass(isDark)
    set({ theme: savedTheme, isDark })

    // Set up system preference change listener
    if (typeof window !== "undefined" && window.matchMedia) {
      if (mediaQueryListener) {
        window.matchMedia("(prefers-color-scheme: dark)").removeEventListener("change", mediaQueryListener)
      }
      mediaQueryListener = (e: MediaQueryListEvent) => {
        const currentTheme = get().theme
        if (currentTheme === "system") {
          const isDark = e.matches
          applyThemeClass(isDark)
          set({ isDark })
        }
      }
      window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", mediaQueryListener)
    }
  },

  setTheme: (theme: Theme) => {
    get().startTransition()
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("app-theme", theme)
    }
    const isDark = resolveIsDark(theme)
    applyThemeClass(isDark, true)
    set({ theme, isDark })
    // End transition after a short delay
    setTimeout(() => {
      get().endTransition()
    }, 200)
  },

  toggleTheme: () => {
    const currentIsDark = get().isDark
    const nextTheme: Theme = currentIsDark ? "light" : "dark"
    get().setTheme(nextTheme)
  },

  startTransition: () => {
    set({ isTransitioning: true })
  },

  endTransition: () => {
    set({ isTransitioning: false })
  }
}))
