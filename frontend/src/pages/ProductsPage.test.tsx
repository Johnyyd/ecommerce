import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { ProductsPage } from "./ProductsPage"
import { useProductStore } from "@/store/useProductStore"

vi.mock("@/components/layout/Navbar", () => ({
  Navbar: () => <div data-testid="mock-navbar">Navbar</div>
}))

describe("ProductsPage Component", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useProductStore.setState({
      products: [],
      isLoading: false,
      error: null,
      page: 1,
      total: 0,
      limit: 12,
      filters: {},
    })
  })

  it("renders loading skeletons when isLoading is true and no products loaded", () => {
    useProductStore.setState({ isLoading: true, products: [] })
    const { container } = render(<ProductsPage />)

    const pulses = container.querySelectorAll(".animate-pulse")
    expect(pulses.length).toBeGreaterThan(0)
  })

  it("renders product cards and smart pagination without crashing with 1,000,000 products", () => {
    const sampleProducts = Array.from({ length: 12 }, (_, i) => ({
      id: `p-${i + 1}`,
      name: `Test Shoe ${i + 1}`,
      description: "Description",
      price: 100 + i,
      stock_quantity: 10,
      brand: "Nike"
    }))

    useProductStore.setState({
      products: sampleProducts,
      total: 1000000,
      limit: 12,
      page: 1,
      isLoading: false
    })

    render(<ProductsPage />)

    expect(screen.getByText("Collection")).toBeInTheDocument()
    expect(screen.getByText(/1,000,000 items/i)).toBeInTheDocument()
    expect(screen.getByText("Test Shoe 1")).toBeInTheDocument()

    // Bounded number of buttons, not 83,334!
    const pageButtons = screen.getAllByRole("button", { name: /^[0-9,]+$/ })
    expect(pageButtons.length).toBeLessThanOrEqual(10)
    expect(screen.getByText("...")).toBeInTheDocument()
    expect(screen.getByText("83,334")).toBeInTheDocument()
  })

  it("opens and closes mobile filter drawer on mobile toggle button click", () => {
    useProductStore.setState({
      products: [{ id: "p1", name: "Shoe", description: "", price: 50, stock_quantity: 5 }],
      total: 1,
      limit: 12,
      page: 1,
      isLoading: false
    })

    render(<ProductsPage />)

    const filterBtn = screen.getByRole("button", { name: /filters/i })
    fireEvent.click(filterBtn)

    // Drawer is now open with close button
    const closeBtn = screen.getByLabelText("Close filters")
    expect(closeBtn).toBeInTheDocument()

    fireEvent.click(closeBtn)
  })
})
