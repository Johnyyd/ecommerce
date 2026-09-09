import { useEffect, useState, useMemo } from "react"
import { useLocation, Link } from "wouter"
import { useAuthStore } from "@/store/useAuthStore"
import { toast } from "sonner"

// --- Types ---
interface ProductItem {
  id: string
  name: string
  description?: string | null
  price: number
  stock_quantity: number
  category_id?: string | null
  brand?: string | null
  rating?: number
  image_url?: string | null
}

interface OrderItemDetail {
  id: string
  product_id: string
  quantity: number
  unit_price: number
}

interface OrderPayment {
  id: string
  status: string
  provider: string
  transaction_id?: string | null
}

interface OrderData {
  id: string
  user_id: string
  address_id: string
  total_amount: number
  status: string
  payment_method: string
  items: OrderItemDetail[]
  payment?: OrderPayment | null
  created_at?: string
}

interface UserData {
  id: string
  username: string
  email: string
  role: string
  is_active: boolean
  created_at: string
}

interface CategoryData {
  id: string
  name: string
  slug: string
}

interface ProductFormData {
  name: string
  description: string
  price: string
  stock_quantity: string
  brand: string
  image_url: string
}

const initialProductForm: ProductFormData = {
  name: "",
  description: "",
  price: "",
  stock_quantity: "0",
  brand: "",
  image_url: ""
}

type TabType = "overview" | "products" | "orders" | "users" | "categories"

