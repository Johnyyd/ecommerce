import { useState, useMemo } from "react"
import { motion, AnimatePresence } from "motion/react"
import { ShoppingBag, Eye, X, CaretDown, CheckCircle, Clock, Truck, XCircle, Package, ArrowClockwise } from "@phosphor-icons/react"
import { toast } from "sonner"
import { OrderData } from "@/types/admin"
import { adminApi } from "@/services/adminApi"
import { Skeleton } from "@/components/ui/Skeleton"
import { OrderTrackingTimeline } from "@/components/shipping/OrderTrackingTimeline"
import { shippingApi } from "@/services/shippingApi"
import { ShippingTimelineResponse } from "@/types/shipping"
import { getAuthToken } from "@/lib/auth"

interface AdminOrdersProps {
  orders: OrderData[]
  isFetching: boolean
  onRefresh: () => Promise<void>
}

const STATUS_OPTIONS = ["ALL", "PENDING", "PROCESSING", "SHIPPED", "COMPLETED", "CANCELLED"] as const
type StatusFilter = typeof STATUS_OPTIONS[number]

export function AdminOrders({ orders, isFetching, onRefresh }: AdminOrdersProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL")
  const [selectedOrder, setSelectedOrder] = useState<OrderData | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [fulfillingId, setFulfillingId] = useState<string | null>(null)
  const [trackingData, setTrackingData] = useState<ShippingTimelineResponse | null>(null)
  const [isTrackingModalOpen, setIsTrackingModalOpen] = useState(false)
  const [loadingTracking, setLoadingTracking] = useState(false)

  const handleFulfillShipping = async (orderId: string) => {
    const token = getAuthToken()
    if (!token) return
    setFulfillingId(orderId)
    try {
      const res = await shippingApi.fulfillOrder(orderId, token)
      toast.success(`GHN Shipment created! Tracking Code: ${res.tracking_code}`)
      await onRefresh()
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder({ ...selectedOrder, ...res })
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create GHN shipment"
      toast.error(msg)
    } finally {
      setFulfillingId(null)
    }
  }

  const handleOpenTracking = async (order: OrderData) => {
    const token = getAuthToken()
    setLoadingTracking(true)
    setIsTrackingModalOpen(true)
    try {
      if (order.tracking_code) {
        const res = await shippingApi.getTrackingByCode(order.tracking_code)
        setTrackingData(res)
      } else if (token) {
        const res = await shippingApi.getOrderTracking(order.id, token)
        setTrackingData(res)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load tracking data"
      toast.error(msg)
    } finally {
      setLoadingTracking(false)
    }
  }

  const filteredOrders = useMemo(() => {
    if (statusFilter === "ALL") return orders
    return orders.filter(o => o.status === statusFilter)
  }, [orders, statusFilter])

  const handleUpdateStatus = async (orderId: string, newStatus: string) => {
    setUpdatingId(orderId)
    try {
      await adminApi.updateOrderStatus(orderId, newStatus)
      toast.success(`Order #${orderId.substring(0, 8)} status changed to ${newStatus}`)
      await onRefresh()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update order status"
      toast.error(msg)
    } finally {
      setUpdatingId(null)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
      case "PROCESSING":
        return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
      case "SHIPPED":
        return "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20"
      case "CANCELLED":
        return "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
      case "PENDING":
      default:
        return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return <CheckCircle size={14} weight="bold" />
      case "PROCESSING":
        return <Package size={14} weight="bold" />
      case "SHIPPED":
        return <Truck size={14} weight="bold" />
      case "CANCELLED":
        return <XCircle size={14} weight="bold" />
      case "PENDING":
      default:
        return <Clock size={14} weight="bold" />
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Header & Filter Pills */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-lg text-zinc-900 dark:text-zinc-50">Order Management</h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Track fulfillment and manage real-time order lifecycle ({orders.length} total)
          </p>
        </div>

        {/* Status Pills */}
        <div className="flex items-center gap-1.5 p-1 bg-zinc-100 dark:bg-zinc-800/80 rounded-2xl border border-zinc-200/50 dark:border-zinc-700/50 overflow-x-auto">
          {STATUS_OPTIONS.map(st => {
            const count = st === "ALL" ? orders.length : orders.filter(o => o.status === st).length
            const isSelected = statusFilter === st
            return (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`relative px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  isSelected
                    ? "text-zinc-900 dark:text-white"
                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
                }`}
              >
                {isSelected && (
                  <motion.div
                    layoutId="orderFilterPill"
                    className="absolute inset-0 bg-white dark:bg-zinc-700 rounded-xl shadow-xs"
                    transition={{ type: "spring", stiffness: 450, damping: 35 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-1.5">
                  {st}
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    isSelected
                      ? "bg-zinc-100 dark:bg-zinc-600 text-zinc-800 dark:text-zinc-100"
                      : "bg-zinc-200/70 dark:bg-zinc-700/60 text-zinc-500 dark:text-zinc-400"
                  }`}>
                    {count}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 rounded-3xl overflow-hidden shadow-xs">
        {isFetching && orders.length === 0 ? (
          <div className="p-6 space-y-4">
            {[1, 2, 3, 4, 5].map(i => (
              <Skeleton key={i} className="h-14 w-full rounded-xl" />
            ))}
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="p-16 text-center text-zinc-400 dark:text-zinc-500">
            <ShoppingBag size={40} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm font-medium">No orders found in this status</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50/75 dark:bg-zinc-800/50 text-zinc-500 dark:text-zinc-400 border-b border-zinc-200/60 dark:border-zinc-800 font-medium">
                <tr>
                  <th className="px-6 py-4">Order ID</th>
                  <th className="px-6 py-4">Customer</th>
                  <th className="px-6 py-4">Amount</th>
                  <th className="px-6 py-4">Payment</th>
                  <th className="px-6 py-4">Fulfillment Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                {filteredOrders.map(o => (
                  <tr key={o.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                    {/* Order ID */}
                    <td className="px-6 py-4 font-mono font-medium text-zinc-900 dark:text-zinc-100">
                      #{o.id.substring(0, 8)}
                      {o.tracking_code && (
                        <div className="mt-1 flex items-center gap-1 text-[11px] font-mono text-orange-600 dark:text-orange-400 font-semibold">
                          <Truck size={12} weight="bold" />
                          <span>GHN: {o.tracking_code}</span>
                        </div>
                      )}
                    </td>

                    {/* Customer */}
                    <td className="px-6 py-4 text-zinc-500 dark:text-zinc-400 font-mono text-[11px]">
                      {o.user_id ? `${o.user_id.substring(0, 8)}...` : "Guest"}
                    </td>

                    {/* Total Amount */}
                    <td className="px-6 py-4 font-bold text-zinc-900 dark:text-zinc-50">
                      ${Number(o.total_amount).toFixed(2)}
                    </td>

                    {/* Payment */}
                    <td className="px-6 py-4">
                      <span className="font-medium text-zinc-700 dark:text-zinc-300 block capitalize">
                        {o.payment_method?.toLowerCase() || "standard"}
                      </span>
                      <span
                        className={`text-[10px] uppercase font-bold tracking-wider inline-block mt-0.5 ${
                          o.payment?.status === "SUCCESS"
                            ? "text-emerald-600 dark:text-emerald-400"
                            : o.payment?.status === "REFUNDED"
                            ? "text-rose-500 dark:text-rose-400"
                            : "text-amber-500 dark:text-amber-400"
                        }`}
                      >
                        {o.payment?.status || "UNPAID"}
                      </span>
                    </td>

                    {/* Status Changer */}
                    <td className="px-6 py-4">
                      <div className="relative inline-block">
                        <select
                          value={o.status}
                          disabled={updatingId === o.id}
                          onChange={e => handleUpdateStatus(o.id, e.target.value)}
                          className={`appearance-none text-xs rounded-xl pl-3 pr-7 py-1.5 font-semibold border cursor-pointer focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-zinc-100/10 transition-all ${getStatusBadge(
                            o.status
                          )}`}
                        >
                          <option value="PENDING">PENDING</option>
                          <option value="PROCESSING">PROCESSING</option>
                          <option value="SHIPPED">SHIPPED</option>
                          <option value="COMPLETED">COMPLETED</option>
                          <option value="CANCELLED">CANCELLED</option>
                        </select>
                        <CaretDown
                          size={12}
                          weight="bold"
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-60"
                        />
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Ship GHN button for PENDING or PROCESSING orders without tracking */}
                        {!o.tracking_code && ["PENDING", "PROCESSING"].includes(o.status) && (
                          <button
                            onClick={() => handleFulfillShipping(o.id)}
                            disabled={fulfillingId === o.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl text-xs active:scale-[0.97] transition-all cursor-pointer disabled:opacity-50 shadow-sm"
                            title="Create GHN shipment"
                          >
                            {fulfillingId === o.id ? (
                              <ArrowClockwise size={13} className="animate-spin" />
                            ) : (
                              <Truck size={13} weight="bold" />
                            )}
                            Ship GHN
                          </button>
                        )}

                        {/* Track GHN button */}
                        {(o.tracking_code || ["SHIPPED", "COMPLETED"].includes(o.status)) && (
                          <button
                            onClick={() => handleOpenTracking(o)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 dark:bg-orange-950/30 hover:bg-orange-100 dark:hover:bg-orange-900/50 text-orange-700 dark:text-orange-300 font-semibold rounded-xl text-xs active:scale-[0.97] transition-all cursor-pointer border border-orange-200/60 dark:border-orange-800/40 shadow-sm"
                          >
                            <Truck size={13} weight="bold" />
                            Track
                          </button>
                        )}

                        <button
                          onClick={() => setSelectedOrder(o)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-semibold rounded-xl text-xs active:scale-[0.97] transition-all cursor-pointer"
                        >
                          <Eye size={14} />
                          Items ({o.items?.length || 0})
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

      {/* Order Items Modal */}
      <AnimatePresence>
        {selectedOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedOrder(null)}
              className="absolute inset-0 bg-zinc-900/40 dark:bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="relative bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 shadow-2xl max-w-lg w-full p-6 sm:p-8 z-10"
            >
              {/* Modal Header */}
              <div className="flex justify-between items-start mb-6">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">Order Details</h3>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 ${getStatusBadge(selectedOrder.status)}`}>
                      {getStatusIcon(selectedOrder.status)}
                      {selectedOrder.status}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 font-mono mt-0.5">#{selectedOrder.id}</p>
                </div>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Items List */}
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800 max-h-72 overflow-y-auto mb-6 pr-1">
                {selectedOrder.items?.map(item => (
                  <div key={item.id} className="py-3.5 flex justify-between items-center text-xs">
                    <div>
                      <span className="font-mono font-medium text-zinc-800 dark:text-zinc-200 block">
                        Item: {item.product_id ? `${item.product_id.substring(0, 12)}...` : "Standard SKU"}
                      </span>
                      <span className="text-zinc-400 dark:text-zinc-500 text-[11px]">Qty: {item.quantity} × ${Number(item.unit_price).toFixed(2)}</span>
                    </div>
                    <span className="font-bold text-zinc-900 dark:text-zinc-100">
                      ${(Number(item.unit_price) * item.quantity).toFixed(2)}
                    </span>
                  </div>
                ))}
                {(!selectedOrder.items || selectedOrder.items.length === 0) && (
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 py-6 text-center">No items listed for this order.</p>
                )}
              </div>

              {/* GHN Shipping section in Modal */}
              <div className="p-4 mb-6 rounded-2xl bg-orange-50/60 dark:bg-orange-950/20 border border-orange-200/80 dark:border-orange-900/40">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Truck size={18} className="text-orange-600" weight="bold" />
                    <span className="text-xs font-bold text-orange-950 dark:text-orange-200">
                      GHN Express Logistics
                    </span>
                  </div>
                  {selectedOrder.tracking_code ? (
                    <button
                      onClick={() => handleOpenTracking(selectedOrder)}
                      className="text-[11px] font-semibold text-orange-700 dark:text-orange-300 hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <span>Live Timeline</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleFulfillShipping(selectedOrder.id)}
                      disabled={fulfillingId === selectedOrder.id}
                      className="text-[11px] font-bold text-white bg-orange-600 hover:bg-orange-700 px-3 py-1 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {fulfillingId === selectedOrder.id ? "Creating..." : "Create GHN Waybill"}
                    </button>
                  )}
                </div>
                <div className="text-xs text-zinc-600 dark:text-zinc-300 flex justify-between">
                  <span>Tracking Code:</span>
                  <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">
                    {selectedOrder.tracking_code || "Not generated yet"}
                  </span>
                </div>
              </div>

              {/* Summary Footer */}
              <div className="border-t border-zinc-100 dark:border-zinc-800 pt-4 flex justify-between items-center">
                <div>
                  <span className="text-xs text-zinc-400 dark:text-zinc-500 block">Payment Method</span>
                  <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 uppercase">{selectedOrder.payment_method || "N/A"}</span>
                </div>
                <div className="text-right">
                  <span className="text-xs text-zinc-400 dark:text-zinc-500 block">Total Due</span>
                  <span className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
                    ${Number(selectedOrder.total_amount).toFixed(2)}
                  </span>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Reusable GHN Order Tracking Timeline Modal */}
      <OrderTrackingTimeline
        isOpen={isTrackingModalOpen}
        onClose={() => setIsTrackingModalOpen(false)}
        data={trackingData}
        isLoading={loadingTracking}
      />
    </div>
  )
}
