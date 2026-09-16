import { describe, it, expect, vi, beforeEach } from "vitest"
import { adminApi } from "./adminApi"

describe("adminApi Service Layer", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it("getProducts should fetch and return array of products", async () => {
    const mockProducts = [{ id: "1", name: "Product 1", price: 100, stock_quantity: 10 }]
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockProducts
    })

    const result = await adminApi.getProducts()
    expect(global.fetch).toHaveBeenCalledWith("/api/v1/products/?limit=100")
    expect(result).toEqual(mockProducts)
  })

  it("createProduct should pass token in Authorization header and payload in body", async () => {
    localStorage.setItem("access_token", "fake-token-123")
    const payload = { name: "New Prod", price: 200 }
    const mockCreated = { id: "p2", ...payload }

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockCreated
    })

    const result = await adminApi.createProduct(payload)
    expect(global.fetch).toHaveBeenCalledWith("/api/v1/products/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer fake-token-123"
      },
      body: JSON.stringify(payload)
    })
    expect(result).toEqual(mockCreated)
  })

  it("deleteProduct should send DELETE request and return true on success", async () => {
    localStorage.setItem("access_token", "token-xyz")
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 204
    })

    const result = await adminApi.deleteProduct("prod-99")
    expect(global.fetch).toHaveBeenCalledWith("/api/v1/products/prod-99", {
      method: "DELETE",
      headers: { Authorization: "Bearer token-xyz" }
    })
    expect(result).toBe(true)
  })

  it("updateOrderStatus should send PATCH with new status", async () => {
    localStorage.setItem("access_token", "token-admin")
    const updatedOrder = { id: "o1", status: "SHIPPED" }

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => updatedOrder
    })

    const result = await adminApi.updateOrderStatus("o1", "SHIPPED")
    expect(global.fetch).toHaveBeenCalledWith("/api/v1/orders/o1/status", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer token-admin"
      },
      body: JSON.stringify({ status: "SHIPPED" })
    })
    expect(result.status).toBe("SHIPPED")
  })

  it("restoreBackup should call restore endpoint with filename payload", async () => {
    localStorage.setItem("access_token", "token-admin")
    global.fetch = vi.fn().mockResolvedValue({
      ok: true
    })

    const result = await adminApi.restoreBackup("backup-2026.sql")
    expect(global.fetch).toHaveBeenCalledWith("/api/v1/admin/backups/restore", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer token-admin"
      },
      body: JSON.stringify({ filename: "backup-2026.sql" })
    })
    expect(result).toBe(true)
  })

  it("should prioritize admin_access_token over access_token when customer token is present", async () => {
    localStorage.setItem("admin_access_token", "admin-secret-token")
    localStorage.setItem("access_token", "customer-overridden-token")

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => []
    })

    await adminApi.getVouchers()
    expect(global.fetch).toHaveBeenCalledWith("/api/v1/vouchers/?limit=100", {
      headers: { Authorization: "Bearer admin-secret-token" }
    })
  })
})
