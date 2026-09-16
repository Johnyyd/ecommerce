import { describe, it, expect, beforeEach } from "vitest"
import { getAuthToken, setAuthToken, clearAuthToken, getAdminToken } from "./auth"

describe("Auth Token Management & Tab Isolation", () => {
  beforeEach(() => {
    sessionStorage.clear()
    localStorage.clear()
  })

  it("should store token in sessionStorage and clean legacy admin keys", () => {
    localStorage.setItem("admin_access_token", "stale-admin")
    localStorage.setItem("admin_user", JSON.stringify({ role: "admin" }))

    setAuthToken("customer-tab-token")

    expect(sessionStorage.getItem("access_token")).toBe("customer-tab-token")
    expect(localStorage.getItem("admin_access_token")).toBeNull()
    expect(localStorage.getItem("admin_user")).toBeNull()
  })

  it("should prioritize sessionStorage token over localStorage token for per-tab isolation", () => {
    localStorage.setItem("access_token", "admin-token-in-local-storage")
    sessionStorage.setItem("access_token", "customer-token-in-session-storage")

    expect(getAuthToken()).toBe("customer-token-in-session-storage")
  })

  it("should fallback to localStorage if sessionStorage is empty", () => {
    localStorage.setItem("access_token", "persisted-token")
    expect(getAuthToken()).toBe("persisted-token")
  })

  it("should clear both sessionStorage and localStorage on clearAuthToken", () => {
    sessionStorage.setItem("access_token", "tab-token")
    localStorage.setItem("access_token", "fallback-token")
    localStorage.setItem("admin_access_token", "admin-token")
    localStorage.setItem("admin_user", "admin-user")

    clearAuthToken()

    expect(sessionStorage.getItem("access_token")).toBeNull()
    expect(localStorage.getItem("access_token")).toBeNull()
    expect(localStorage.getItem("admin_access_token")).toBeNull()
    expect(localStorage.getItem("admin_user")).toBeNull()
  })

  it("getAdminToken should prioritize sessionStorage token", () => {
    sessionStorage.setItem("access_token", "admin-tab-token")
    localStorage.setItem("admin_access_token", "legacy-admin-token")
    localStorage.setItem("access_token", "customer-token")

    expect(getAdminToken()).toBe("admin-tab-token")
  })
})
