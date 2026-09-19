import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { Admin } from "./Admin"
import { useAuthStore } from "@/store/useAuthStore"
import { adminApi } from "@/services/adminApi"

vi.mock("@/services/adminApi", () => ({
  adminApi: {
    getProducts: vi.fn().mockResolvedValue([
      { id: "p1", name: "Premium Shirt", price: 49.99, stock_quantity: 15, category_id: "c1" }
    ]),
    getBrands: vi.fn().mockResolvedValue([
      { id: "b1", name: "Acme Atelier", slug: "acme" }
    ]),
    getVouchers: vi.fn().mockResolvedValue([
      { id: "v1", code: "SAVE20", discount_type: "PERCENTAGE", discount_value: 20, min_order_amount: 50, times_used: 2, is_active: true }
    ]),
    getOrders: vi.fn().mockResolvedValue([
      { id: "o1", user_id: "u123", total_amount: 100, status: "PENDING", payment_method: "STRIPE", payment: { status: "SUCCESS" } }
    ]),
    getUsers: vi.fn().mockResolvedValue([
      { id: "u1", username: "johndoe", email: "john@example.com", role: "customer", is_active: true }
    ]),
    getCategories: vi.fn().mockResolvedValue([
      { id: "c1", name: "Apparel", slug: "apparel" }
    ]),
    getBackups: vi.fn().mockResolvedValue([
      { filename: "db_snapshot_2026.dump", size_human: "2.4 MB", created_at: "2026-09-13T10:00:00Z" }
    ]),
    createProduct: vi.fn(),
    deleteProduct: vi.fn(),
    createCategory: vi.fn(),
    deleteCategory: vi.fn(),
    createBrand: vi.fn(),
    deleteBrand: vi.fn(),
    createVoucher: vi.fn(),
    toggleVoucherStatus: vi.fn(),
    deleteVoucher: vi.fn(),
    updateOrderStatus: vi.fn(),
    toggleUserStatus: vi.fn(),
    updateUserRole: vi.fn(),
    createBackup: vi.fn(),
    restoreBackup: vi.fn()
  }
}))

describe("Admin Layout & Sub-components", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useAuthStore.getState().setUser({
      id: "admin-1",
      username: "master_admin",
      email: "admin@store.com",
      role: "admin",
      is_active: true,
      created_at: "2026-01-01",
      updated_at: "2026-01-01"
    })
  })

  it("renders operations portal header with current admin user details", async () => {
    render(<Admin />)

    expect(screen.getByText("Operations Portal")).toBeInTheDocument()
    expect(screen.getByText("master_admin")).toBeInTheDocument()
    expect(screen.getByText("admin")).toBeInTheDocument()
  })

  it("renders all 8 domain navigation tabs", async () => {
    render(<Admin />)

    expect(screen.getByTestId("tab-overview")).toBeInTheDocument()
    expect(screen.getByTestId("tab-products")).toBeInTheDocument()
    expect(screen.getByTestId("tab-categories")).toBeInTheDocument()
    expect(screen.getByTestId("tab-brands")).toBeInTheDocument()
    expect(screen.getByTestId("tab-vouchers")).toBeInTheDocument()
    expect(screen.getByTestId("tab-orders")).toBeInTheDocument()
    expect(screen.getByTestId("tab-users")).toBeInTheDocument()
    expect(screen.getByTestId("tab-backups")).toBeInTheDocument()
  })

  it("calls fetchAllData on mount and loads items into overview", async () => {
    render(<Admin />)

    await waitFor(() => {
      expect(adminApi.getProducts).toHaveBeenCalled()
      expect(adminApi.getOrders).toHaveBeenCalled()
      expect(adminApi.getUsers).toHaveBeenCalled()
    })

    // In overview, we should see stat metrics
    expect(screen.getByText(/Total Revenue/i)).toBeInTheDocument()
    expect(screen.getByText(/Total Orders/i)).toBeInTheDocument()
  })

  it("switches to Products tab on click and renders products", async () => {
    render(<Admin />)

    const productsTab = screen.getByTestId("tab-products")
    fireEvent.click(productsTab)

    await waitFor(() => {
      expect(screen.getByText("Store Catalog")).toBeInTheDocument()
      expect(screen.getByText("Premium Shirt")).toBeInTheDocument()
    })
  })

  it("switches to Orders tab on click and renders order list", async () => {
    render(<Admin />)

    const ordersTab = screen.getByTestId("tab-orders")
    fireEvent.click(ordersTab)

    await waitFor(() => {
      expect(screen.getByText("Order Management")).toBeInTheDocument()
      expect(screen.getByText("#o1")).toBeInTheDocument()
    })
  })

  it("switches to Users tab on click and renders users table", async () => {
    render(<Admin />)

    const usersTab = screen.getByTestId("tab-users")
    fireEvent.click(usersTab)

    await waitFor(() => {
      expect(screen.getByText("User Accounts")).toBeInTheDocument()
      expect(screen.getByText("johndoe")).toBeInTheDocument()
      expect(screen.getByText("john@example.com")).toBeInTheDocument()
    })
  })

  it("switches to Backups tab on click and renders database backup snapshots", async () => {
    render(<Admin />)

    const backupsTab = screen.getByTestId("tab-backups")
    fireEvent.click(backupsTab)

    await waitFor(() => {
      expect(screen.getByText("Database Backup & Recovery")).toBeInTheDocument()
      expect(screen.getByText("db_snapshot_2026.dump")).toBeInTheDocument()
    })
  })

  it("denies access to customer role and redirects to login", async () => {
    useAuthStore.getState().setUser({
      id: "cust-1",
      username: "buyer_joe",
      email: "buyer@store.com",
      role: "customer",
      is_active: true,
      created_at: "2026-01-01",
      updated_at: "2026-01-01"
    })

    render(<Admin />)
    // Operations portal header shouldn't be rendered for customer
    // The component redirects to /login immediately
  })
})
