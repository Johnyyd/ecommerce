import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { AdminProducts } from "./AdminProducts"
import { adminApi } from "@/services/adminApi"

vi.mock("@/services/adminApi", () => ({
  adminApi: {
    getProducts: vi.fn(),
    createProduct: vi.fn(),
    updateProduct: vi.fn(),
    deleteProduct: vi.fn(),
  }
}))

describe("AdminProducts Pagination Component", () => {
  const mockCategories = [{ id: "c1", name: "Electronics", slug: "electronics" }]
  const mockProducts = Array.from({ length: 100 }, (_, i) => ({
    id: `prod-${i + 1}`,
    name: `Premium Product ${i + 1}`,
    price: 30 + i,
    stock_quantity: 50,
    category_id: "c1",
    brand: "Acme"
  }))

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders catalog header with total count and 100 per page indicator", () => {
    render(
      <AdminProducts
        products={mockProducts}
        categories={mockCategories}
        isFetching={false}
        onRefresh={vi.fn()}
        totalCount={1000000}
      />
    )

    expect(screen.getByText("Store Catalog")).toBeInTheDocument()
    expect(screen.getByText(/1,000,000 total items • 100 per page/i)).toBeInTheDocument()
    expect(screen.getByText(/Showing/i)).toBeInTheDocument()
    expect(screen.getByText(/Page 1 of 10,000/i)).toBeInTheDocument()
  })

  it("calls adminApi.getProducts with page 2 and limit 100 when next page is clicked", async () => {
    const page2Products = Array.from({ length: 100 }, (_, i) => ({
      id: `prod-${i + 101}`,
      name: `Premium Product ${i + 101}`,
      price: 130 + i,
      stock_quantity: 40,
      category_id: "c1",
      brand: "Acme"
    }))

    const page2Result = Object.assign([...page2Products], {
      items: page2Products,
      total: 1000000
    })

    vi.mocked(adminApi.getProducts).mockResolvedValue(page2Result as any)

    render(
      <AdminProducts
        products={mockProducts}
        categories={mockCategories}
        isFetching={false}
        onRefresh={vi.fn()}
        totalCount={1000000}
      />
    )

    const nextBtn = screen.getByTitle("Next Page")
    fireEvent.click(nextBtn)

    await waitFor(() => {
      expect(adminApi.getProducts).toHaveBeenCalledWith(
        expect.objectContaining({ page: 2, limit: 100 })
      )
    })
  })

  it("navigates to a specific page using jump to page input", async () => {
    const page50Products = [
      { id: "prod-5001", name: "Premium Product 5001", price: 99, stock_quantity: 10, category_id: "c1", brand: "Acme" }
    ]
    const page50Result = Object.assign([...page50Products], {
      items: page50Products,
      total: 1000000
    })

    vi.mocked(adminApi.getProducts).mockResolvedValue(page50Result as any)

    render(
      <AdminProducts
        products={mockProducts}
        categories={mockCategories}
        isFetching={false}
        onRefresh={vi.fn()}
        totalCount={1000000}
      />
    )

    const jumpInput = screen.getByPlaceholderText("1")
    fireEvent.change(jumpInput, { target: { value: "50" } })

    const goBtn = screen.getByRole("button", { name: "Go" })
    fireEvent.click(goBtn)

    await waitFor(() => {
      expect(adminApi.getProducts).toHaveBeenCalledWith(
        expect.objectContaining({ page: 50, limit: 100 })
      )
    })
  })

  it("calls adminApi.getProducts with low_stock: true when low stock filter button is clicked", async () => {
    const lowStockProducts = [
      { id: "prod-low-1", name: "Low Stock Item 1", price: 25, stock_quantity: 3, category_id: "c1", brand: "Acme" }
    ]
    const lowStockResult = Object.assign([...lowStockProducts], {
      items: lowStockProducts,
      total: 1
    })

    vi.mocked(adminApi.getProducts).mockResolvedValue(lowStockResult as any)

    render(
      <AdminProducts
        products={mockProducts}
        categories={mockCategories}
        isFetching={false}
        onRefresh={vi.fn()}
        totalCount={1000000}
      />
    )

    const lowStockBtn = screen.getByTestId("filter-low-stock-products")
    fireEvent.click(lowStockBtn)

    await waitFor(() => {
      expect(adminApi.getProducts).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1, limit: 100, low_stock: true })
      )
    })
  })

  it("automatically queries low stock products on mount when stockFilter prop is 'low_stock'", async () => {
    const lowStockProducts = [
      { id: "prod-low-1", name: "Low Stock Item 1", price: 25, stock_quantity: 2, category_id: "c1", brand: "Acme" }
    ]
    const lowStockResult = Object.assign([...lowStockProducts], {
      items: lowStockProducts,
      total: 1
    })

    vi.mocked(adminApi.getProducts).mockResolvedValue(lowStockResult as any)

    render(
      <AdminProducts
        products={mockProducts}
        categories={mockCategories}
        isFetching={false}
        onRefresh={vi.fn()}
        totalCount={1000000}
        stockFilter="low_stock"
      />
    )

    await waitFor(() => {
      expect(adminApi.getProducts).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1, limit: 100, low_stock: true })
      )
    })
  })
})
