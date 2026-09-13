import { useState, useMemo } from "react"
import { motion, AnimatePresence } from "motion/react"
import { MagnifyingGlass, Plus, PencilSimple, Trash, X, Ticket, CheckCircle, Prohibit } from "@phosphor-icons/react"
import { toast } from "sonner"
import { VoucherItem, VoucherFormData } from "@/types/admin"
import { adminApi } from "@/services/adminApi"
import { Skeleton } from "@/components/ui/Skeleton"

interface AdminVouchersProps {
  vouchers: VoucherItem[]
  isFetching: boolean
  onRefresh: () => Promise<void>
}

export function AdminVouchers({
  vouchers,
  isFetching,
  onRefresh
}: AdminVouchersProps) {
  const [search, setSearch] = useState("")
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingVoucher, setEditingVoucher] = useState<VoucherItem | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [form, setForm] = useState<VoucherFormData>({
    code: "",
    discount_type: "PERCENTAGE",
    discount_value: "10",
    min_order_amount: "0",
    max_discount_amount: "",
    usage_limit: "100",
    valid_until: "",
    is_active: true
  })

  const filteredVouchers = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return vouchers
    return vouchers.filter(v => v.code.toLowerCase().includes(q))
  }, [vouchers, search])

  const handleOpenAdd = () => {
    setEditingVoucher(null)
    setForm({
      code: "",
      discount_type: "PERCENTAGE",
      discount_value: "10",
      min_order_amount: "0",
      max_discount_amount: "",
      usage_limit: "100",
      valid_until: "",
      is_active: true
    })
    setIsModalOpen(true)
  }

  const handleOpenEdit = (v: VoucherItem) => {
    setEditingVoucher(v)
    setForm({
      code: v.code,
      discount_type: v.discount_type,
      discount_value: v.discount_value.toString(),
      min_order_amount: v.min_order_amount.toString(),
      max_discount_amount: v.max_discount_amount ? v.max_discount_amount.toString() : "",
      usage_limit: v.usage_limit ? v.usage_limit.toString() : "",
      valid_until: v.valid_until ? v.valid_until.substring(0, 10) : "",
      is_active: v.is_active
    })
    setIsModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.code.trim()) {
      toast.error("Voucher code is required")
      return
    }

    const payload = {
      code: form.code.trim().toUpperCase(),
      discount_type: form.discount_type,
      discount_value: parseFloat(form.discount_value) || 0,
      min_order_amount: parseFloat(form.min_order_amount) || 0,
      max_discount_amount: form.max_discount_amount ? parseFloat(form.max_discount_amount) : null,
      usage_limit: form.usage_limit ? parseInt(form.usage_limit, 10) : null,
      valid_until: form.valid_until ? new Date(form.valid_until).toISOString() : null,
      is_active: form.is_active
    }

    setIsSubmitting(true)
    try {
      if (editingVoucher) {
        await adminApi.updateVoucher(editingVoucher.id, payload)
        toast.success("Voucher updated successfully")
      } else {
        await adminApi.createVoucher(payload)
        toast.success("Voucher created successfully")
      }
      setIsModalOpen(false)
      await onRefresh()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error saving voucher"
      toast.error(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: string, code: string) => {
    if (!window.confirm(`Are you sure you want to delete voucher "${code}"?`)) return
    try {
      await adminApi.deleteVoucher(id)
      toast.success("Voucher deleted successfully")
      await onRefresh()
    } catch {
      toast.error("Failed to delete voucher")
    }
  }

  const handleToggleActive = async (v: VoucherItem) => {
    try {
      await adminApi.updateVoucher(v.id, { is_active: !v.is_active })
      toast.success(`Voucher ${!v.is_active ? "activated" : "deactivated"}`)
      await onRefresh()
    } catch {
      toast.error("Failed to update voucher status")
    }
  }

  return (
    <div className="space-y-6">
      {/* Top action bar */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
        <div className="relative w-full sm:w-80">
          <MagnifyingGlass
            size={18}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400"
          />
          <input
            type="text"
            placeholder="Search vouchers by code..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 rounded-xl text-sm placeholder-zinc-400 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-electric-blue/30 focus:border-electric-blue transition-all"
          />
        </div>

        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-2 px-4 py-2.5 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl text-sm font-semibold hover:bg-zinc-800 dark:hover:bg-zinc-200 active:scale-[0.98] transition-all shadow-xs"
        >
          <Plus size={18} weight="bold" />
          Add Voucher
        </button>
      </div>

      {/* Vouchers Table */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl overflow-hidden shadow-xs">
        {isFetching && vouchers.length === 0 ? (
          <div className="p-6 space-y-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-12 w-full rounded-xl" />
            ))}
          </div>
        ) : filteredVouchers.length === 0 ? (
          <div className="p-16 text-center text-zinc-400 dark:text-zinc-500">
            <Ticket size={36} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm font-medium">No vouchers found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-50/70 dark:bg-zinc-800/40 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider border-b border-zinc-100 dark:border-zinc-800">
                <tr>
                  <th className="py-3.5 px-5">Code</th>
                  <th className="py-3.5 px-5">Discount</th>
                  <th className="py-3.5 px-5">Min Order</th>
                  <th className="py-3.5 px-5">Usage</th>
                  <th className="py-3.5 px-5">Valid Until</th>
                  <th className="py-3.5 px-5">Status</th>
                  <th className="py-3.5 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/70 text-zinc-700 dark:text-zinc-300">
                {filteredVouchers.map(v => (
                  <tr key={v.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                    <td className="py-3.5 px-5 font-mono font-bold text-zinc-900 dark:text-zinc-50">
                      {v.code}
                    </td>
                    <td className="py-3.5 px-5">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200">
                        {v.discount_type === "PERCENTAGE" ? `${v.discount_value}% OFF` : `$${v.discount_value} OFF`}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-xs">
                      ${v.min_order_amount}
                    </td>
                    <td className="py-3.5 px-5 text-xs">
                      {v.times_used} / {v.usage_limit ?? "∞"}
                    </td>
                    <td className="py-3.5 px-5 text-xs text-zinc-500 dark:text-zinc-400">
                      {v.valid_until ? new Date(v.valid_until).toLocaleDateString() : "Never"}
                    </td>
                    <td className="py-3.5 px-5">
                      <button
                        onClick={() => handleToggleActive(v)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all active:scale-95 ${
                          v.is_active
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50"
                            : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700"
                        }`}
                      >
                        {v.is_active ? <CheckCircle size={14} weight="bold" /> : <Prohibit size={14} />}
                        {v.is_active ? "Active" : "Inactive"}
                      </button>
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(v)}
                          className="p-2 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors active:scale-95"
                          title="Edit voucher"
                        >
                          <PencilSimple size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(v.id, v.code)}
                          className="p-2 rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors active:scale-95"
                          title="Delete voucher"
                        >
                          <Trash size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Add / Edit Voucher */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
              className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl p-6 w-full max-w-lg shadow-xl"
            >
              <div className="flex justify-between items-center pb-4 border-b border-zinc-100 dark:border-zinc-800">
                <h3 className="font-bold text-lg text-zinc-900 dark:text-zinc-50">
                  {editingVoucher ? "Edit Voucher" : "Create Voucher"}
                </h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Code *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. SUMMER50"
                      value={form.code}
                      onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })}
                      className="w-full px-3.5 py-2 font-mono font-bold bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-electric-blue/30 focus:border-electric-blue transition-all uppercase"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Discount Type *
                    </label>
                    <select
                      value={form.discount_type}
                      onChange={e => setForm({ ...form, discount_type: e.target.value })}
                      className="w-full px-3.5 py-2 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-electric-blue/30 focus:border-electric-blue transition-all"
                    >
                      <option value="PERCENTAGE">Percentage (%)</option>
                      <option value="FIXED">Fixed Amount ($)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Discount Value *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={form.discount_value}
                      onChange={e => setForm({ ...form, discount_value: e.target.value })}
                      className="w-full px-3.5 py-2 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-electric-blue/30 focus:border-electric-blue transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Min Order Amount ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={form.min_order_amount}
                      onChange={e => setForm({ ...form, min_order_amount: e.target.value })}
                      className="w-full px-3.5 py-2 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-electric-blue/30 focus:border-electric-blue transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Max Discount ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Optional"
                      value={form.max_discount_amount}
                      onChange={e => setForm({ ...form, max_discount_amount: e.target.value })}
                      className="w-full px-3.5 py-2 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-electric-blue/30 focus:border-electric-blue transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Usage Limit
                    </label>
                    <input
                      type="number"
                      placeholder="e.g. 100"
                      value={form.usage_limit}
                      onChange={e => setForm({ ...form, usage_limit: e.target.value })}
                      className="w-full px-3.5 py-2 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-electric-blue/30 focus:border-electric-blue transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Valid Until (Expiry Date)
                  </label>
                  <input
                    type="date"
                    value={form.valid_until}
                    onChange={e => setForm({ ...form, valid_until: e.target.value })}
                    className="w-full px-3.5 py-2 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-electric-blue/30 focus:border-electric-blue transition-all"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={form.is_active}
                    onChange={e => setForm({ ...form, is_active: e.target.checked })}
                    className="w-4 h-4 text-electric-blue rounded border-zinc-300 dark:border-zinc-700 focus:ring-electric-blue"
                  />
                  <label htmlFor="is_active" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Voucher is active immediately
                  </label>
                </div>

                <div className="flex justify-end gap-2.5 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl text-sm font-semibold hover:bg-zinc-800 dark:hover:bg-zinc-200 active:scale-[0.98] transition-all disabled:opacity-50"
                  >
                    {isSubmitting ? "Saving..." : editingVoucher ? "Update Voucher" : "Create Voucher"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
