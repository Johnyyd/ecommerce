import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import { AdminReviews } from "./AdminReviews"
import { adminApi } from "@/services/adminApi"
import { ProductItem, AdminReviewItem } from "@/types/admin"

const mockProducts: ProductItem[] = [
  {
    id: "prod-1",
    name: "Minimalist T-Shirt",
    price: 35.0,
    stock_quantity: 100
  }
]

const mockReviews: AdminReviewItem[] = [
  {
    id: "rev-1",
    product_id: "prod-1",
    product_name: "Minimalist T-Shirt",
    user_id: "user-1",
    username: "john_doe",
    user_email: "john@example.com",
    order_id: "ord-12345678",
    rating: 5,
    comment: "Exceptional quality fabric and fit!",
    is_verified_purchase: true,
    created_at: new Date().toISOString()
  }
]

describe("AdminReviews Component", () => {
  beforeEach(() => {
    vi.spyOn(adminApi, "getReviews").mockResolvedValue(mockReviews)
  })

  it("renders review KPIs and review items list", async () => {
    render(<AdminReviews products={mockProducts} />)

    expect(screen.getByText("Product Reviews & Ratings")).toBeInTheDocument()
    expect(screen.getByText("Total Reviews")).toBeInTheDocument()
    expect(screen.getByText("Average Store Rating")).toBeInTheDocument()
    expect(screen.getByText("Verified Buyers")).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getAllByText("Minimalist T-Shirt").length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText(/john_doe/)).toBeInTheDocument()
      expect(screen.getByText('"Exceptional quality fabric and fit!"')).toBeInTheDocument()
      expect(screen.getByText("Verified Purchase")).toBeInTheDocument()
    })
  })
})
