"use client"

import { useEffect } from "react"
import { useThemeStore } from "@/store/useThemeStore"

export function ThemeInitializer() {
  const { initTheme } = useThemeStore()

  useEffect(() => {
    initTheme()
  }, [initTheme])

  return null
}