import React, { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "motion/react"
import {
  Lightning,
  FileXls,
  FileCsv,
  DownloadSimple,
  ArrowClockwise,
  UploadSimple,
  EnvelopeSimple,
  ShieldCheck,
  CheckCircle,
  Eye,
  PaperPlaneTilt,
  Sparkle,
  X
} from "@phosphor-icons/react"
import { toast } from "sonner"
import { QueueMetrics, SandboxEmail, MediaUploadResult } from "@/types/admin"

const API_BASE = (import.meta as any).env.VITE_API_URL || "/api/v1"

export const AdminAsyncJobs: React.FC = () => {
  const getActiveToken = useCallback(() => {
    return localStorage.getItem("access_token") || localStorage.getItem("token") || ""
  }, [])
  const token = getActiveToken()

  // Queue Status State
  const [metrics, setMetrics] = useState<QueueMetrics | null>(null)
  const [isLoadingMetrics, setIsLoadingMetrics] = useState<boolean>(false)

  // Report Generation State
  const [reportType, setReportType] = useState<string>("sales")
  const [reportFormat, setReportFormat] = useState<string>("xlsx")
  const [reportRange, setReportRange] = useState<string>("30d")
  const [isGeneratingReport, setIsGeneratingReport] = useState<boolean>(false)
  const [currentJobId, setCurrentJobId] = useState<string | null>(null)
  const [reportStatus, setReportStatus] = useState<any | null>(null)

  // Media Optimization State
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isUploadingMedia, setIsUploadingMedia] = useState<boolean>(false)
  const [mediaResult, setMediaResult] = useState<MediaUploadResult | null>(null)

  // Email Sandbox State
  const [emails, setEmails] = useState<SandboxEmail[]>([])
  const [isLoadingEmails, setIsLoadingEmails] = useState<boolean>(false)
  const [previewEmail, setPreviewEmail] = useState<SandboxEmail | null>(null)
  const [testEmailRecipient, setTestEmailRecipient] = useState<string>("customer@example.com")
  const [testEmailTemplate, setTestEmailTemplate] = useState<string>("order_invoice")
  const [isSendingTestEmail, setIsSendingTestEmail] = useState<boolean>(false)

  // Fetch Queue Metrics
  const fetchMetrics = useCallback(async () => {
    const activeToken = getActiveToken()
    if (!activeToken) return
    setIsLoadingMetrics(true)
    try {
      const res = await fetch(`${API_BASE}/admin/queue/status`, {
        headers: { Authorization: `Bearer ${activeToken}` }
      })
      if (res.ok) {
        const data = await res.json()
        setMetrics(data)
      }
    } catch {
      // Handled silently
    } finally {
      setIsLoadingMetrics(false)
    }
  }, [getActiveToken])

  // Fetch Sandbox Outbox
  const fetchEmails = useCallback(async () => {
    const activeToken = getActiveToken()
    if (!activeToken) return
    setIsLoadingEmails(true)
    try {
      const res = await fetch(`${API_BASE}/admin/emails/outbox?limit=50`, {
        headers: { Authorization: `Bearer ${activeToken}` }
      })
      if (res.ok) {
        const data = await res.json()
        setEmails(data)
      }
    } catch {
      // Handled silently
    } finally {
      setIsLoadingEmails(false)
    }
  }, [getActiveToken])

  useEffect(() => {
    fetchMetrics()
    fetchEmails()
  }, [fetchMetrics, fetchEmails])

  // Report Polling when job is running
  useEffect(() => {
    if (!currentJobId || !token) return
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/reports/${currentJobId}/status`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (res.ok) {
          const data = await res.json()
          setReportStatus(data)
          if (data.status === "COMPLETED") {
            setIsGeneratingReport(false)
            toast.success("Sales report generated successfully!")
            clearInterval(interval)
          } else if (data.status === "FAILED") {
            setIsGeneratingReport(false)
            toast.error("Report generation failed: " + (data.error || "Unknown error"))
            clearInterval(interval)
          }
        }
      } catch {
        // Retry next tick
      }
    }, 2000)
    return () => clearInterval(interval)
  }, [currentJobId, token])

  // Trigger Report Generation
  const handleTriggerReport = async () => {
    if (!token) return
    setIsGeneratingReport(true)
    setReportStatus(null)

    // Calculate dates from preset range
    const now = new Date()
    let dateFrom: string | null = null
    if (reportRange === "today") {
      const d = new Date()
      d.setHours(0, 0, 0, 0)
      dateFrom = d.toISOString()
    } else if (reportRange === "7d") {
      const d = new Date()
      d.setDate(d.getDate() - 7)
      dateFrom = d.toISOString()
    } else if (reportRange === "30d") {
      const d = new Date()
      d.setDate(d.getDate() - 30)
      dateFrom = d.toISOString()
    }

    try {
      const res = await fetch(`${API_BASE}/reports/export`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          report_type: reportType,
          format: reportFormat,
          date_from: dateFrom,
          date_to: now.toISOString()
        })
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || "Failed to trigger report")
      }
      const data = await res.json()
      setCurrentJobId(data.job_id)
      toast.info("Report task enqueued. Compiling asynchronously...")
    } catch (err: any) {
      toast.error(err.message || "Error generating report")
      setIsGeneratingReport(false)
    }
  }

  // Handle Download with authenticated blob stream
  const handleDownload = async () => {
    if (!reportStatus?.download_url) return
    const activeToken = getActiveToken()
    if (!activeToken) {
      toast.error("Authentication required to download report")
      return
    }
    try {
      const url = `${API_BASE}${reportStatus.download_url.replace('/api/v1', '')}`
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${activeToken}` }
      })
      if (!res.ok) {
        throw new Error(`Failed to download report (${res.status})`)
      }
      const blob = await res.blob()
      const blobUrl = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = blobUrl
      a.download = reportStatus.file_name || `report_${currentJobId || "export"}.${reportFormat}`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(blobUrl)
      toast.success("Report downloaded successfully!")
    } catch (err: any) {
      toast.error(err.message || "Download failed")
    }
  }

  // Handle Media File Upload
  const handleMediaUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedFile || !token) return

    setIsUploadingMedia(true)
    const formData = new FormData()
    formData.append("file", selectedFile)

    try {
      const res = await fetch(`${API_BASE}/media/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || "Upload rejected")
      }
      const data = await res.json()
      setMediaResult(data)
      toast.success("Image optimized to WebP and responsive thumbnails generated!")
    } catch (err: any) {
      toast.error(err.message || "Upload failed")
    } finally {
      setIsUploadingMedia(false)
    }
  }

  // Handle Test Email Dispatch
  const handleSendTestEmail = async () => {
    if (!token || !testEmailRecipient) return
    setIsSendingTestEmail(true)
    try {
      const res = await fetch(`${API_BASE}/admin/emails/test`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          recipient: testEmailRecipient,
          template: testEmailTemplate
        })
      })
      if (!res.ok) throw new Error("Failed to dispatch test email")
      toast.success(`Dispatched ${testEmailTemplate} email!`)
      await fetchEmails()
    } catch (err: any) {
      toast.error(err.message || "Dispatch error")
    } finally {
      setIsSendingTestEmail(false)
    }
  }

  return (
    <div className="flex flex-col gap-10">
      {/* SECTION 1: TOP HEADER & WORKER TELEMETRY */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-zinc-100">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-zinc-900 flex items-center gap-2">
            <Lightning size={26} weight="fill" className="text-amber-500" />
            Async Workers &amp; Task Queue
          </h2>
          <p className="text-sm text-zinc-500 mt-1">
            Enterprise background job dispatcher powered by ARQ &amp; Redis Streams.
          </p>
        </div>

        <button
          onClick={() => {
            fetchMetrics()
            fetchEmails()
            toast.success("Telemetry refreshed")
          }}
          disabled={isLoadingMetrics}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-zinc-200 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 active:scale-95 transition-all shadow-sm"
        >
          <ArrowClockwise size={15} className={isLoadingMetrics ? "animate-spin" : ""} />
          Refresh Stats
        </button>
      </div>

      {/* WORKER TELEMETRY STAT CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Worker Daemon Status */}
        <div className="p-5 rounded-2xl bg-white border border-zinc-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>Worker Daemon</span>
            <span className="relative flex h-2.5 w-2.5">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${metrics?.worker_status === 'HEALTHY' ? 'bg-emerald-400' : 'bg-amber-400'} opacity-75`}></span>
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${metrics?.worker_status === 'HEALTHY' ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
            </span>
          </div>
          <div className="mt-3">
            <span className="text-xl font-bold text-zinc-900">{metrics?.worker_status || "CONNECTING"}</span>
            <p className="text-[11px] text-zinc-400 mt-0.5">Redis Host: {metrics?.redis_connected ? "Connected (Port 6379)" : "Disconnected"}</p>
          </div>
        </div>

        {/* Queued Tasks */}
        <div className="p-5 rounded-2xl bg-white border border-zinc-100 shadow-sm flex flex-col justify-between">
          <span className="text-xs text-zinc-500">Queued Tasks</span>
          <div className="mt-3">
            <span className="text-3xl font-extrabold text-zinc-900">{metrics?.queued_jobs ?? 0}</span>
            <p className="text-[11px] text-zinc-400 mt-0.5">Awaiting worker thread</p>
          </div>
        </div>

        {/* Active / Cached Jobs */}
        <div className="p-5 rounded-2xl bg-white border border-zinc-100 shadow-sm flex flex-col justify-between">
          <span className="text-xs text-zinc-500">Active / Cached Jobs</span>
          <div className="mt-3">
            <span className="text-3xl font-extrabold text-zinc-900">{metrics?.active_or_cached_jobs ?? 0}</span>
            <p className="text-[11px] text-zinc-400 mt-0.5">In-flight or cached in Redis</p>
          </div>
        </div>

        {/* Total Reports Output */}
        <div className="p-5 rounded-2xl bg-white border border-zinc-100 shadow-sm flex flex-col justify-between">
          <span className="text-xs text-zinc-500">Reports Generated</span>
          <div className="mt-3">
            <span className="text-3xl font-extrabold text-zinc-900">{metrics?.total_reports_generated ?? 0}</span>
            <p className="text-[11px] text-emerald-600 font-medium mt-0.5">Async non-blocking export</p>
          </div>
        </div>
      </div>

      {/* SECTION 2: REPORT GENERATOR & MEDIA OPTIMIZER */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* REPORT GENERATOR STUDIO */}
        <div className="p-7 rounded-3xl bg-white border border-zinc-100 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <FileXls size={20} weight="bold" />
              </div>
              <h3 className="text-lg font-bold text-zinc-900">Executive Report Studio</h3>
            </div>
            <p className="text-xs text-zinc-500 leading-relaxed mb-6">
              Export comprehensive financial and sales reports into Excel or CSV in background threads without database locking.
            </p>

            {/* Scope & Range selection */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-2">
                  Report Scope
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: "sales", label: "Sales & Revenue" },
                    { id: "orders", label: "Orders & Shipping" }
                  ].map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setReportType(t.id)}
                      className={`py-2 rounded-xl text-xs font-semibold transition-all ${
                        reportType === t.id
                          ? "bg-zinc-900 text-white shadow-sm"
                          : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-2">
                  Time Horizon
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { id: "today", label: "Today" },
                    { id: "7d", label: "7 Days" },
                    { id: "30d", label: "30 Days" },
                    { id: "all", label: "All Time" }
                  ].map(r => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setReportRange(r.id)}
                      className={`py-2 rounded-xl text-xs font-semibold transition-all ${
                        reportRange === r.id
                          ? "bg-zinc-900 text-white shadow-sm"
                          : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Format selection */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-2">
                  Export Format
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div
                    onClick={() => setReportFormat("xlsx")}
                    className={`cursor-pointer p-3.5 rounded-2xl border flex items-center justify-between transition-all ${
                      reportFormat === "xlsx"
                        ? "border-zinc-900 bg-zinc-50/80 shadow-sm"
                        : "border-zinc-200 hover:border-zinc-300"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <FileXls size={24} className="text-emerald-600" />
                      <div>
                        <p className="text-xs font-bold text-zinc-900">Microsoft Excel</p>
                        <p className="text-[10px] text-zinc-500">.xlsx styled format</p>
                      </div>
                    </div>
                    {reportFormat === "xlsx" && <CheckCircle size={16} weight="fill" className="text-zinc-900" />}
                  </div>

                  <div
                    onClick={() => setReportFormat("csv")}
                    className={`cursor-pointer p-3.5 rounded-2xl border flex items-center justify-between transition-all ${
                      reportFormat === "csv"
                        ? "border-zinc-900 bg-zinc-50/80 shadow-sm"
                        : "border-zinc-200 hover:border-zinc-300"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <FileCsv size={24} className="text-blue-600" />
                      <div>
                        <p className="text-xs font-bold text-zinc-900">Raw Comma Separated</p>
                        <p className="text-[10px] text-zinc-500">.csv standard format</p>
                      </div>
                    </div>
                    {reportFormat === "csv" && <CheckCircle size={16} weight="fill" className="text-zinc-900" />}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Action / Progress Box */}
          <div className="mt-8 pt-6 border-t border-zinc-100">
            {isGeneratingReport ? (
              <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full border-2 border-zinc-200 border-t-zinc-900 animate-spin" />
                  <div>
                    <p className="text-xs font-semibold text-zinc-900">Compiling Report...</p>
                    <p className="text-[11px] text-zinc-500">Worker is querying orders and applying formatting</p>
                  </div>
                </div>
                <span className="font-mono text-xs font-bold text-zinc-900">{reportStatus?.progress || 15}%</span>
              </div>
            ) : reportStatus?.status === "COMPLETED" ? (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-emerald-900">Report Ready!</p>
                  <p className="text-[11px] text-emerald-700">
                    {reportStatus.total_records} orders • ${Number(reportStatus.total_revenue).toFixed(2)}
                  </p>
                </div>
                <button
                  onClick={handleDownload}
                  className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 shadow-sm active:scale-95 transition-all flex items-center gap-1.5"
                >
                  <DownloadSimple size={14} weight="bold" />
                  Download File
                </button>
              </div>
            ) : (
              <button
                onClick={handleTriggerReport}
                className="w-full py-3.5 rounded-xl bg-zinc-900 text-white text-xs font-semibold hover:bg-zinc-800 transition-all shadow-sm active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <Sparkle size={16} />
                Generate Asynchronous Report
              </button>
            )}
          </div>
        </div>

        {/* MEDIA PROCESSING & WEBP OPTIMIZER */}
        <div className="p-7 rounded-3xl bg-white border border-zinc-100 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <UploadSimple size={20} weight="bold" />
              </div>
              <h3 className="text-lg font-bold text-zinc-900">Media &amp; WebP Optimizer</h3>
            </div>
            <p className="text-xs text-zinc-500 leading-relaxed mb-6">
              Pillow-powered background compression to modern WebP with automatic responsive generation (Thumbnail, Medium, Full).
            </p>

            <form onSubmit={handleMediaUpload} className="space-y-4">
              <div className="border-2 border-dashed border-zinc-200 rounded-2xl p-6 text-center hover:border-zinc-300 transition-colors">
                <input
                  type="file"
                  id="media-upload-input"
                  accept="image/png, image/jpeg, image/webp"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
                <label htmlFor="media-upload-input" className="cursor-pointer flex flex-col items-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-zinc-100 text-zinc-600 flex items-center justify-center">
                    <UploadSimple size={20} />
                  </div>
                  <span className="text-xs font-semibold text-zinc-900">
                    {selectedFile ? selectedFile.name : "Click to select product image"}
                  </span>
                  <span className="text-[11px] text-zinc-400">
                    JPEG, PNG, or WebP up to 10MB (OWASP Magic-byte verified)
                  </span>
                </label>
              </div>

              <button
                type="submit"
                disabled={!selectedFile || isUploadingMedia}
                className="w-full py-3 rounded-xl bg-zinc-900 text-white text-xs font-semibold hover:bg-zinc-800 transition-all shadow-sm active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isUploadingMedia ? <ArrowClockwise size={14} className="animate-spin" /> : <ShieldCheck size={16} />}
                {isUploadingMedia ? "Optimizing in Background..." : "Upload & Convert to WebP"}
              </button>
            </form>
          </div>

          {/* Media Result Preview */}
          {mediaResult && (
            <div className="mt-6 pt-6 border-t border-zinc-100 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-zinc-900">Generated Variants</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold text-[10px] border border-emerald-200">
                  Saved {mediaResult.savings_percentage ?? 0}% bandwidth
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                {mediaResult.variants && Object.entries(mediaResult.variants).map(([size, url]) => (
                  <div key={size} className="p-2 rounded-xl bg-zinc-50 border border-zinc-100">
                    <img
                      src={url}
                      alt={size}
                      className="w-full h-16 object-contain rounded-lg bg-white mb-1.5"
                    />
                    <span className="block text-[10px] font-mono text-zinc-600 uppercase font-semibold">{size}</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(url)
                        toast.success(`Copied ${size} WebP URL`)
                      }}
                      className="text-[9px] text-zinc-500 hover:text-zinc-900 underline mt-0.5"
                    >
                      Copy URL
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>

      {/* SECTION 3: EMAIL OUTBOX & TRANSACTIONAL SANDBOX */}
      <div className="p-7 rounded-3xl bg-white border border-zinc-100 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-6 border-b border-zinc-100">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <EnvelopeSimple size={20} weight="bold" />
              </div>
              <h3 className="text-lg font-bold text-zinc-900">Transactional Email Sandbox</h3>
            </div>
            <p className="text-xs text-zinc-500 mt-1">
              Audit and inspect welcome emails, invoices, and password reset notifications generated by background workers.
            </p>
          </div>

          {/* Test Dispatch Form */}
          <div className="flex items-center gap-2">
            <select
              value={testEmailTemplate}
              onChange={(e) => setTestEmailTemplate(e.target.value)}
              className="text-xs font-medium px-3 py-2 rounded-xl border border-zinc-200 bg-white text-zinc-700"
            >
              <option value="welcome">Welcome Email</option>
              <option value="order_invoice">Order Invoice Receipt</option>
              <option value="password_reset">Password Reset OTP</option>
            </select>
            <input
              type="email"
              value={testEmailRecipient}
              onChange={(e) => setTestEmailRecipient(e.target.value)}
              placeholder="recipient@example.com"
              className="text-xs px-3 py-2 rounded-xl border border-zinc-200 text-zinc-900 w-44"
            />
            <button
              onClick={handleSendTestEmail}
              disabled={isSendingTestEmail}
              className="px-4 py-2 rounded-xl bg-zinc-900 text-white text-xs font-semibold hover:bg-zinc-800 transition-all shadow-sm active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
            >
              <PaperPlaneTilt size={14} />
              Test Send
            </button>
            <button
              onClick={() => {
                fetchEmails()
                toast.success("Outbox refreshed")
              }}
              disabled={isLoadingEmails}
              className="p-2 rounded-xl border border-zinc-200 hover:bg-zinc-50 text-zinc-600 active:scale-95 disabled:opacity-50 flex items-center justify-center cursor-pointer"
              title="Refresh Outbox"
            >
              <ArrowClockwise size={15} className={isLoadingEmails ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* Email Outbox Table */}
        {isLoadingEmails && emails.length === 0 ? (
          <div className="text-xs text-zinc-500 py-8 text-center">Loading mailbox...</div>
        ) : emails.length === 0 ? (
          <div className="text-xs text-zinc-500 py-12 text-center border-2 border-dashed border-zinc-100 rounded-2xl">
            No emails recorded yet. Trigger user registration or test dispatch above.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-100 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                  <th className="pb-3">Subject / Template</th>
                  <th className="pb-3">Recipient</th>
                  <th className="pb-3">Mode</th>
                  <th className="pb-3">Timestamp</th>
                  <th className="pb-3 text-right">Preview</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {emails.map((m) => (
                  <tr key={m.id} className="hover:bg-zinc-50/60 transition-colors">
                    <td className="py-3 font-semibold text-zinc-900">
                      <div>{m.subject}</div>
                      <span className="text-[10px] font-mono text-zinc-400 uppercase">{m.template}</span>
                    </td>
                    <td className="py-3 font-mono text-zinc-600">{m.recipient}</td>
                    <td className="py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-100 text-zinc-700">
                        {m.delivery_mode}
                      </span>
                    </td>
                    <td className="py-3 text-zinc-400 text-[11px]">
                      {new Date(m.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() => setPreviewEmail(m)}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-medium transition-colors"
                      >
                        <Eye size={14} />
                        View HTML
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* HTML EMAIL MODAL PREVIEW */}
      <AnimatePresence>
        {previewEmail && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: "spring", damping: 30, stiffness: 350 }}
              className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-zinc-100 overflow-hidden my-8"
            >
              <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-zinc-100">
                <div>
                  <h3 className="text-base font-bold text-zinc-900">{previewEmail.subject}</h3>
                  <p className="text-xs text-zinc-500">To: {previewEmail.recipient} • {previewEmail.delivery_mode}</p>
                </div>
                <button
                  onClick={() => setPreviewEmail(null)}
                  className="w-8 h-8 rounded-full bg-zinc-100 text-zinc-500 flex items-center justify-center hover:bg-zinc-200 transition-colors"
                >
                  <X size={16} weight="bold" />
                </button>
              </div>

              <div className="p-6 max-h-[500px] overflow-y-auto bg-zinc-50">
                <div
                  className="bg-white p-4 rounded-2xl border border-zinc-200/80 shadow-sm"
                  dangerouslySetInnerHTML={{ __html: previewEmail.html_body }}
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
