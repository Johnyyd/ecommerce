/**
 * Centralized Authentication & Token Management
 * 
 * Provides per-tab session isolation using sessionStorage so that multiple tabs
 * (e.g., Customer in Tab 1 and Admin in Tab 2) do not overwrite each other's sessions.
 */

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null
  return (
    sessionStorage.getItem("access_token") ||
    localStorage.getItem("access_token") ||
    null
  )
}

export function setAuthToken(token: string): void {
  if (typeof window === "undefined") return
  // Isolate session to this browser tab
  sessionStorage.setItem("access_token", token)

  // Clear any stale cross-tab admin override keys from previous implementations
  try {
    localStorage.removeItem("admin_access_token")
    localStorage.removeItem("admin_user")
  } catch {
    // Ignore storage errors in restricted contexts
  }
}

export function clearAuthToken(): void {
  if (typeof window === "undefined") return
  try {
    sessionStorage.removeItem("access_token")
    localStorage.removeItem("access_token")
    localStorage.removeItem("admin_access_token")
    localStorage.removeItem("admin_user")
  } catch {
    // Ignore storage errors in restricted contexts
  }
}

export function getAdminToken(): string | null {
  if (typeof window === "undefined") return null
  return (
    sessionStorage.getItem("access_token") ||
    localStorage.getItem("admin_access_token") ||
    localStorage.getItem("access_token") ||
    null
  )
}
