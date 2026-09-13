import { create } from "zustand"

export type Theme = "light" | "dark" | "system"

interface ThemeState {
  theme: Theme
  isDark: boolean
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
  initTheme: () => void
}

function resolveIsDark(theme: Theme): boolean {
  if (theme === "dark") return true
  if (theme === "light") return false
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
  }
  return false
}

function applyThemeClass(isDark: boolean) {
  if (typeof document !== "undefined") {
    if (isDark) {
      document.documentElement.classList.add("dark")
    } else {
      document.documentElement.classList.remove("dark")
    }
  }
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: "system",
  isDark: false,

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
  },

  setTheme: (theme: Theme) => {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("app-theme", theme)
    }
    const isDark = resolveIsDark(theme)
    applyThemeClass(isDark)
    set({ theme, isDark })
  },

  toggleTheme: () => {
    const currentIsDark = get().isDark
    const nextTheme: Theme = currentIsDark ? "light" : "dark"
    get().setTheme(nextTheme)
  }
}))
