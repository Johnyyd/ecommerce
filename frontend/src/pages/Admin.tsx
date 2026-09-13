import { useEffect, useState, useCallback } from "react"
import { useLocation, Link } from "wouter"
import { motion, AnimatePresence } from "motion/react"
import {
  ChartLineUp,
  Package,
  Tag,
  Buildings,
  Ticket,
  ShoppingBag,
  Users,
  Database,
  ArrowLeft,
  ArrowClockwise,
  ShieldCheck,
  UserGear
} from "@phosphor-icons/react"
import { useAuthStore } from "@/store/useAuthStore"
import { adminApi } from "@/services/adminApi"
import {
  ProductItem,
  BrandItem,
  VoucherItem,
  OrderData,
  UserData,
  CategoryData,
  BackupFile,
  TabType
} from "@/types/admin"

// Domain sub-components
import { AdminOverview } from "./admin/AdminOverview"
import { AdminProducts } from "./admin/AdminProducts"
import { AdminCategories } from "./admin/AdminCategories"
import { AdminBrands } from "./admin/AdminBrands"
import { AdminVouchers } from "./admin/AdminVouchers"
import { AdminOrders } from "./admin/AdminOrders"
import { AdminUsers } from "./admin/AdminUsers"
import { AdminBackups } from "./admin/AdminBackups"