export function Admin() {
  const { user, isLoading } = useAuthStore()
  const [, setLocation] = useLocation()
  
  // Navigation
  const [activeTab, setActiveTab] = useState<TabType>("overview")

  // Data States
  const [products, setProducts] = useState<ProductItem[]>([])
  const [orders, setOrders] = useState<OrderData[]>([])
  const [users, setUsers] = useState<UserData[]>([])
  const [categories, setCategories] = useState<CategoryData[]>([])
  
  // Loading & Filter states
  const [isFetching, setIsFetching] = useState(false)
  const [productSearch, setProductSearch] = useState("")
  const [userSearch, setUserSearch] = useState("")
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>("ALL")

  // Modals
  const [isProductModalOpen, setIsProductModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null)
  const [productForm, setProductForm] = useState<ProductFormData>(initialProductForm)
  const [isProductSubmitting, setIsProductSubmitting] = useState(false)

  const [selectedOrderForDetail, setSelectedOrderForDetail] = useState<OrderData | null>(null)

  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false)
  const [categoryName, setCategoryName] = useState("")
  const [categorySlug, setCategorySlug] = useState("")
  const [isCategorySubmitting, setIsCategorySubmitting] = useState(false)

  const token = typeof window !== "undefined" 
    ? (localStorage.getItem("access_token") || localStorage.getItem("token")) 
    : null

  // Route Guard
  useEffect(() => {
    if (!isLoading && (!user || user.role !== "admin")) {
      setLocation("/login")
    }
  }, [user, isLoading, setLocation])

  // Initial Fetch
  useEffect(() => {
    if (user && user.role === "admin") {
      fetchAllData()
    }
  }, [user])

  const fetchAllData = async () => {
    if (!token) return
    setIsFetching(true)
    try {
      await Promise.all([
        fetchProducts(),
        fetchOrders(),
        fetchUsers(),
        fetchCategories()
      ])
    } catch (e) {
      console.error("Error loading admin data:", e)
    } finally {
      setIsFetching(false)
    }
  }

  const fetchProducts = async () => {
    try {
      const res = await fetch("/api/v1/products/?limit=100")
      if (res.ok) {
        const data = await res.json()
        setProducts(Array.isArray(data) ? data : (data.items || []))
      }
    } catch (e) {
      console.error("Error fetching products:", e)
    }
  }

  const fetchOrders = async () => {
    if (!token) return
    try {
      const res = await fetch("/api/v1/orders/admin?limit=100", {
        headers: { "Authorization": `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setOrders(Array.isArray(data) ? data : [])
      }
    } catch (e) {
      console.error("Error fetching orders:", e)
    }
  }

  const fetchUsers = async () => {
    if (!token) return
    try {
      const res = await fetch("/api/v1/users/?limit=100", {
        headers: { "Authorization": `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setUsers(Array.isArray(data) ? data : [])
      }
    } catch (e) {
      console.error("Error fetching users:", e)
    }
  }

  const fetchCategories = async () => {
    try {
      const res = await fetch("/api/v1/categories/")
      if (res.ok) {
        const data = await res.json()
        setCategories(Array.isArray(data) ? data : [])
      }
    } catch (e) {
      console.error("Error fetching categories:", e)
    }
  }

  // --- Product Actions ---
  const handleOpenAddProduct = () => {
    setEditingProduct(null)
    setProductForm(initialProductForm)
    setIsProductModalOpen(true)
  }

  const handleOpenEditProduct = (prod: ProductItem) => {
    setEditingProduct(prod)
    setProductForm({
      name: prod.name,
      description: prod.description || "",
      price: prod.price.toString(),
      stock_quantity: (prod.stock_quantity ?? 0).toString(),
      brand: prod.brand || "",
      image_url: prod.image_url || ""
    })
    setIsProductModalOpen(true)
  }

  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) return
    const payload = {
      name: productForm.name.trim(),
      description: productForm.description.trim() || null,
      price: parseFloat(productForm.price) || 0,
      stock_quantity: parseInt(productForm.stock_quantity, 10) || 0,
      brand: productForm.brand.trim() || null,
      image_url: productForm.image_url.trim() || null
    }

    setIsProductSubmitting(true)
    try {
      if (editingProduct) {
        const res = await fetch(`/api/v1/products/${editingProduct.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        })
        if (!res.ok) throw new Error("Failed to update product")
        toast.success("Product updated successfully")
      } else {
        const res = await fetch("/api/v1/products/", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        })
        if (!res.ok) throw new Error("Failed to create product")
        toast.success("Product created successfully")
      }
      setIsProductModalOpen(false)
      await fetchProducts()
    } catch (err: any) {
      toast.error(err.message || "Error saving product")
    } finally {
      setIsProductSubmitting(false)
    }
  }

  const handleDeleteProduct = async (id: string, name: string) => {
    if (!token || !window.confirm(`Delete product "${name}"?`)) return
    try {
      const res = await fetch(`/api/v1/products/${id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      })
      if (res.ok || res.status === 204) {
        toast.success("Product deleted")
        setProducts(prev => prev.filter(p => p.id !== id))
      } else {
        toast.error("Failed to delete product")
      }
    } catch {
      toast.error("Network error deleting product")
    }
  }

  // --- Order Actions ---
  const handleUpdateOrderStatus = async (orderId: string, newStatus: string) => {
    if (!token) return
    try {
      const res = await fetch(`/api/v1/orders/${orderId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      })
      if (res.ok) {
        const updated = await res.json()
        toast.success(`Order updated to ${newStatus}`)
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: updated.status, payment: updated.payment } : o))
      } else {
        toast.error("Failed to update order status")
      }
    } catch {
      toast.error("Error updating order status")
    }
  }

  // --- User Actions ---
  const handleToggleUserActive = async (targetUser: UserData) => {
    if (!token) return
    const newActive = !targetUser.is_active
    try {
      const res = await fetch(`/api/v1/users/${targetUser.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ is_active: newActive })
      })
      if (res.ok) {
        toast.success(`User ${newActive ? "activated" : "deactivated"}`)
        setUsers(prev => prev.map(u => u.id === targetUser.id ? { ...u, is_active: newActive } : u))
      } else {
        toast.error("Failed to update user status")
      }
    } catch {
      toast.error("Network error updating user")
    }
  }

  const handleToggleUserRole = async (targetUser: UserData) => {
    if (!token) return
    const newRole = targetUser.role === "admin" ? "customer" : "admin"
    if (!window.confirm(`Change role of ${targetUser.email} to ${newRole.toUpperCase()}?`)) return
    try {
      const res = await fetch(`/api/v1/users/${targetUser.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ role: newRole })
      })
      if (res.ok) {
        toast.success(`Role changed to ${newRole}`)
        setUsers(prev => prev.map(u => u.id === targetUser.id ? { ...u, role: newRole } : u))
      } else {
        toast.error("Failed to update role")
      }
    } catch {
      toast.error("Network error updating role")
    }
  }

  // --- Category Actions ---
  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token || !categoryName.trim()) return
    const slug = categorySlug.trim() || categoryName.trim().toLowerCase().replace(/\s+/g, "-")
    setIsCategorySubmitting(true)
    try {
      const res = await fetch("/api/v1/categories/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ name: categoryName.trim(), slug })
      })
      if (res.ok) {
        const newCat = await res.json()
        toast.success("Category created")
        setCategories(prev => [...prev, newCat])
        setIsCategoryModalOpen(false)
        setCategoryName("")
        setCategorySlug("")
      } else {
        const err = await res.json()
        toast.error(err.detail || "Failed to create category")
      }
    } catch {
      toast.error("Error creating category")
    } finally {
      setIsCategorySubmitting(false)
    }
  }

  const handleDeleteCategory = async (id: string, name: string) => {
    if (!token || !window.confirm(`Delete category "${name}"?`)) return
    try {
      const res = await fetch(`/api/v1/categories/${id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      })
      if (res.ok || res.status === 204) {
        toast.success("Category deleted")
        setCategories(prev => prev.filter(c => c.id !== id))
      } else {
        toast.error("Failed to delete category")
      }
    } catch {
      toast.error("Error deleting category")
    }
  }

  // --- Statistics Calculation ---
  const stats = useMemo(() => {
    const totalRev = orders
      .filter(o => o.status !== "CANCELLED")
      .reduce((sum, o) => sum + Number(o.total_amount || 0), 0)
    const pendingOrders = orders.filter(o => o.status === "PENDING").length
    const lowStock = products.filter(p => (p.stock_quantity ?? 0) <= 5).length
    const totalCustomers = users.filter(u => u.role === "customer").length
    return { totalRev, totalOrders: orders.length, pendingOrders, lowStock, totalCustomers }
  }, [orders, products, users])

  // Filtered Products
  const filteredProducts = useMemo(() => {
    const q = productSearch.toLowerCase().trim()
    if (!q) return products
    return products.filter(p => p.name.toLowerCase().includes(q) || (p.brand && p.brand.toLowerCase().includes(q)))
  }, [products, productSearch])

  // Filtered Orders
  const filteredOrders = useMemo(() => {
    if (orderStatusFilter === "ALL") return orders
    return orders.filter(o => o.status === orderStatusFilter)
  }, [orders, orderStatusFilter])

  // Filtered Users
  const filteredUsers = useMemo(() => {
    const q = userSearch.toLowerCase().trim()
    if (!q) return users
    return users.filter(u => u.email.toLowerCase().includes(q) || u.username.toLowerCase().includes(q))
  }, [users, userSearch])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center text-zinc-500 font-medium">
        Loading admin dashboard...
      </div>
    )
  }

  if (!user || user.role !== "admin") return null

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="bg-white border-b border-zinc-200 px-6 md:px-12 py-3.5 flex justify-between items-center sticky top-0 z-30 shadow-xs">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-xs font-medium text-zinc-500 hover:text-zinc-900 transition-colors flex items-center gap-1.5">
            <span>&larr;</span> Storefront
          </Link>
          <div className="h-4 w-px bg-zinc-200" />
          <div className="flex items-center gap-2">
            <span className="font-semibold text-zinc-900 tracking-tight text-base">Commerce Admin</span>
            <span className="text-[10px] uppercase font-bold tracking-wider bg-zinc-900 text-white px-2 py-0.5 rounded-full">
              Portal
            </span>
            {isFetching && (
              <span className="text-[11px] text-zinc-400 flex items-center gap-1 ml-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" /> Syncing...
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-sm text-zinc-500 hidden sm:inline">{user.email}</span>
          <button 
            onClick={() => {
              useAuthStore.getState().logout()
              localStorage.removeItem("access_token")
              localStorage.removeItem("token")
              setLocation("/")
            }}
            className="text-xs text-red-500 hover:text-red-600 font-medium px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Tabs Navigation Bar */}
      <nav className="bg-white border-b border-zinc-200 px-6 md:px-12 sticky top-[53px] z-20">
        <div className="max-w-6xl mx-auto flex gap-8 overflow-x-auto no-scrollbar">
          {[
            { id: "overview", label: "Overview", icon: "📊" },
            { id: "products", label: `Products (${products.length})`, icon: "📦" },
            { id: "orders", label: `Orders (${orders.length})`, icon: "📋" },
            { id: "users", label: `Users (${users.length})`, icon: "👥" },
            { id: "categories", label: `Categories (${categories.length})`, icon: "🏷️" }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`py-3.5 text-sm font-medium border-b-2 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                activeTab === tab.id
                  ? "border-zinc-900 text-zinc-900"
                  : "border-transparent text-zinc-500 hover:text-zinc-800 hover:border-zinc-300"
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Main Container */}
      <main className="flex-1 p-6 md:p-10 max-w-6xl mx-auto w-full">
        {/* TAB 1: OVERVIEW */}
        {activeTab === "overview" && (
          <div className="space-y-8 animate-in fade-in duration-150">
            {/* Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-xs">
                <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Total Revenue</span>
                <div className="text-3xl font-bold text-zinc-900 mt-2">${stats.totalRev.toFixed(2)}</div>
                <span className="text-xs text-emerald-600 font-medium mt-1 inline-block">● Active orders</span>
              </div>
              <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-xs">
                <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Total Orders</span>
                <div className="text-3xl font-bold text-zinc-900 mt-2">{stats.totalOrders}</div>
                <span className="text-xs text-amber-600 font-medium mt-1 inline-block">● {stats.pendingOrders} pending</span>
              </div>
              <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-xs">
                <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Products in Catalog</span>
                <div className="text-3xl font-bold text-zinc-900 mt-2">{products.length}</div>
                <span className="text-xs text-zinc-500 font-medium mt-1 inline-block">{stats.lowStock} low stock</span>
              </div>
              <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-xs">
                <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Customers</span>
                <div className="text-3xl font-bold text-zinc-900 mt-2">{stats.totalCustomers}</div>
                <span className="text-xs text-blue-600 font-medium mt-1 inline-block">● {users.length} total users</span>
              </div>
            </div>

            {/* Quick Actions & Highlights */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Recent Orders Card */}
              <div className="lg:col-span-2 bg-white rounded-2xl border border-zinc-200 p-6 shadow-xs">
                <div className="flex justify-between items-center mb-5">
                  <h3 className="font-semibold text-zinc-900">Recent Orders</h3>
                  <button onClick={() => setActiveTab("orders")} className="text-xs text-zinc-500 hover:text-zinc-900 font-medium underline">
                    View all &rarr;
                  </button>
                </div>
                <div className="divide-y divide-zinc-100">
                  {orders.slice(0, 5).map(o => (
                    <div key={o.id} className="py-3 flex items-center justify-between text-sm">
                      <div>
                        <div className="font-medium text-zinc-900">#{o.id.substring(0, 8)}...</div>
                        <div className="text-xs text-zinc-400">{o.payment_method} · {o.items?.length || 0} items</div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-zinc-900">${Number(o.total_amount).toFixed(2)}</div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          o.status === "COMPLETED" ? "bg-emerald-100 text-emerald-800" :
                          o.status === "PROCESSING" ? "bg-blue-100 text-blue-800" :
                          o.status === "CANCELLED" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"
                        }`}>
                          {o.status}
                        </span>
                      </div>
                    </div>
                  ))}
                  {orders.length === 0 && (
                    <p className="text-zinc-400 text-sm py-4 text-center">No orders placed yet.</p>
                  )}
                </div>
              </div>

              {/* Low Stock Watchlist */}
              <div className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-xs">
                <div className="flex justify-between items-center mb-5">
                  <h3 className="font-semibold text-zinc-900">Inventory Alert</h3>
                  <button onClick={() => setActiveTab("products")} className="text-xs text-zinc-500 hover:text-zinc-900 font-medium underline">
                    Manage &rarr;
                  </button>
                </div>
                <div className="divide-y divide-zinc-100">
                  {products.filter(p => (p.stock_quantity ?? 0) <= 5).slice(0, 5).map(p => (
                    <div key={p.id} className="py-2.5 flex items-center justify-between text-sm">
                      <span className="font-medium text-zinc-800 line-clamp-1">{p.name}</span>
                      <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-md">
                        {p.stock_quantity ?? 0} left
                      </span>
                    </div>
                  ))}
                  {products.filter(p => (p.stock_quantity ?? 0) <= 5).length === 0 && (
                    <p className="text-zinc-400 text-sm py-4 text-center">Stock levels are healthy.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: PRODUCTS */}
        {activeTab === "products" && (
          <div className="space-y-6 animate-in fade-in duration-150">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-zinc-900">Products Catalog</h2>
                <p className="text-xs text-zinc-500 mt-0.5">Manage products, stock quantity, and pricing</p>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  placeholder="Search products..."
                  value={productSearch}
                  onChange={e => setProductSearch(e.target.value)}
                  className="bg-white border border-zinc-200 text-xs rounded-xl px-3.5 py-2 text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 w-48 sm:w-60"
                />
                <button
                  onClick={handleOpenAddProduct}
                  className="bg-zinc-900 hover:bg-zinc-800 text-white px-4 py-2 rounded-xl text-xs font-medium shadow-xs transition-colors flex items-center gap-1.5"
                >
                  <span>+</span> Add Product
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-50 text-zinc-500 border-b border-zinc-200 font-medium">
                    <tr>
                      <th className="px-6 py-3.5">Product</th>
                      <th className="px-6 py-3.5">Brand</th>
                      <th className="px-6 py-3.5">Price</th>
                      <th className="px-6 py-3.5">Stock</th>
                      <th className="px-6 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {filteredProducts.map(p => (
                      <tr key={p.id} className="hover:bg-zinc-50/50 transition-colors">
                        <td className="px-6 py-3.5">
                          <div className="flex items-center gap-3">
                            {p.image_url ? (
                              <img src={p.image_url} alt={p.name} className="w-10 h-10 rounded-lg object-cover bg-zinc-100" />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-400 font-bold text-[10px]">
                                IMG
                              </div>
                            )}
                            <div>
                              <div className="font-semibold text-zinc-900 line-clamp-1">{p.name}</div>
                              {p.description && <div className="text-zinc-400 text-[11px] line-clamp-1 max-w-xs">{p.description}</div>}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-3.5 text-zinc-600 font-medium">{p.brand || "—"}</td>
                        <td className="px-6 py-3.5 font-bold text-zinc-900">${Number(p.price || 0).toFixed(2)}</td>
                        <td className="px-6 py-3.5">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                            (p.stock_quantity ?? 0) > 5 ? "bg-emerald-50 text-emerald-700" :
                            (p.stock_quantity ?? 0) > 0 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"
                          }`}>
                            {p.stock_quantity ?? 0} in stock
                          </span>
                        </td>
                        <td className="px-6 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleOpenEditProduct(p)}
                              className="px-2.5 py-1 text-xs font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-lg"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteProduct(p.id, p.name)}
                              className="px-2.5 py-1 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredProducts.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-10 text-center text-zinc-400">
                          No products found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: ORDERS */}
        {activeTab === "orders" && (
          <div className="space-y-6 animate-in fade-in duration-150">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-zinc-900">Order Management</h2>
                <p className="text-xs text-zinc-500 mt-0.5">Track and update customer order fulfillment status</p>
              </div>
              <div className="flex gap-2">
                {["ALL", "PENDING", "PROCESSING", "COMPLETED", "CANCELLED"].map(st => (
                  <button
                    key={st}
                    onClick={() => setOrderStatusFilter(st)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      orderStatusFilter === st
                        ? "bg-zinc-900 text-white"
                        : "bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-50 text-zinc-500 border-b border-zinc-200 font-medium">
                    <tr>
                      <th className="px-6 py-3.5">Order ID</th>
                      <th className="px-6 py-3.5">Customer ID</th>
                      <th className="px-6 py-3.5">Total Amount</th>
                      <th className="px-6 py-3.5">Payment</th>
                      <th className="px-6 py-3.5">Status</th>
                      <th className="px-6 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {filteredOrders.map(o => (
                      <tr key={o.id} className="hover:bg-zinc-50/50 transition-colors">
                        <td className="px-6 py-3.5 font-mono text-zinc-800 font-medium">
                          #{o.id.substring(0, 8)}
                        </td>
                        <td className="px-6 py-3.5 text-zinc-500 font-mono text-[11px]">
                          {o.user_id.substring(0, 8)}...
                        </td>
                        <td className="px-6 py-3.5 font-bold text-zinc-900">
                          ${Number(o.total_amount).toFixed(2)}
                        </td>
                        <td className="px-6 py-3.5">
                          <span className="font-medium text-zinc-700 block">{o.payment_method}</span>
                          <span className={`text-[10px] uppercase font-bold ${
                            o.payment?.status === "SUCCESS" ? "text-emerald-600" :
                            o.payment?.status === "REFUNDED" ? "text-red-500" : "text-amber-500"
                          }`}>
                            {o.payment?.status || "UNPAID"}
                          </span>
                        </td>
                        <td className="px-6 py-3.5">
                          <select
                            value={o.status}
                            onChange={e => handleUpdateOrderStatus(o.id, e.target.value)}
                            className="bg-zinc-50 border border-zinc-200 text-xs rounded-lg px-2.5 py-1 font-medium focus:ring-1 focus:ring-zinc-900 focus:outline-none"
                          >
                            <option value="PENDING">PENDING</option>
                            <option value="PROCESSING">PROCESSING</option>
                            <option value="SHIPPED">SHIPPED</option>
                            <option value="COMPLETED">COMPLETED</option>
                            <option value="CANCELLED">CANCELLED</option>
                          </select>
                        </td>
                        <td className="px-6 py-3.5 text-right">
                          <button
                            onClick={() => setSelectedOrderForDetail(o)}
                            className="px-3 py-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-medium rounded-lg text-xs"
                          >
                            View Items ({o.items?.length || 0})
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredOrders.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-6 py-10 text-center text-zinc-400">
                          No orders in this category.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: USERS */}
        {activeTab === "users" && (
          <div className="space-y-6 animate-in fade-in duration-150">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-zinc-900">User Accounts</h2>
                <p className="text-xs text-zinc-500 mt-0.5">Manage user roles and account activation statuses</p>
              </div>
              <input
                type="text"
                placeholder="Search username or email..."
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                className="bg-white border border-zinc-200 text-xs rounded-xl px-3.5 py-2 text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 w-48 sm:w-64"
              />
            </div>

            <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-50 text-zinc-500 border-b border-zinc-200 font-medium">
                    <tr>
                      <th className="px-6 py-3.5">Username</th>
                      <th className="px-6 py-3.5">Email</th>
                      <th className="px-6 py-3.5">Role</th>
                      <th className="px-6 py-3.5">Status</th>
                      <th className="px-6 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {filteredUsers.map(u => (
                      <tr key={u.id} className="hover:bg-zinc-50/50 transition-colors">
                        <td className="px-6 py-3.5 font-semibold text-zinc-900">{u.username}</td>
                        <td className="px-6 py-3.5 text-zinc-600">{u.email}</td>
                        <td className="px-6 py-3.5">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            u.role === "admin" ? "bg-purple-100 text-purple-800" : "bg-zinc-100 text-zinc-700"
                          }`}>
                            {u.role.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-6 py-3.5">
                          <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${
                            u.is_active ? "text-emerald-600" : "text-red-500"
                          }`}>
                            ● {u.is_active ? "Active" : "Disabled"}
                          </span>
                        </td>
                        <td className="px-6 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleToggleUserActive(u)}
                              className={`px-2.5 py-1 text-xs font-medium rounded-lg ${
                                u.is_active 
                                  ? "bg-amber-50 text-amber-700 hover:bg-amber-100" 
                                  : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                              }`}
                            >
                              {u.is_active ? "Deactivate" : "Activate"}
                            </button>
                            <button
                              onClick={() => handleToggleUserRole(u)}
                              className="px-2.5 py-1 text-xs font-medium bg-zinc-100 text-zinc-700 hover:bg-zinc-200 rounded-lg"
                            >
                              {u.role === "admin" ? "Demote" : "Promote Admin"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredUsers.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-10 text-center text-zinc-400">
                          No users found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: CATEGORIES */}
        {activeTab === "categories" && (
          <div className="space-y-6 animate-in fade-in duration-150">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-zinc-900">Product Categories</h2>
                <p className="text-xs text-zinc-500 mt-0.5">Organize your store catalog with categorized taxonomy</p>
              </div>
              <button
                onClick={() => setIsCategoryModalOpen(true)}
                className="bg-zinc-900 hover:bg-zinc-800 text-white px-4 py-2 rounded-xl text-xs font-medium shadow-xs transition-colors flex items-center gap-1.5"
              >
                <span>+</span> Add Category
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-xs max-w-3xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 text-zinc-500 border-b border-zinc-200 font-medium">
                  <tr>
                    <th className="px-6 py-3.5">Category Name</th>
                    <th className="px-6 py-3.5">Slug URL</th>
                    <th className="px-6 py-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {categories.map(cat => (
                    <tr key={cat.id} className="hover:bg-zinc-50/50 transition-colors">
                      <td className="px-6 py-3.5 font-semibold text-zinc-900">{cat.name}</td>
                      <td className="px-6 py-3.5 font-mono text-zinc-500">/{cat.slug}</td>
                      <td className="px-6 py-3.5 text-right">
                        <button
                          onClick={() => handleDeleteCategory(cat.id, cat.name)}
                          className="text-red-500 hover:text-red-700 font-medium text-xs px-2.5 py-1 bg-red-50 hover:bg-red-100 rounded-lg"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                  {categories.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-6 py-8 text-center text-zinc-400">
                        No categories found. Create your first category.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* --- MODAL 1: ADD / EDIT PRODUCT --- */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[2rem] border border-zinc-100 shadow-2xl max-w-lg w-full p-8 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold text-zinc-900 tracking-tight">
                {editingProduct ? "Edit Product" : "Add New Product"}
              </h3>
              <button 
                onClick={() => setIsProductModalOpen(false)}
                className="w-8 h-8 rounded-full bg-zinc-100 text-zinc-500 hover:bg-zinc-200 flex items-center justify-center text-sm font-medium transition-colors"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleProductSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1.5">Product Name *</label>
                <input
                  type="text"
                  required
                  value={productForm.name}
                  onChange={e => setProductForm({ ...productForm, name: e.target.value })}
                  placeholder="e.g. Silk Minimalist Tee"
                  className="w-full bg-zinc-50 border border-zinc-200 text-zinc-900 rounded-xl px-4 py-2 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1.5">Price ($) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={productForm.price}
                    onChange={e => setProductForm({ ...productForm, price: e.target.value })}
                    placeholder="35.00"
                    className="w-full bg-zinc-50 border border-zinc-200 text-zinc-900 rounded-xl px-4 py-2 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1.5">Stock Quantity *</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={productForm.stock_quantity}
                    onChange={e => setProductForm({ ...productForm, stock_quantity: e.target.value })}
                    placeholder="10"
                    className="w-full bg-zinc-50 border border-zinc-200 text-zinc-900 rounded-xl px-4 py-2 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1.5">Brand</label>
                <input
                  type="text"
                  value={productForm.brand}
                  onChange={e => setProductForm({ ...productForm, brand: e.target.value })}
                  placeholder="e.g. Studio Minimal"
                  className="w-full bg-zinc-50 border border-zinc-200 text-zinc-900 rounded-xl px-4 py-2 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1.5">Image URL</label>
                <input
                  type="url"
                  value={productForm.image_url}
                  onChange={e => setProductForm({ ...productForm, image_url: e.target.value })}
                  placeholder="https://..."
                  className="w-full bg-zinc-50 border border-zinc-200 text-zinc-900 rounded-xl px-4 py-2 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1.5">Description</label>
                <textarea
                  rows={3}
                  value={productForm.description}
                  onChange={e => setProductForm({ ...productForm, description: e.target.value })}
                  placeholder="Product description..."
                  className="w-full bg-zinc-50 border border-zinc-200 text-zinc-900 rounded-xl p-3 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-100 mt-6">
                <button
                  type="button"
                  onClick={() => setIsProductModalOpen(false)}
                  disabled={isProductSubmitting}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-600 hover:bg-zinc-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProductSubmitting}
                  className="px-5 py-2 rounded-xl text-xs font-medium bg-zinc-900 text-white hover:bg-zinc-800 transition-all disabled:opacity-50"
                >
                  {isProductSubmitting ? "Saving..." : editingProduct ? "Save Changes" : "Create Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL 2: ORDER ITEMS DETAIL --- */}
      {selectedOrderForDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[2rem] border border-zinc-100 shadow-2xl max-w-lg w-full p-8">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-lg font-semibold text-zinc-900">Order Items</h3>
                <p className="text-xs text-zinc-400 font-mono">#{selectedOrderForDetail.id}</p>
              </div>
              <button 
                onClick={() => setSelectedOrderForDetail(null)}
                className="w-8 h-8 rounded-full bg-zinc-100 text-zinc-500 hover:bg-zinc-200 flex items-center justify-center text-sm font-medium transition-colors"
              >
                &times;
              </button>
            </div>

            <div className="divide-y divide-zinc-100 mb-6 max-h-72 overflow-y-auto">
              {selectedOrderForDetail.items?.map(item => (
                <div key={item.id} className="py-3 flex justify-between items-center text-xs">
                  <div>
                    <span className="font-mono text-zinc-700 block">Product ID: {item.product_id}</span>
                    <span className="text-zinc-400">Qty: {item.quantity}</span>
                  </div>
                  <span className="font-semibold text-zinc-900">
                    ${(Number(item.unit_price) * item.quantity).toFixed(2)}
                  </span>
                </div>
              ))}
              {(!selectedOrderForDetail.items || selectedOrderForDetail.items.length === 0) && (
                <p className="text-xs text-zinc-400 py-4 text-center">No items listed for this order.</p>
              )}
            </div>

            <div className="border-t border-zinc-100 pt-4 flex justify-between items-center">
              <span className="text-xs text-zinc-500">Total Order Amount</span>
              <span className="text-lg font-bold text-zinc-900">${Number(selectedOrderForDetail.total_amount).toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 3: ADD CATEGORY --- */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[2rem] border border-zinc-100 shadow-2xl max-w-sm w-full p-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold text-zinc-900">Add Category</h3>
              <button 
                onClick={() => setIsCategoryModalOpen(false)}
                className="w-8 h-8 rounded-full bg-zinc-100 text-zinc-500 hover:bg-zinc-200 flex items-center justify-center text-sm font-medium"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateCategory} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Category Name *</label>
                <input
                  type="text"
                  required
                  value={categoryName}
                  onChange={e => {
                    setCategoryName(e.target.value)
                    if (!categorySlug) {
                      setCategorySlug(e.target.value.toLowerCase().replace(/\s+/g, "-"))
                    }
                  }}
                  placeholder="e.g. Footwear"
                  className="w-full bg-zinc-50 border border-zinc-200 text-zinc-900 rounded-xl px-4 py-2 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Slug URL</label>
                <input
                  type="text"
                  value={categorySlug}
                  onChange={e => setCategorySlug(e.target.value)}
                  placeholder="e.g. footwear"
                  className="w-full bg-zinc-50 border border-zinc-200 text-zinc-900 rounded-xl px-4 py-2 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-100 mt-6">
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(false)}
                  disabled={isCategorySubmitting}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-600 hover:bg-zinc-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCategorySubmitting}
                  className="px-5 py-2 rounded-xl text-xs font-medium bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-50"
                >
                  {isCategorySubmitting ? "Creating..." : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
