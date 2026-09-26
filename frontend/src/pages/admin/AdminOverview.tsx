import { useMemo } from "react"
import { motion } from "motion/react"
import {
  CurrencyDollar,
  ShoppingBag,
  WarningCircle,
  Users,
  ArrowRight,
  Plus,
  Receipt,
  Ticket,
  Lightning
} from "@phosphor-icons/react"
import { OrderData, ProductItem, UserData, TabType } from "@/types/admin"
import { Skeleton } from "@/components/ui/Skeleton"

interface AdminOverviewProps {
  orders: OrderData[]
  products: ProductItem[]
  users: UserData[]
  isFetching: boolean
  onNavigateTab: (tab: TabType, options?: { filter?: "all" | "low_stock" }) => void
}

export function AdminOverview({
  orders,
  products,
  users,
  isFetching,
  onNavigateTab
}: AdminOverviewProps) {
  const stats = useMemo(() => {
    const totalRev = orders
      .filter(o => o.status !== "CANCELLED")
      .reduce((sum, o) => sum + Number(o.total_amount || 0), 0)
    const pendingOrders = orders.filter(o => o.status === "PENDING").length
    const lowStock = products.filter(p => (p.stock_quantity ?? 0) <= 5).length
    const totalCustomers = users.filter(u => u.role === "customer").length
    return { totalRev, totalOrders: orders.length, pendingOrders, lowStock, totalCustomers }
  }, [orders, products, users])

  const recentOrders = useMemo(() => {
    return [...orders].slice(0, 5)
  }, [orders])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "DELIVERED":
        return "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50"
      case "SHIPPED":
        return "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400 border-blue-200 dark:border-blue-800/50"
      case "PROCESSING":
        return "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 border-amber-200 dark:border-amber-800/50"
      case "PENDING":
        return "bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-400 border-purple-200 dark:border-purple-800/50"
      case "CANCELLED":
        return "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400 border-rose-200 dark:border-rose-800/50"
      default:
        return "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700"
    }
  }

  if (isFetching && orders.length === 0 && products.length === 0) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-32 w-full rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-80 w-full rounded-2xl" />
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
      className="space-y-6"
    >
      {/* 4 KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Revenue */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl p-5 shadow-xs transition-all hover:border-zinc-300 dark:hover:border-zinc-700">
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Revenue</span>
            <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <CurrencyDollar size={18} weight="bold" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            ${stats.totalRev.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            From {stats.totalOrders} total recorded orders
          </div>
        </div>

        {/* Orders */}
        <div
          data-testid="overview-orders-card"
          role="button"
          tabIndex={0}
          onClick={() => onNavigateTab("orders")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault()
              onNavigateTab("orders")
            }
          }}
          className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl p-5 shadow-xs transition-all hover:border-blue-400 dark:hover:border-blue-600/80 hover:shadow-md cursor-pointer active:scale-[0.98] group"
        >
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
            <span className="text-xs font-semibold uppercase tracking-wider group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              Total Orders
            </span>
            <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
              <ShoppingBag size={18} weight="bold" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-baseline justify-between">
            <span>{stats.totalOrders}</span>
            <span className="text-xs font-medium text-blue-600 dark:text-blue-400 flex items-center gap-1 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all">
              View orders <ArrowRight size={12} weight="bold" />
            </span>
          </div>
          <div className="mt-1 text-xs text-amber-600 dark:text-amber-400 font-medium">
            {stats.pendingOrders} pending verification
          </div>
        </div>

        {/* Low Stock */}
        <div
          data-testid="overview-low-stock-card"
          role="button"
          tabIndex={0}
          onClick={() => onNavigateTab("products", { filter: "low_stock" })}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault()
              onNavigateTab("products", { filter: "low_stock" })
            }
          }}
          className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl p-5 shadow-xs transition-all hover:border-amber-400 dark:hover:border-amber-600/80 hover:shadow-md cursor-pointer active:scale-[0.98] group"
        >
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
            <span className="text-xs font-semibold uppercase tracking-wider group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
              Low Stock Items
            </span>
            <div className="w-8 h-8 rounded-full bg-amber-50 dark:bg-amber-950/50 flex items-center justify-center text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform">
              <WarningCircle size={18} weight="bold" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-baseline justify-between">
            <span>{stats.lowStock}</span>
            <span className="text-xs font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1 opacity-80 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all">
              Filter products <ArrowRight size={12} weight="bold" />
            </span>
          </div>
          <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Total {products.length} products cataloged
          </div>
        </div>

        {/* Customers */}
        <div
          data-testid="overview-customers-card"
          role="button"
          tabIndex={0}
          onClick={() => onNavigateTab("users")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault()
              onNavigateTab("users")
            }
          }}
          className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl p-5 shadow-xs transition-all hover:border-purple-400 dark:hover:border-purple-600/80 hover:shadow-md cursor-pointer active:scale-[0.98] group"
        >
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
            <span className="text-xs font-semibold uppercase tracking-wider group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
              Customers
            </span>
            <div className="w-8 h-8 rounded-full bg-purple-50 dark:bg-purple-950/50 flex items-center justify-center text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform">
              <Users size={18} weight="bold" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-baseline justify-between">
            <span>{stats.totalCustomers}</span>
            <span className="text-xs font-medium text-purple-600 dark:text-purple-400 flex items-center gap-1 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all">
              View users <ArrowRight size={12} weight="bold" />
            </span>
          </div>
          <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Registered customer accounts
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          onClick={() => onNavigateTab("products")}
          className="flex items-center justify-between p-4 bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl text-left hover:border-zinc-300 dark:hover:border-zinc-700 transition-all active:scale-[0.98] group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-900 dark:text-zinc-100">
              <Plus size={20} weight="bold" />
            </div>
            <div>
              <div className="font-semibold text-sm text-zinc-900 dark:text-zinc-50">Manage Products</div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">Add or edit catalog inventory</div>
            </div>
          </div>
          <ArrowRight size={18} className="text-zinc-400 group-hover:translate-x-0.5 transition-transform" />
        </button>

        <button
          onClick={() => onNavigateTab("orders")}
          className="flex items-center justify-between p-4 bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl text-left hover:border-zinc-300 dark:hover:border-zinc-700 transition-all active:scale-[0.98] group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-900 dark:text-zinc-100">
              <Receipt size={20} weight="bold" />
            </div>
            <div>
              <div className="font-semibold text-sm text-zinc-900 dark:text-zinc-50">Review Orders</div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">Process shipping & deliveries</div>
            </div>
          </div>
          <ArrowRight size={18} className="text-zinc-400 group-hover:translate-x-0.5 transition-transform" />
        </button>

        <button
          onClick={() => onNavigateTab("vouchers")}
          className="flex items-center justify-between p-4 bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl text-left hover:border-zinc-300 dark:hover:border-zinc-700 transition-all active:scale-[0.98] group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-900 dark:text-zinc-100">
              <Ticket size={20} weight="bold" />
            </div>
            <div>
              <div className="font-semibold text-sm text-zinc-900 dark:text-zinc-50">Discount Vouchers</div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">Create promotional codes</div>
            </div>
          </div>
          <ArrowRight size={18} className="text-zinc-400 group-hover:translate-x-0.5 transition-transform" />
        </button>

        <button
          onClick={() => onNavigateTab("async_jobs")}
          className="flex items-center justify-between p-4 bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl text-left hover:border-zinc-300 dark:hover:border-zinc-700 transition-all active:scale-[0.98] group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Lightning size={20} weight="bold" />
            </div>
            <div>
              <div className="font-semibold text-sm text-zinc-900 dark:text-zinc-50">Async Jobs & Queue</div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">Worker & Email outbox</div>
            </div>
          </div>
          <ArrowRight size={18} className="text-zinc-400 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>

      {/* Recent Orders Table */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl overflow-hidden shadow-xs">
        <div className="p-5 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
          <div>
            <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-50">Recent Orders</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Latest customer transactions</p>
          </div>
          <button
            onClick={() => onNavigateTab("orders")}
            className="text-xs font-semibold text-electric-blue hover:underline flex items-center gap-1 active:scale-95 transition-transform"
          >
            View all orders <ArrowRight size={14} />
          </button>
        </div>

        {recentOrders.length === 0 ? (
          <div className="p-12 text-center text-zinc-500 dark:text-zinc-400 text-sm">
            No orders found yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-50/70 dark:bg-zinc-800/40 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider border-b border-zinc-100 dark:border-zinc-800">
                <tr>
                  <th className="py-3 px-5">Order ID</th>
                  <th className="py-3 px-5">Date</th>
                  <th className="py-3 px-5">Items</th>
                  <th className="py-3 px-5">Total</th>
                  <th className="py-3 px-5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/70 text-zinc-700 dark:text-zinc-300">
                {recentOrders.map(order => (
                  <tr key={order.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                    <td className="py-3.5 px-5 font-mono text-xs font-medium text-zinc-900 dark:text-zinc-100">
                      {order.id.slice(0, 8)}...
                    </td>
                    <td className="py-3.5 px-5 text-xs text-zinc-500 dark:text-zinc-400">
                      {order.created_at ? new Date(order.created_at).toLocaleDateString() : "—"}
                    </td>
                    <td className="py-3.5 px-5 text-xs">
                      {order.items?.length || 0} items
                    </td>
                    <td className="py-3.5 px-5 font-medium text-zinc-900 dark:text-zinc-50">
                      ${Number(order.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3.5 px-5">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusBadge(order.status)}`}>
                        {order.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </motion.div>
  )
}
