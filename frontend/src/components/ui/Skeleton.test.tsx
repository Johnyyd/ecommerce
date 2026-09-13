import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { Skeleton } from "./Skeleton"

describe("Skeleton Component", () => {
  it("renders with default classes", () => {
    render(<Skeleton />)
    const skeleton = screen.getByTestId("skeleton")
    expect(skeleton).toBeInTheDocument()
    expect(skeleton).toHaveClass("animate-pulse")
    expect(skeleton).toHaveClass("rounded-lg")
  })

  it("applies custom className", () => {
    render(<Skeleton className="h-10 w-24" />)
    const skeleton = screen.getByTestId("skeleton")
    expect(skeleton).toHaveClass("h-10")
    expect(skeleton).toHaveClass("w-24")
  })
})
