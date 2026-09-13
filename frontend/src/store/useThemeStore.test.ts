import { describe, it, expect, beforeEach } from "vitest"
import { useThemeStore } from "./useThemeStore"

describe("useThemeStore", () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove("dark")
  })

  it("should set light theme and remove dark class from document", () => {
    useThemeStore.getState().setTheme("light")
    expect(useThemeStore.getState().theme).toBe("light")
    expect(useThemeStore.getState().isDark).toBe(false)
    expect(document.documentElement.classList.contains("dark")).toBe(false)
    expect(localStorage.getItem("app-theme")).toBe("light")
  })

  it("should set dark theme and add dark class to document", () => {
    useThemeStore.getState().setTheme("dark")
    expect(useThemeStore.getState().theme).toBe("dark")
    expect(useThemeStore.getState().isDark).toBe(true)
    expect(document.documentElement.classList.contains("dark")).toBe(true)
    expect(localStorage.getItem("app-theme")).toBe("dark")
  })

  it("toggleTheme should switch between dark and light", () => {
    useThemeStore.getState().setTheme("light")
    useThemeStore.getState().toggleTheme()
    expect(useThemeStore.getState().isDark).toBe(true)
    expect(useThemeStore.getState().theme).toBe("dark")
    expect(document.documentElement.classList.contains("dark")).toBe(true)

    useThemeStore.getState().toggleTheme()
    expect(useThemeStore.getState().isDark).toBe(false)
    expect(useThemeStore.getState().theme).toBe("light")
    expect(document.documentElement.classList.contains("dark")).toBe(false)
  })
})
