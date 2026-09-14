import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { AdminAsyncJobs } from "./AdminAsyncJobs"

// Mock fetch globally
beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((url: string) => {
      if (url.includes("/admin/queue/status")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            worker_status: "HEALTHY",
            queued_jobs: 0,
            active_or_cached_jobs: 3,
            total_reports_generated: 12,
            redis_connected: true,
            timestamp: new Date().toISOString()
          })
        })
      }
      if (url.includes("/admin/emails/outbox")) {
        return Promise.resolve({
          ok: true,
          json: async () => [
            {
              id: "mail_123",
              recipient: "user@example.com",
              subject: "Welcome to Enterprise E-Commerce",
              template: "welcome",
              context: { username: "user" },
              html_body: "<h1>Welcome</h1>",
              sent_at: new Date().toISOString(),
              delivery_mode: "SANDBOX"
            }
          ]
        })
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({})
      })
    })
  )
})

describe("AdminAsyncJobs Component", () => {
  it("renders worker telemetry stats correctly", async () => {
    render(<AdminAsyncJobs />)

    expect(screen.getByText("Async Workers & Task Queue")).toBeInTheDocument()
    expect(screen.getByText("Executive Report Studio")).toBeInTheDocument()
    expect(screen.getByText("Media & WebP Optimizer")).toBeInTheDocument()
    expect(screen.getByText("Transactional Email Sandbox")).toBeInTheDocument()
  })

  it("renders report format options", () => {
    render(<AdminAsyncJobs />)

    expect(screen.getByText("Microsoft Excel")).toBeInTheDocument()
    expect(screen.getByText("Raw Comma Separated")).toBeInTheDocument()
    expect(screen.getByText("Generate Asynchronous Report")).toBeInTheDocument()
  })

  it("renders media optimization dropzone", () => {
    render(<AdminAsyncJobs />)

    expect(screen.getByText("Click to select product image")).toBeInTheDocument()
    expect(screen.getByText("Upload & Convert to WebP")).toBeInTheDocument()
  })

  it("renders transactional email outbox and test form", () => {
    render(<AdminAsyncJobs />)

    expect(screen.getByText("Test Send")).toBeInTheDocument()
  })
})