export function Admin() {
  const { user, isLoading } = useAuthStore()
  const [, setLocation] = useLocation()

  // Navigation State
  const [activeTab, setActiveTab] = useState<TabType>("overview")

  // Data States
  const [products, setProducts] = useState<ProductItem[]>([])
  const [brands, setBrands] = useState<BrandItem[]>([])
  const [vouchers, setVouchers] = useState<VoucherItem[]>([])
  const [orders, setOrders] = useState<OrderData[]>([])
  const [users, setUsers] = useState<UserData[]>([])
  const [categories, setCategories] = useState<CategoryData[]>([])
  const [backups, setBackups] = useState<BackupFile[]>([])

  const [isFetching, setIsFetching] = useState(false)

  const isAdmin = user?.role === "admin"

  // Route Guard: Allow either Admin or Manager
  useEffect(() => {
    if (!isLoading && (!user || (user.role !== "admin" && user.role !== "manager"))) {
      setLocation("/login")
    }
  }, [user, isLoading, setLocation])

  // Fetch all domain resources
  const fetchAllData = useCallback(async () => {
    setIsFetching(true)
    try {
      const [
        prodsRes,
        brandsRes,
        vouchersRes,
        ordersRes,
        usersRes,
        catsRes,
        backupsRes
      ] = await Promise.allSettled([
        adminApi.getProducts(),
        adminApi.getBrands(),
        adminApi.getVouchers(),
        adminApi.getOrders(),
        adminApi.getUsers(),
        adminApi.getCategories(),
        adminApi.getBackups()
      ])

      if (prodsRes.status === "fulfilled") setProducts(prodsRes.value)
      if (brandsRes.status === "fulfilled") setBrands(brandsRes.value)
      if (vouchersRes.status === "fulfilled") setVouchers(vouchersRes.value)
      if (ordersRes.status === "fulfilled") setOrders(ordersRes.value)
      if (usersRes.status === "fulfilled") setUsers(usersRes.value)
      if (catsRes.status === "fulfilled") setCategories(catsRes.value)
      if (backupsRes.status === "fulfilled") setBackups(backupsRes.value)
    } finally {
      setIsFetching(false)
    }
  }, [])

  useEffect(() => {
    if (user && (user.role === "admin" || user.role === "manager")) {
      fetchAllData()
    }
  }, [user, fetchAllData])

  const tabs: { id: TabType; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: "overview", label: "Overview", icon: <ChartLineUp size={16} weight="bold" /> },
    { id: "products", label: "Products", icon: <Package size={16} weight="bold" />, badge: products.length },
    { id: "categories", label: "Categories", icon: <Tag size={16} weight="bold" />, badge: categories.length },
    { id: "brands", label: "Brands", icon: <Buildings size={16} weight="bold" />, badge: brands.length },
    { id: "vouchers", label: "Vouchers", icon: <Ticket size={16} weight="bold" />, badge: vouchers.length },
    {
      id: "orders",
      label: "Orders",
      icon: <ShoppingBag size={16} weight="bold" />,
      badge: orders.filter(o => o.status === "PENDING").length || orders.length
    },
    { id: "users", label: "Users", icon: <Users size={16} weight="bold" />, badge: users.length },
    { id: "backups", label: "Backups", icon: <Database size={16} weight="bold" /> }
  ]

  return (
    <div className="min-h-screen bg-zinc-50/50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 transition-colors">
      {/* Header Bar */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border-b border-zinc-200/80 dark:border-zinc-800/80 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            {/* Store title & breadcrumb */}
            <div className="flex items-center gap-3">
              <Link
                to="/"
                className="w-9 h-9 rounded-2xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 flex items-center justify-center text-zinc-600 dark:text-zinc-300 active:scale-[0.96] transition-all"
                title="Return to Store"
              >
                <ArrowLeft size={16} weight="bold" />
              </Link>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="font-bold text-lg text-zinc-900 dark:text-zinc-50 tracking-tight">
                    Operations Portal
                  </h1>
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                      isAdmin
                        ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20"
                        : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
                    }`}
                  >
                    {isAdmin ? (
                      <ShieldCheck size={12} weight="bold" />
                    ) : (
                      <UserGear size={12} weight="bold" />
                    )}
                    {user?.role}
                  </span>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Signed in as <strong className="text-zinc-800 dark:text-zinc-200 font-medium">{user?.username}</strong>
                </p>
              </div>
            </div>

            {/* Refresh Action */}
            <div className="flex items-center gap-2">
              <button
                onClick={fetchAllData}
                disabled={isFetching}
                className="inline-flex items-center gap-2 px-3.5 py-2 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700/80 border border-zinc-200/80 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 rounded-2xl text-xs font-semibold active:scale-[0.98] transition-all cursor-pointer shadow-xs disabled:opacity-50"
              >
                <ArrowClockwise
                  size={14}
                  weight="bold"
                  className={isFetching ? "animate-spin" : ""}
                />
                <span>{isFetching ? "Syncing..." : "Sync Data"}</span>
              </button>
            </div>
          </div>

          {/* Segmented Tab Navigation */}
          <nav
            aria-label="Admin navigation"
            className="mt-4 flex gap-1 p-1.5 bg-zinc-100 dark:bg-zinc-800/80 rounded-2xl border border-zinc-200/60 dark:border-zinc-700/60 overflow-x-auto scrollbar-none"
          >
            {tabs.map(tab => {
              const isSelected = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  data-testid={`tab-${tab.id}`}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                    isSelected
                      ? "text-zinc-900 dark:text-white"
                      : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
                  }`}
                >
                  {isSelected && (
                    <motion.div
                      layoutId="adminTabIndicator"
                      className="absolute inset-0 bg-white dark:bg-zinc-700 rounded-xl shadow-xs"
                      transition={{ type: "spring", stiffness: 450, damping: 35 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-1.5">
                    {tab.icon}
                    {tab.label}
                    {tab.badge !== undefined && tab.badge > 0 && (
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                          isSelected
                            ? "bg-zinc-100 dark:bg-zinc-600 text-zinc-800 dark:text-zinc-100"
                            : "bg-zinc-200/70 dark:bg-zinc-700/60 text-zinc-500 dark:text-zinc-400"
                        }`}
                      >
                        {tab.badge}
                      </span>
                    )}
                  </span>
                </button>
              )
            })}
          </nav>
        </div>
      </header>

      {/* Main Content Area with Page Transition */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            {activeTab === "overview" && (
              <AdminOverview
                products={products}
                orders={orders}
                users={users}
                isFetching={isFetching}
                onNavigateTab={setActiveTab}
              />
            )}
            {activeTab === "products" && (
              <AdminProducts
                products={products}
                categories={categories}
                isFetching={isFetching}
                onRefresh={fetchAllData}
              />
            )}
            {activeTab === "categories" && (
              <AdminCategories
                categories={categories}
                isFetching={isFetching}
                onRefresh={fetchAllData}
              />
            )}
            {activeTab === "brands" && (
              <AdminBrands
                brands={brands}
                isFetching={isFetching}
                onRefresh={fetchAllData}
              />
            )}
            {activeTab === "vouchers" && (
              <AdminVouchers
                vouchers={vouchers}
                isFetching={isFetching}
                onRefresh={fetchAllData}
              />
            )}
            {activeTab === "orders" && (
              <AdminOrders
                orders={orders}
                isFetching={isFetching}
                onRefresh={fetchAllData}
              />
            )}
            {activeTab === "users" && (
              <AdminUsers
                users={users}
                isFetching={isFetching}
                currentUserRole={user?.role}
                onRefresh={fetchAllData}
              />
            )}
            {activeTab === "backups" && (
              <AdminBackups
                backups={backups}
                isFetching={isFetching}
                currentUserRole={user?.role}
                onRefresh={fetchAllData}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  )
}
