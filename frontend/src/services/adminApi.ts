import {
  ProductItem,
  BrandItem,
  VoucherItem,
  OrderData,
  UserData,
  CategoryData,
  BackupFile,
  AdminReviewItem
} from "@/types/admin"
import { getAdminToken } from "@/lib/auth"
export { getAdminToken }

function getAuthHeader(): Record<string, string> {
  const token = getAdminToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export const adminApi = {
  // --- Products ---
  async getProducts(params?: {
    skip?: number
    limit?: number
    page?: number
    q?: string
    category_id?: string
    brand?: string
  }): Promise<ProductItem[] & { items: ProductItem[]; total: number }> {
    const limit = params?.limit ?? 100
    const query = new URLSearchParams()
    query.set("limit", limit.toString())

    const skip = params?.skip ?? (params?.page ? (params.page - 1) * limit : 0)
    if (skip > 0) query.set("skip", skip.toString())
    if (params?.q) query.set("q", params.q)
    if (params?.category_id) query.set("category_id", params.category_id)
    if (params?.brand) query.set("brand", params.brand)

    const res = await fetch(`/api/v1/products/?${query.toString()}`)
    if (!res.ok) throw new Error("Failed to fetch products")
    const data = await res.json()
    const items: ProductItem[] = Array.isArray(data) ? data : data.items || []
    const total: number = typeof data?.total === "number" ? data.total : items.length

    const result = [...items] as ProductItem[] & { items: ProductItem[]; total: number }
    Object.defineProperties(result, {
      items: { value: items, writable: true, configurable: true, enumerable: false },
      total: { value: total, writable: true, configurable: true, enumerable: false }
    })
    return result
  },

  async createProduct(payload: Record<string, unknown>): Promise<ProductItem> {
    const res = await fetch("/api/v1/products/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader()
      },
      body: JSON.stringify(payload)
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || "Failed to create product")
    }
    return res.json()
  },

  async updateProduct(id: string, payload: Record<string, unknown>): Promise<ProductItem> {
    const res = await fetch(`/api/v1/products/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader()
      },
      body: JSON.stringify(payload)
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || "Failed to update product")
    }
    return res.json()
  },

  async deleteProduct(id: string): Promise<boolean> {
    const res = await fetch(`/api/v1/products/${id}`, {
      method: "DELETE",
      headers: getAuthHeader()
    })
    if (!res.ok && res.status !== 204) throw new Error("Failed to delete product")
    return true
  },

  // --- Categories ---
  async getCategories(): Promise<CategoryData[]> {
    const res = await fetch("/api/v1/categories/")
    if (!res.ok) throw new Error("Failed to fetch categories")
    const data = await res.json()
    return Array.isArray(data) ? data : []
  },

  async createCategory(payload: { name: string; slug: string }): Promise<CategoryData> {
    const res = await fetch("/api/v1/categories/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader()
      },
      body: JSON.stringify(payload)
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || "Failed to create category")
    }
    return res.json()
  },

  async deleteCategory(id: string): Promise<boolean> {
    const res = await fetch(`/api/v1/categories/${id}`, {
      method: "DELETE",
      headers: getAuthHeader()
    })
    if (!res.ok && res.status !== 204) throw new Error("Failed to delete category")
    return true
  },

  // --- Brands ---
  async getBrands(): Promise<BrandItem[]> {
    const res = await fetch("/api/v1/brands/?limit=100")
    if (!res.ok) throw new Error("Failed to fetch brands")
    const data = await res.json()
    return Array.isArray(data) ? data : []
  },

  async createBrand(payload: Record<string, unknown>): Promise<BrandItem> {
    const res = await fetch("/api/v1/brands/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader()
      },
      body: JSON.stringify(payload)
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || "Failed to create brand")
    }
    return res.json()
  },

  async updateBrand(id: string, payload: Record<string, unknown>): Promise<BrandItem> {
    const res = await fetch(`/api/v1/brands/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader()
      },
      body: JSON.stringify(payload)
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || "Failed to update brand")
    }
    return res.json()
  },

  async deleteBrand(id: string): Promise<boolean> {
    const res = await fetch(`/api/v1/brands/${id}`, {
      method: "DELETE",
      headers: getAuthHeader()
    })
    if (!res.ok && res.status !== 204) throw new Error("Failed to delete brand")
    return true
  },

  // --- Vouchers ---
  async getVouchers(): Promise<VoucherItem[]> {
    const res = await fetch("/api/v1/vouchers/?limit=100", {
      headers: getAuthHeader()
    })
    if (!res.ok) throw new Error("Failed to fetch vouchers")
    const data = await res.json()
    return Array.isArray(data) ? data : []
  },

  async createVoucher(payload: Record<string, unknown>): Promise<VoucherItem> {
    const res = await fetch("/api/v1/vouchers/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader()
      },
      body: JSON.stringify(payload)
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || "Failed to create voucher")
    }
    return res.json()
  },

  async updateVoucher(id: string, payload: Record<string, unknown>): Promise<VoucherItem> {
    const res = await fetch(`/api/v1/vouchers/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader()
      },
      body: JSON.stringify(payload)
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || "Failed to update voucher")
    }
    return res.json()
  },

  async deleteVoucher(id: string): Promise<boolean> {
    const res = await fetch(`/api/v1/vouchers/${id}`, {
      method: "DELETE",
      headers: getAuthHeader()
    })
    if (!res.ok && res.status !== 204) throw new Error("Failed to delete voucher")
    return true
  },

  // --- Orders ---
  async getOrders(): Promise<OrderData[]> {
    const res = await fetch("/api/v1/orders/admin?limit=100", {
      headers: getAuthHeader()
    })
    if (!res.ok) throw new Error("Failed to fetch orders")
    const data = await res.json()
    return Array.isArray(data) ? data : []
  },

  async updateOrderStatus(orderId: string, status: string): Promise<OrderData> {
    const res = await fetch(`/api/v1/orders/${orderId}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader()
      },
      body: JSON.stringify({ status })
    })
    if (!res.ok) throw new Error("Failed to update order status")
    return res.json()
  },

  // --- Users ---
  async getUsers(): Promise<UserData[]> {
    const res = await fetch("/api/v1/users/?limit=100", {
      headers: getAuthHeader()
    })
    if (!res.ok) throw new Error("Failed to fetch users")
    const data = await res.json()
    return Array.isArray(data) ? data : []
  },

  async updateUserRole(id: string, role: string): Promise<UserData> {
    const res = await fetch(`/api/v1/users/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader()
      },
      body: JSON.stringify({ role })
    })
    if (!res.ok) throw new Error("Failed to change user role")
    return res.json()
  },

  async toggleUserStatus(id: string, is_active: boolean): Promise<UserData> {
    const res = await fetch(`/api/v1/users/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader()
      },
      body: JSON.stringify({ is_active })
    })
    if (!res.ok) throw new Error("Failed to update user status")
    return res.json()
  },

  // --- Backups ---
  async getBackups(): Promise<BackupFile[]> {
    const res = await fetch("/api/v1/admin/backups/", {
      headers: getAuthHeader()
    })
    if (!res.ok) throw new Error("Failed to fetch backups")
    const data = await res.json()
    return Array.isArray(data) ? data : []
  },

  async createBackup(): Promise<BackupFile> {
    const res = await fetch("/api/v1/admin/backups/create", {
      method: "POST",
      headers: getAuthHeader()
    })
    if (!res.ok) throw new Error("Backup creation failed")
    return res.json()
  },

  async restoreBackup(filename: string): Promise<boolean> {
    const res = await fetch("/api/v1/admin/backups/restore", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader()
      },
      body: JSON.stringify({ filename })
    })
    if (!res.ok) throw new Error("Restore database failed")
    return true
  },

  // --- Reviews ---
  async getReviews(productId?: string, rating?: number): Promise<AdminReviewItem[]> {
    const params = new URLSearchParams()
    if (productId) params.append("product_id", productId)
    if (rating) params.append("rating", rating.toString())
    const queryString = params.toString() ? `?${params.toString()}` : ""
    const res = await fetch(`/api/v1/reviews/admin/all${queryString}`, {
      headers: getAuthHeader()
    })
    if (!res.ok) throw new Error("Failed to fetch reviews")
    return res.json()
  },

  async deleteReview(reviewId: string): Promise<boolean> {
    const res = await fetch(`/api/v1/reviews/${reviewId}`, {
      method: "DELETE",
      headers: getAuthHeader()
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || "Failed to delete review")
    }
    return true
  }
}

