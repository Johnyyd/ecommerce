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

interface BrandItem {
  id: string
  name: string
  slug: string
  logo_url?: string | null
  description?: string | null
  website?: string | null
}

interface VoucherItem {
  id: string
  code: string
  discount_type: string
  discount_value: number
  min_order_amount: number
  max_discount_amount?: number | null
  usage_limit?: number | null
  times_used: number
  valid_until?: string | null
  is_active: boolean
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

interface BackupFile {
  filename: string
  size_bytes: number
  size_human: string
  created_at: string
}

// Form Types
interface ProductFormData {
  name: string
  description: string
  price: string
  stock_quantity: string
  brand: string
  image_url: string
}

interface BrandFormData {
  name: string
  slug: string
  logo_url: string
  description: string
  website: string
}

interface VoucherFormData {
  code: string
  discount_type: string
  discount_value: string
  min_order_amount: string
  max_discount_amount: string
  usage_limit: string
  valid_until: string
  is_active: boolean
}

type TabType = "overview" | "products" | "brands" | "vouchers" | "orders" | "users" | "categories" | "backups"

export function Admin() {
  const { user, isLoading } = useAuthStore()
  const [, setLocation] = useLocation()
  
  // Navigation
  const [activeTab, setActiveTab] = useState<TabType>("overview")

  // Data States
  const [products, setProducts] = useState<ProductItem[]>([])
  const [brands, setBrands] = useState<BrandItem[]>([])
  const [vouchers, setVouchers] = useState<VoucherItem[]>([])
  const [orders, setOrders] = useState<OrderData[]>([])
  const [users, setUsers] = useState<UserData[]>([])
  const [categories, setCategories] = useState<CategoryData[]>([])
  const [backups, setBackups] = useState<BackupFile[]>([])
  
  // Search & Filter
  const [isFetching, setIsFetching] = useState(false)
  const [productSearch, setProductSearch] = useState("")
  const [brandSearch, setBrandSearch] = useState("")
  const [voucherSearch, setVoucherSearch] = useState("")
  const [userSearch, setUserSearch] = useState("")
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>("ALL")

  // Modals - Product
  const [isProductModalOpen, setIsProductModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null)
  const [productForm, setProductForm] = useState<ProductFormData>({
    name: "", description: "", price: "", stock_quantity: "0", brand: "", image_url: ""
  })
  const [isProductSubmitting, setIsProductSubmitting] = useState(false)

  // Modals - Brand
  const [isBrandModalOpen, setIsBrandModalOpen] = useState(false)
  const [editingBrand, setEditingBrand] = useState<BrandItem | null>(null)
  const [brandForm, setBrandForm] = useState<BrandFormData>({
    name: "", slug: "", logo_url: "", description: "", website: ""
  })
  const [isBrandSubmitting, setIsBrandSubmitting] = useState(false)

  // Modals - Voucher
  const [isVoucherModalOpen, setIsVoucherModalOpen] = useState(false)
  const [editingVoucher, setEditingVoucher] = useState<VoucherItem | null>(null)
  const [voucherForm, setVoucherForm] = useState<VoucherFormData>({
    code: "", discount_type: "PERCENTAGE", discount_value: "10", min_order_amount: "0",
    max_discount_amount: "", usage_limit: "100", valid_until: "", is_active: true
  })
  const [isVoucherSubmitting, setIsVoucherSubmitting] = useState(false)

  // Modals - Order Detail
  const [selectedOrderForDetail, setSelectedOrderForDetail] = useState<OrderData | null>(null)

  // Modals - Category
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false)
  const [categoryName, setCategoryName] = useState("")
  const [categorySlug, setCategorySlug] = useState("")
  const [isCategorySubmitting, setIsCategorySubmitting] = useState(false)

  // Backup Action Loading
  const [isBackupProcessing, setIsBackupProcessing] = useState(false)

  const token = typeof window !== "undefined" 
    ? (localStorage.getItem("access_token") || localStorage.getItem("token")) 
    : null

  const isManager = user?.role === "manager"
  const isAdmin = user?.role === "admin"

  // Route Guard: Allow either Admin or Manager
  useEffect(() => {
    if (!isLoading && (!user || (user.role !== "admin" && user.role !== "manager"))) {
      setLocation("/login")
    }
  }, [user, isLoading, setLocation])

  // Initial Fetch
  useEffect(() => {
    if (user && (user.role === "admin" || user.role === "manager")) {
      fetchAllData()
    }
  }, [user])

  const fetchAllData = async () => {
    if (!token) return
    setIsFetching(true)
    try {
      await Promise.all([
        fetchProducts(),
        fetchBrands(),
        fetchVouchers(),
        fetchOrders(),
        fetchUsers(),
        fetchCategories(),
        fetchBackups()
      ])
    } catch (e) {
      console.error("Error loading staff data:", e)
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

  const fetchBrands = async () => {
    try {
      const res = await fetch("/api/v1/brands/?limit=100")
      if (res.ok) {
        const data = await res.json()
        setBrands(Array.isArray(data) ? data : [])
      }
    } catch (e) {
      console.error("Error fetching brands:", e)
    }
  }

  const fetchVouchers = async () => {
    if (!token) return
    try {
      const res = await fetch("/api/v1/vouchers/?limit=100", {
        headers: { "Authorization": `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setVouchers(Array.isArray(data) ? data : [])
      }
    } catch (e) {
      console.error("Error fetching vouchers:", e)
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

  const fetchBackups = async () => {
    if (!token || user?.role !== "admin") return
    try {
      const res = await fetch("/api/v1/admin/backups/", {
        headers: { "Authorization": `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setBackups(Array.isArray(data) ? data : [])
      }
    } catch (e) {
      console.error("Error fetching backups:", e)
    }
  }

  // --- Product Handlers ---
  const handleOpenAddProduct = () => {
    setEditingProduct(null)
    setProductForm({ name: "", description: "", price: "", stock_quantity: "0", brand: "", image_url: "" })
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
      const method = editingProduct ? "PATCH" : "POST"
      const url = editingProduct ? `/api/v1/products/${editingProduct.id}` : "/api/v1/products/"
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify(payload)
      })
      if (!res.ok) throw new Error("Failed to save product")
      toast.success(editingProduct ? "Product updated" : "Product created")
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
      }
    } catch {
      toast.error("Error deleting product")
    }
  }

  // --- Brand Handlers ---
  const handleOpenAddBrand = () => {
    setEditingBrand(null)
    setBrandForm({ name: "", slug: "", logo_url: "", description: "", website: "" })
    setIsBrandModalOpen(true)
  }

  const handleOpenEditBrand = (b: BrandItem) => {
    setEditingBrand(b)
    setBrandForm({
      name: b.name,
      slug: b.slug,
      logo_url: b.logo_url || "",
      description: b.description || "",
      website: b.website || ""
    })
    setIsBrandModalOpen(true)
  }

  const handleBrandSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) return
    const payload = {
      name: brandForm.name.trim(),
      slug: brandForm.slug.trim() || brandForm.name.toLowerCase().replace(/\s+/g, "-"),
      logo_url: brandForm.logo_url.trim() || null,
      description: brandForm.description.trim() || null,
      website: brandForm.website.trim() || null
    }

    setIsBrandSubmitting(true)
    try {
      const method = editingBrand ? "PATCH" : "POST"
      const url = editingBrand ? `/api/v1/brands/${editingBrand.id}` : "/api/v1/brands/"
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify(payload)
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || "Failed to save brand")
      }
      toast.success(editingBrand ? "Brand updated" : "Brand created")
      setIsBrandModalOpen(false)
      await fetchBrands()
    } catch (err: any) {
      toast.error(err.message || "Error saving brand")
    } finally {
      setIsBrandSubmitting(false)
    }
  }

  const handleDeleteBrand = async (id: string, name: string) => {
    if (!token || !window.confirm(`Delete brand "${name}"?`)) return
    try {
      const res = await fetch(`/api/v1/brands/${id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      })
      if (res.ok || res.status === 204) {
        toast.success("Brand deleted")
        setBrands(prev => prev.filter(b => b.id !== id))
      }
    } catch {
      toast.error("Error deleting brand")
    }
  }

  // --- Voucher Handlers ---
  const handleOpenAddVoucher = () => {
    setEditingVoucher(null)
    setVoucherForm({
      code: "", discount_type: "PERCENTAGE", discount_value: "10", min_order_amount: "0",
      max_discount_amount: "", usage_limit: "100", valid_until: "", is_active: true
    })
    setIsVoucherModalOpen(true)
  }

  const handleOpenEditVoucher = (v: VoucherItem) => {
    setEditingVoucher(v)
    setVoucherForm({
      code: v.code,
      discount_type: v.discount_type,
      discount_value: v.discount_value.toString(),
      min_order_amount: v.min_order_amount.toString(),
      max_discount_amount: v.max_discount_amount ? v.max_discount_amount.toString() : "",
      usage_limit: v.usage_limit ? v.usage_limit.toString() : "",
      valid_until: v.valid_until ? v.valid_until.substring(0, 10) : "",
      is_active: v.is_active
    })
    setIsVoucherModalOpen(true)
  }

  const handleVoucherSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) return
    const payload = {
      code: voucherForm.code.trim().toUpperCase(),
      discount_type: voucherForm.discount_type,
      discount_value: parseFloat(voucherForm.discount_value) || 0,
      min_order_amount: parseFloat(voucherForm.min_order_amount) || 0,
      max_discount_amount: voucherForm.max_discount_amount ? parseFloat(voucherForm.max_discount_amount) : null,
      usage_limit: voucherForm.usage_limit ? parseInt(voucherForm.usage_limit, 10) : null,
      valid_until: voucherForm.valid_until ? new Date(voucherForm.valid_until).toISOString() : null,
      is_active: voucherForm.is_active
    }

    setIsVoucherSubmitting(true)
    try {
      const method = editingVoucher ? "PATCH" : "POST"
      const url = editingVoucher ? `/api/v1/vouchers/${editingVoucher.id}` : "/api/v1/vouchers/"
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify(payload)
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || "Failed to save voucher")
      }
      toast.success(editingVoucher ? "Voucher updated" : "Voucher created")
      setIsVoucherModalOpen(false)
      await fetchVouchers()
    } catch (err: any) {
      toast.error(err.message || "Error saving voucher")
    } finally {
      setIsVoucherSubmitting(false)
    }
  }

  const handleDeleteVoucher = async (id: string, code: string) => {
    if (!token || !window.confirm(`Delete voucher "${code}"?`)) return
    try {
      const res = await fetch(`/api/v1/vouchers/${id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      })
      if (res.ok || res.status === 204) {
        toast.success("Voucher deleted")
        setVouchers(prev => prev.filter(v => v.id !== id))
      }
    } catch {
      toast.error("Error deleting voucher")
    }
  }

  // --- Order Handlers ---
  const handleUpdateOrderStatus = async (orderId: string, newStatus: string) => {
    if (!token) return
    try {
      const res = await fetch(`/api/v1/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
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

  // --- User Handlers (STRICT RBAC: Only Admin can modify) ---
  const handleToggleUserActive = async (targetUser: UserData) => {
    if (!token) return
    if (isManager) {
      toast.error("Permission Denied: Only Admin can modify user status.")
      return
    }
    const newActive = !targetUser.is_active
    try {
      const res = await fetch(`/api/v1/users/${targetUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ is_active: newActive })
      })
      if (res.ok) {
        toast.success(`User ${newActive ? "activated" : "deactivated"}`)
        setUsers(prev => prev.map(u => u.id === targetUser.id ? { ...u, is_active: newActive } : u))
      } else {
        toast.error("Failed to update user status")
      }
    } catch {
      toast.error("Error updating user status")
    }
  }

  const handleToggleUserRole = async (targetUser: UserData) => {
    if (!token) return
    if (isManager) {
      toast.error("Permission Denied: Only Admin can change user roles.")
      return
    }
    const newRole = targetUser.role === "admin" ? "manager" : targetUser.role === "manager" ? "customer" : "admin"
    if (!window.confirm(`Change role of ${targetUser.email} to ${newRole.toUpperCase()}?`)) return
    try {
      const res = await fetch(`/api/v1/users/${targetUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ role: newRole })
      })
      if (res.ok) {
        toast.success(`Role updated to ${newRole.toUpperCase()}`)
        setUsers(prev => prev.map(u => u.id === targetUser.id ? { ...u, role: newRole } : u))
      } else {
        toast.error("Failed to change user role")
      }
    } catch {
      toast.error("Error updating user role")
    }
  }

  // --- Category Handlers ---
  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token || !categoryName.trim()) return
    const slug = categorySlug.trim() || categoryName.trim().toLowerCase().replace(/\s+/g, "-")
    setIsCategorySubmitting(true)
    try {
      const res = await fetch("/api/v1/categories/", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
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
      }
    } catch {
      toast.error("Error deleting category")
    }
  }

  // --- Backup Handlers (Admin Only) ---
  const handleTriggerBackup = async () => {
    if (!token || !isAdmin) return
    setIsBackupProcessing(true)
    try {
      const res = await fetch("/api/v1/admin/backups/create", {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      })
      if (res.ok) {
        const newBackup = await res.json()
        toast.success(`Backup created: ${newBackup.filename}`)
        await fetchBackups()
      } else {
        toast.error("Backup creation failed")
      }
    } catch {
      toast.error("Network error triggering backup")
    } finally {
      setIsBackupProcessing(false)
    }
  }

  const handleRestoreBackup = async (filename: string) => {
    if (!token || !isAdmin) return
    if (!window.confirm(`WARNING: Restore database from "${filename}"? All newer changes will be replaced.`)) return
    setIsBackupProcessing(true)
    try {
      const res = await fetch("/api/v1/admin/backups/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ filename })
      })
      if (res.ok) {
        toast.success(`Database successfully restored from ${filename}`)
        await fetchAllData()
      } else {
        toast.error("Restore failed")
      }
    } catch {
      toast.error("Network error restoring database")
    } finally {
      setIsBackupProcessing(false)
    }
  }

  // --- Stats Calculation ---
  const stats = useMemo(() => {
    const totalRev = orders
      .filter(o => o.status !== "CANCELLED")
      .reduce((sum, o) => sum + Number(o.total_amount || 0), 0)
    const pendingOrders = orders.filter(o => o.status === "PENDING").length
    const lowStock = products.filter(p => (p.stock_quantity ?? 0) <= 5).length
    const totalCustomers = users.filter(u => u.role === "customer").length
    return { totalRev, totalOrders: orders.length, pendingOrders, lowStock, totalCustomers }
  }, [orders, products, users])

  // Filtered lists
  const filteredProducts = useMemo(() => {
    const q = productSearch.toLowerCase().trim()
    if (!q) return products
    return products.filter(p => p.name.toLowerCase().includes(q) || (p.brand && p.brand.toLowerCase().includes(q)))
  }, [products, productSearch])

  const filteredBrands = useMemo(() => {
    const q = brandSearch.toLowerCase().trim()
    if (!q) return brands
    return brands.filter(b => b.name.toLowerCase().includes(q) || b.slug.toLowerCase().includes(q))
  }, [brands, brandSearch])

  const filteredVouchers = useMemo(() => {
    const q = voucherSearch.toLowerCase().trim()
    if (!q) return vouchers
    return vouchers.filter(v => v.code.toLowerCase().includes(q))
  }, [vouchers, voucherSearch])

  const filteredOrders = useMemo(() => {
    if (orderStatusFilter === "ALL") return orders
    return orders.filter(o => o.status === orderStatusFilter)
  }, [orders, orderStatusFilter])

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

  if (!user || (user.role !== "admin" && user.role !== "manager")) return null

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
            <span className="font-semibold text-zinc-900 tracking-tight text-base">Commerce Management</span>
            <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${
              isAdmin ? "bg-zinc-900 text-white" : "bg-blue-600 text-white"
            }`}>
              {isAdmin ? "Super Admin" : "Manager"}
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
            className="text-xs text-red-500 hover:text-red-600 font-medium px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Tabs Navigation Bar */}
      <nav className="bg-white border-b border-zinc-200 px-6 md:px-12 sticky top-[53px] z-20">
        <div className="max-w-6xl mx-auto flex gap-6 overflow-x-auto no-scrollbar">
          {[
            { id: "overview", label: "Overview", icon: "📊" },
            { id: "products", label: `Products (${products.length})`, icon: "📦" },
            { id: "brands", label: `Brands (${brands.length})`, icon: "🏷️" },
            { id: "vouchers", label: `Vouchers (${vouchers.length})`, icon: "🎟️" },
            { id: "orders", label: `Orders (${orders.length})`, icon: "📋" },
            { id: "users", label: `Users (${users.length})`, icon: "👥" },
            { id: "categories", label: `Categories (${categories.length})`, icon: "📂" },
            { id: "backups", label: "Backup & Restore", icon: "🗄️" }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`py-3.5 text-xs font-medium border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                activeTab === tab.id
                  ? "border-zinc-900 text-zinc-900 font-semibold"
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
                <span className="text-xs text-emerald-600 font-medium mt-1 inline-block">● Paid / Active</span>
              </div>
              <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-xs">
                <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Total Orders</span>
                <div className="text-3xl font-bold text-zinc-900 mt-2">{stats.totalOrders}</div>
                <span className="text-xs text-amber-600 font-medium mt-1 inline-block">● {stats.pendingOrders} pending</span>
              </div>
              <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-xs">
                <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Catalog & Brands</span>
                <div className="text-3xl font-bold text-zinc-900 mt-2">{products.length} items</div>
                <span className="text-xs text-zinc-500 font-medium mt-1 inline-block">{brands.length} partner brands</span>
              </div>
              <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-xs">
                <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Customers</span>
                <div className="text-3xl font-bold text-zinc-900 mt-2">{stats.totalCustomers}</div>
                <span className="text-xs text-blue-600 font-medium mt-1 inline-block">● {users.length} total accounts</span>
              </div>
            </div>

            {/* Overview Highlights */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white rounded-2xl border border-zinc-200 p-6 shadow-xs">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold text-zinc-900 text-sm">Recent Orders</h3>
                  <button onClick={() => setActiveTab("orders")} className="text-xs text-zinc-500 hover:text-zinc-900 underline">
                    View all &rarr;
                  </button>
                </div>
                <div className="divide-y divide-zinc-100">
                  {orders.slice(0, 5).map(o => (
                    <div key={o.id} className="py-2.5 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-semibold text-zinc-900">#{o.id.substring(0, 8)}...</div>
                        <div className="text-zinc-400 text-[11px]">{o.payment_method} · {o.items?.length || 0} items</div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-zinc-900">${Number(o.total_amount).toFixed(2)}</div>
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
                  {orders.length === 0 && <p className="text-zinc-400 text-xs py-4 text-center">No orders placed yet.</p>}
                </div>
              </div>

              {/* Quick Summary Card */}
              <div className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-xs space-y-4">
                <h3 className="font-semibold text-zinc-900 text-sm">Role & Capabilities</h3>
                <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-100 text-xs space-y-1.5">
                  <div className="font-semibold text-zinc-800">Your Account: <span className="uppercase text-blue-600 font-bold">{user.role}</span></div>
                  <p className="text-zinc-500 leading-relaxed">
                    {isAdmin 
                      ? "Bạn có toàn quyền cao nhất trong hệ thống (Sản phẩm, Hãng, Voucher, Đơn hàng, Phân quyền người dùng, Backup/Restore)." 
                      : "Bạn có quyền quản lý Sản phẩm, Hãng, Voucher, Đơn hàng, Danh mục. Bạn bị giới hạn quyền chỉnh sửa tài khoản người dùng và sao lưu hệ thống."}
                  </p>
                </div>
                <div className="pt-2 flex flex-col gap-2">
                  <button onClick={() => setActiveTab("products")} className="w-full py-2 bg-zinc-900 text-white rounded-xl text-xs font-medium hover:bg-zinc-800">
                    + Add New Product
                  </button>
                  <button onClick={() => setActiveTab("vouchers")} className="w-full py-2 bg-zinc-100 text-zinc-800 rounded-xl text-xs font-medium hover:bg-zinc-200">
                    + Create Promotion Voucher
                  </button>
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
                  className="bg-zinc-900 hover:bg-zinc-800 text-white px-4 py-2 rounded-xl text-xs font-medium shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <span>+</span> Add Product
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-xs">
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
                            className="px-2.5 py-1 text-xs font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-lg cursor-pointer"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteProduct(p.id, p.name)}
                            className="px-2.5 py-1 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg cursor-pointer"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredProducts.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-10 text-center text-zinc-400">No products found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: BRANDS (HÃNG SẢN PHẨM) */}
        {activeTab === "brands" && (
          <div className="space-y-6 animate-in fade-in duration-150">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-zinc-900">Partner Brands</h2>
                <p className="text-xs text-zinc-500 mt-0.5">Manage product brands, manufacturer logos, and official websites</p>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  placeholder="Search brands..."
                  value={brandSearch}
                  onChange={e => setBrandSearch(e.target.value)}
                  className="bg-white border border-zinc-200 text-xs rounded-xl px-3.5 py-2 text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 w-48 sm:w-60"
                />
                <button
                  onClick={handleOpenAddBrand}
                  className="bg-zinc-900 hover:bg-zinc-800 text-white px-4 py-2 rounded-xl text-xs font-medium shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <span>+</span> Add Brand
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 text-zinc-500 border-b border-zinc-200 font-medium">
                  <tr>
                    <th className="px-6 py-3.5">Brand</th>
                    <th className="px-6 py-3.5">Slug</th>
                    <th className="px-6 py-3.5">Website</th>
                    <th className="px-6 py-3.5">Description</th>
                    <th className="px-6 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {filteredBrands.map(b => (
                    <tr key={b.id} className="hover:bg-zinc-50/50 transition-colors">
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-3">
                          {b.logo_url ? (
                            <img src={b.logo_url} alt={b.name} className="w-8 h-8 rounded-lg object-contain bg-zinc-50 border border-zinc-100" />
                          ) : (
                            <div className="w-8 h-8 rounded-lg bg-zinc-100 border border-zinc-200 flex items-center justify-center font-bold text-[10px] text-zinc-500">
                              {b.name.substring(0, 2).toUpperCase()}
                            </div>
                          )}
                          <span className="font-semibold text-zinc-900 text-sm">{b.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-3.5 font-mono text-zinc-500">/{b.slug}</td>
                      <td className="px-6 py-3.5 text-zinc-600">
                        {b.website ? (
                          <a href={b.website} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                            {b.website.replace(/^https?:\/\//, '')}
                          </a>
                        ) : "—"}
                      </td>
                      <td className="px-6 py-3.5 text-zinc-500 max-w-xs line-clamp-1">{b.description || "—"}</td>
                      <td className="px-6 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenEditBrand(b)}
                            className="px-2.5 py-1 text-xs font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-lg cursor-pointer"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteBrand(b.id, b.name)}
                            className="px-2.5 py-1 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg cursor-pointer"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredBrands.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-10 text-center text-zinc-400">No brands found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: VOUCHERS (MÃ GIẢM GIÁ) */}
        {activeTab === "vouchers" && (
          <div className="space-y-6 animate-in fade-in duration-150">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-zinc-900">Promotions & Vouchers</h2>
                <p className="text-xs text-zinc-500 mt-0.5">Create coupon codes, percentage or fixed discounts, and set usage limits</p>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  placeholder="Search voucher code..."
                  value={voucherSearch}
                  onChange={e => setVoucherSearch(e.target.value)}
                  className="bg-white border border-zinc-200 text-xs rounded-xl px-3.5 py-2 text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 w-48 sm:w-60"
                />
                <button
                  onClick={handleOpenAddVoucher}
                  className="bg-zinc-900 hover:bg-zinc-800 text-white px-4 py-2 rounded-xl text-xs font-medium shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <span>+</span> Add Voucher
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 text-zinc-500 border-b border-zinc-200 font-medium">
                  <tr>
                    <th className="px-6 py-3.5">Code</th>
                    <th className="px-6 py-3.5">Discount</th>
                    <th className="px-6 py-3.5">Min Order</th>
                    <th className="px-6 py-3.5">Times Used / Limit</th>
                    <th className="px-6 py-3.5">Status</th>
                    <th className="px-6 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {filteredVouchers.map(v => (
                    <tr key={v.id} className="hover:bg-zinc-50/50 transition-colors">
                      <td className="px-6 py-3.5">
                        <span className="font-mono font-bold text-zinc-900 bg-zinc-100 px-2.5 py-1 rounded-md text-xs tracking-wider">
                          {v.code}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 font-semibold text-emerald-600">
                        {v.discount_type === "PERCENTAGE" ? `${v.discount_value}% OFF` : `$${Number(v.discount_value).toFixed(2)} OFF`}
                      </td>
                      <td className="px-6 py-3.5 text-zinc-700">
                        ${Number(v.min_order_amount || 0).toFixed(2)}
                      </td>
                      <td className="px-6 py-3.5 text-zinc-600">
                        {v.times_used} / {v.usage_limit ?? "Unlimited"}
                      </td>
                      <td className="px-6 py-3.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          v.is_active ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-500"
                        }`}>
                          {v.is_active ? "Active" : "Disabled"}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenEditVoucher(v)}
                            className="px-2.5 py-1 text-xs font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-lg cursor-pointer"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteVoucher(v.id, v.code)}
                            className="px-2.5 py-1 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg cursor-pointer"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredVouchers.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-10 text-center text-zinc-400">No vouchers created yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 5: ORDERS */}
        {activeTab === "orders" && (
          <div className="space-y-6 animate-in fade-in duration-150">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-zinc-900">Order Management</h2>
                <p className="text-xs text-zinc-500 mt-0.5">Track and update customer order fulfillment status</p>
              </div>
              <div className="flex gap-2">
                {["ALL", "PENDING", "PROCESSING", "SHIPPED", "COMPLETED", "CANCELLED"].map(st => (
                  <button
                    key={st}
                    onClick={() => setOrderStatusFilter(st)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
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
                      <td className="px-6 py-3.5 font-mono text-zinc-800 font-medium">#{o.id.substring(0, 8)}</td>
                      <td className="px-6 py-3.5 text-zinc-500 font-mono text-[11px]">{o.user_id.substring(0, 8)}...</td>
                      <td className="px-6 py-3.5 font-bold text-zinc-900">${Number(o.total_amount).toFixed(2)}</td>
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
                          className="bg-zinc-50 border border-zinc-200 text-xs rounded-lg px-2.5 py-1 font-medium focus:ring-1 focus:ring-zinc-900 focus:outline-none cursor-pointer"
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
                          className="px-3 py-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-medium rounded-lg text-xs cursor-pointer"
                        >
                          View Items ({o.items?.length || 0})
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredOrders.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-10 text-center text-zinc-400">No orders in this status.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 6: USERS (STRICT RBAC: MANAGER READ-ONLY) */}
        {activeTab === "users" && (
          <div className="space-y-6 animate-in fade-in duration-150">
            {isManager && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
                <span className="text-xl">⚠️</span>
                <div>
                  <h4 className="font-semibold text-amber-900 text-sm">Chế độ Chỉ Xem (Read-Only) dành cho Quản lý</h4>
                  <p className="text-amber-700 text-xs mt-0.5 leading-relaxed">
                    Bạn đang đăng nhập bằng tài khoản <strong>Quản lý (Manager)</strong>. Theo chính sách phân quyền, chỉ có tài khoản <strong>Admin</strong> mới được phép chỉnh sửa, kích hoạt/vô hiệu hóa hoặc thay đổi vai trò người dùng.
                  </p>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-zinc-900">User Accounts</h2>
                <p className="text-xs text-zinc-500 mt-0.5">Manage user roles and account activation statuses ({users.length} accounts)</p>
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
                          u.role === "admin" ? "bg-purple-100 text-purple-800" :
                          u.role === "manager" ? "bg-blue-100 text-blue-800" : "bg-zinc-100 text-zinc-700"
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
                            disabled={isManager}
                            title={isManager ? "Manager cannot modify users" : ""}
                            className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${
                              isManager 
                                ? "bg-zinc-100 text-zinc-400 cursor-not-allowed opacity-60" 
                                : u.is_active ? "bg-amber-50 text-amber-700 hover:bg-amber-100 cursor-pointer" : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 cursor-pointer"
                            }`}
                          >
                            {u.is_active ? "Deactivate" : "Activate"}
                          </button>
                          <button
                            onClick={() => handleToggleUserRole(u)}
                            disabled={isManager}
                            title={isManager ? "Manager cannot modify users" : ""}
                            className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${
                              isManager 
                                ? "bg-zinc-100 text-zinc-400 cursor-not-allowed opacity-60" 
                                : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 cursor-pointer"
                            }`}
                          >
                            {u.role === "admin" ? "Demote" : "Change Role"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredUsers.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-10 text-center text-zinc-400">No users found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 7: CATEGORIES */}
        {activeTab === "categories" && (
          <div className="space-y-6 animate-in fade-in duration-150">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-zinc-900">Product Categories</h2>
                <p className="text-xs text-zinc-500 mt-0.5">Organize your store catalog with categorized taxonomy</p>
              </div>
              <button
                onClick={() => setIsCategoryModalOpen(true)}
                className="bg-zinc-900 hover:bg-zinc-800 text-white px-4 py-2 rounded-xl text-xs font-medium shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
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
                          className="text-red-500 hover:text-red-700 font-medium text-xs px-2.5 py-1 bg-red-50 hover:bg-red-100 rounded-lg cursor-pointer"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                  {categories.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-6 py-8 text-center text-zinc-400">No categories found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 8: BACKUP & RESTORE (ADMIN ONLY) */}
        {activeTab === "backups" && (
          <div className="space-y-6 animate-in fade-in duration-150">
            {isManager && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
                <span className="text-xl">🔒</span>
                <div>
                  <h4 className="font-semibold text-red-900 text-sm">Chỉ Dành Cho Super Admin</h4>
                  <p className="text-red-700 text-xs mt-0.5 leading-relaxed">
                    Tính năng sao lưu và khôi phục cơ sở dữ liệu đòi hỏi quyền Super Admin cao nhất. Tài khoản Quản lý (Manager) không có quyền thao tác sao lưu hay phục hồi dữ liệu hệ thống.
                  </p>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-zinc-900">Database Backup & Recovery</h2>
                <p className="text-xs text-zinc-500 mt-0.5">Automated Kubernetes daily backups (02:00 UTC) and on-demand recovery</p>
              </div>
              {isAdmin && (
                <button
                  onClick={handleTriggerBackup}
                  disabled={isBackupProcessing}
                  className="bg-zinc-900 hover:bg-zinc-800 text-white px-4 py-2 rounded-xl text-xs font-medium shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <span>💾</span> {isBackupProcessing ? "Processing..." : "Backup Database Now"}
                </button>
              )}
            </div>

            {/* Information Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-zinc-200 text-xs space-y-2 shadow-xs">
                <div className="font-semibold text-zinc-900 flex items-center gap-2">
                  <span>⏱️</span> Lập lịch Kubernetes CronJob
                </div>
                <p className="text-zinc-500 leading-relaxed">
                  Hệ thống tự động chạy bản dump nhị phân hàng ngày lúc <strong>02:00 AM UTC</strong> qua StatefulSet PostgreSQL và lưu trữ trong PersistentVolume riêng (`postgres-backups-pvc`).
                </p>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-zinc-200 text-xs space-y-2 shadow-xs">
                <div className="font-semibold text-zinc-900 flex items-center gap-2">
                  <span>🛡️</span> Chính sách lưu trữ & Khôi phục
                </div>
                <p className="text-zinc-500 leading-relaxed">
                  Các bản sao lưu cũ hơn 7 ngày sẽ tự động được xoay vòng làm sạch. Khôi phục sẽ sử dụng lệnh `pg_restore --clean` đảm bảo tính toàn vẹn dữ liệu.
                </p>
              </div>
            </div>

            {/* Backups List */}
            <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 text-zinc-500 border-b border-zinc-200 font-medium">
                  <tr>
                    <th className="px-6 py-3.5">Backup File</th>
                    <th className="px-6 py-3.5">Size</th>
                    <th className="px-6 py-3.5">Created At</th>
                    <th className="px-6 py-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {backups.map(b => (
                    <tr key={b.filename} className="hover:bg-zinc-50/50 transition-colors">
                      <td className="px-6 py-3.5 font-mono font-medium text-zinc-900">{b.filename}</td>
                      <td className="px-6 py-3.5 text-zinc-600">{b.size_human}</td>
                      <td className="px-6 py-3.5 text-zinc-500">{new Date(b.created_at).toLocaleString()}</td>
                      <td className="px-6 py-3.5 text-right">
                        {isAdmin && (
                          <button
                            onClick={() => handleRestoreBackup(b.filename)}
                            disabled={isBackupProcessing}
                            className="px-3 py-1 bg-red-50 hover:bg-red-100 text-red-600 font-medium rounded-lg text-xs transition-colors cursor-pointer disabled:opacity-50"
                          >
                            Restore to DB
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {backups.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-10 text-center text-zinc-400">
                        {isAdmin ? "No backups generated yet. Click 'Backup Database Now' to create one." : "Backup access is restricted."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* --- MODAL: ADD / EDIT PRODUCT --- */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[2rem] border border-zinc-100 shadow-2xl max-w-lg w-full p-8 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold text-zinc-900 tracking-tight">
                {editingProduct ? "Edit Product" : "Add New Product"}
              </h3>
              <button onClick={() => setIsProductModalOpen(false)} className="w-8 h-8 rounded-full bg-zinc-100 text-zinc-500 hover:bg-zinc-200 flex items-center justify-center text-sm font-medium cursor-pointer">
                &times;
              </button>
            </div>
            <form onSubmit={handleProductSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1.5">Product Name *</label>
                <input
                  type="text" required value={productForm.name}
                  onChange={e => setProductForm({ ...productForm, name: e.target.value })}
                  placeholder="e.g. Silk Minimalist Tee"
                  className="w-full bg-zinc-50 border border-zinc-200 text-zinc-900 rounded-xl px-4 py-2 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1.5">Price ($) *</label>
                  <input
                    type="number" step="0.01" min="0" required value={productForm.price}
                    onChange={e => setProductForm({ ...productForm, price: e.target.value })}
                    placeholder="35.00"
                    className="w-full bg-zinc-50 border border-zinc-200 text-zinc-900 rounded-xl px-4 py-2 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1.5">Stock Quantity *</label>
                  <input
                    type="number" min="0" required value={productForm.stock_quantity}
                    onChange={e => setProductForm({ ...productForm, stock_quantity: e.target.value })}
                    placeholder="10"
                    className="w-full bg-zinc-50 border border-zinc-200 text-zinc-900 rounded-xl px-4 py-2 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1.5">Brand</label>
                <input
                  type="text" value={productForm.brand}
                  onChange={e => setProductForm({ ...productForm, brand: e.target.value })}
                  placeholder="e.g. Nike, Apple"
                  className="w-full bg-zinc-50 border border-zinc-200 text-zinc-900 rounded-xl px-4 py-2 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1.5">Image URL</label>
                <input
                  type="url" value={productForm.image_url}
                  onChange={e => setProductForm({ ...productForm, image_url: e.target.value })}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full bg-zinc-50 border border-zinc-200 text-zinc-900 rounded-xl px-4 py-2 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1.5">Description</label>
                <textarea
                  rows={3} value={productForm.description}
                  onChange={e => setProductForm({ ...productForm, description: e.target.value })}
                  placeholder="Product description..."
                  className="w-full bg-zinc-50 border border-zinc-200 text-zinc-900 rounded-xl p-3 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 resize-none"
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-100 mt-6">
                <button type="button" onClick={() => setIsProductModalOpen(false)} disabled={isProductSubmitting} className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-600 hover:bg-zinc-100 cursor-pointer">
                  Cancel
                </button>
                <button type="submit" disabled={isProductSubmitting} className="px-5 py-2 rounded-xl text-xs font-medium bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-50 cursor-pointer">
                  {isProductSubmitting ? "Saving..." : editingProduct ? "Save Changes" : "Create Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: ADD / EDIT BRAND --- */}
      {isBrandModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[2rem] border border-zinc-100 shadow-2xl max-w-md w-full p-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold text-zinc-900 tracking-tight">
                {editingBrand ? "Edit Brand" : "Add Brand"}
              </h3>
              <button onClick={() => setIsBrandModalOpen(false)} className="w-8 h-8 rounded-full bg-zinc-100 text-zinc-500 hover:bg-zinc-200 flex items-center justify-center text-sm font-medium cursor-pointer">
                &times;
              </button>
            </div>
            <form onSubmit={handleBrandSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Brand Name *</label>
                <input
                  type="text" required value={brandForm.name}
                  onChange={e => {
                    setBrandForm({ ...brandForm, name: e.target.value })
                    if (!editingBrand) setBrandForm(prev => ({ ...prev, name: e.target.value, slug: e.target.value.toLowerCase().replace(/\s+/g, "-") }))
                  }}
                  placeholder="e.g. Nike"
                  className="w-full bg-zinc-50 border border-zinc-200 text-zinc-900 rounded-xl px-4 py-2 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Slug URL *</label>
                <input
                  type="text" required value={brandForm.slug}
                  onChange={e => setBrandForm({ ...brandForm, slug: e.target.value })}
                  placeholder="e.g. nike"
                  className="w-full bg-zinc-50 border border-zinc-200 text-zinc-900 rounded-xl px-4 py-2 text-xs font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Logo URL</label>
                <input
                  type="url" value={brandForm.logo_url}
                  onChange={e => setBrandForm({ ...brandForm, logo_url: e.target.value })}
                  placeholder="https://..."
                  className="w-full bg-zinc-50 border border-zinc-200 text-zinc-900 rounded-xl px-4 py-2 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Official Website</label>
                <input
                  type="url" value={brandForm.website}
                  onChange={e => setBrandForm({ ...brandForm, website: e.target.value })}
                  placeholder="https://www.nike.com"
                  className="w-full bg-zinc-50 border border-zinc-200 text-zinc-900 rounded-xl px-4 py-2 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Description</label>
                <textarea
                  rows={2} value={brandForm.description}
                  onChange={e => setBrandForm({ ...brandForm, description: e.target.value })}
                  placeholder="Brand story and background..."
                  className="w-full bg-zinc-50 border border-zinc-200 text-zinc-900 rounded-xl p-3 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 resize-none"
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-100 mt-6">
                <button type="button" onClick={() => setIsBrandModalOpen(false)} disabled={isBrandSubmitting} className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-600 hover:bg-zinc-100 cursor-pointer">
                  Cancel
                </button>
                <button type="submit" disabled={isBrandSubmitting} className="px-5 py-2 rounded-xl text-xs font-medium bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-50 cursor-pointer">
                  {isBrandSubmitting ? "Saving..." : editingBrand ? "Save Changes" : "Create Brand"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: ADD / EDIT VOUCHER --- */}
      {isVoucherModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[2rem] border border-zinc-100 shadow-2xl max-w-md w-full p-8 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold text-zinc-900 tracking-tight">
                {editingVoucher ? "Edit Voucher" : "Add Voucher"}
              </h3>
              <button onClick={() => setIsVoucherModalOpen(false)} className="w-8 h-8 rounded-full bg-zinc-100 text-zinc-500 hover:bg-zinc-200 flex items-center justify-center text-sm font-medium cursor-pointer">
                &times;
              </button>
            </div>
            <form onSubmit={handleVoucherSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Coupon Code *</label>
                <input
                  type="text" required value={voucherForm.code}
                  onChange={e => setVoucherForm({ ...voucherForm, code: e.target.value.toUpperCase() })}
                  placeholder="e.g. SUMMER2026"
                  className="w-full bg-zinc-50 border border-zinc-200 text-zinc-900 rounded-xl px-4 py-2 text-xs font-mono font-bold tracking-wider focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Type *</label>
                  <select
                    value={voucherForm.discount_type}
                    onChange={e => setVoucherForm({ ...voucherForm, discount_type: e.target.value })}
                    className="w-full bg-zinc-50 border border-zinc-200 text-zinc-900 rounded-xl px-3 py-2 text-xs focus:bg-white focus:outline-none"
                  >
                    <option value="PERCENTAGE">Percentage (%)</option>
                    <option value="FIXED">Fixed Amount ($)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Discount Value *</label>
                  <input
                    type="number" step="0.01" min="0" required value={voucherForm.discount_value}
                    onChange={e => setVoucherForm({ ...voucherForm, discount_value: e.target.value })}
                    placeholder="10"
                    className="w-full bg-zinc-50 border border-zinc-200 text-zinc-900 rounded-xl px-4 py-2 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Min Order ($)</label>
                  <input
                    type="number" step="0.01" min="0" value={voucherForm.min_order_amount}
                    onChange={e => setVoucherForm({ ...voucherForm, min_order_amount: e.target.value })}
                    placeholder="0"
                    className="w-full bg-zinc-50 border border-zinc-200 text-zinc-900 rounded-xl px-4 py-2 text-xs focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Usage Limit</label>
                  <input
                    type="number" min="1" value={voucherForm.usage_limit}
                    onChange={e => setVoucherForm({ ...voucherForm, usage_limit: e.target.value })}
                    placeholder="Unlimited"
                    className="w-full bg-zinc-50 border border-zinc-200 text-zinc-900 rounded-xl px-4 py-2 text-xs focus:bg-white focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Expiration Date</label>
                <input
                  type="date" value={voucherForm.valid_until}
                  onChange={e => setVoucherForm({ ...voucherForm, valid_until: e.target.value })}
                  className="w-full bg-zinc-50 border border-zinc-200 text-zinc-900 rounded-xl px-4 py-2 text-xs focus:bg-white focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox" id="is_active_chk" checked={voucherForm.is_active}
                  onChange={e => setVoucherForm({ ...voucherForm, is_active: e.target.checked })}
                  className="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900 cursor-pointer"
                />
                <label htmlFor="is_active_chk" className="text-xs font-medium text-zinc-700 cursor-pointer">
                  Activate Voucher immediately
                </label>
              </div>
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-100 mt-6">
                <button type="button" onClick={() => setIsVoucherModalOpen(false)} disabled={isVoucherSubmitting} className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-600 hover:bg-zinc-100 cursor-pointer">
                  Cancel
                </button>
                <button type="submit" disabled={isVoucherSubmitting} className="px-5 py-2 rounded-xl text-xs font-medium bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-50 cursor-pointer">
                  {isVoucherSubmitting ? "Saving..." : editingVoucher ? "Save Changes" : "Create Voucher"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: ORDER ITEMS DETAIL --- */}
      {selectedOrderForDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[2rem] border border-zinc-100 shadow-2xl max-w-lg w-full p-8">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-lg font-semibold text-zinc-900">Order Items</h3>
                <p className="text-xs text-zinc-400 font-mono">#{selectedOrderForDetail.id}</p>
              </div>
              <button onClick={() => setSelectedOrderForDetail(null)} className="w-8 h-8 rounded-full bg-zinc-100 text-zinc-500 hover:bg-zinc-200 flex items-center justify-center text-sm font-medium cursor-pointer">
                &times;
              </button>
            </div>
            <div className="divide-y divide-zinc-100 mb-6 max-h-72 overflow-y-auto">
              {selectedOrderForDetail.items?.map(item => (
                <div key={item.id} className="py-3 flex justify-between items-center text-xs">
                  <div>
                    <span className="font-mono text-zinc-700 block">Product ID: {item.product_id}</span>
                    <span className="text-zinc-400">Quantity: {item.quantity}</span>
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
              <span className="text-xs text-zinc-500">Total Amount</span>
              <span className="text-lg font-bold text-zinc-900">${Number(selectedOrderForDetail.total_amount).toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL: ADD CATEGORY --- */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[2rem] border border-zinc-100 shadow-2xl max-w-sm w-full p-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold text-zinc-900">Add Category</h3>
              <button onClick={() => setIsCategoryModalOpen(false)} className="w-8 h-8 rounded-full bg-zinc-100 text-zinc-500 hover:bg-zinc-200 flex items-center justify-center text-sm font-medium cursor-pointer">
                &times;
              </button>
            </div>
            <form onSubmit={handleCreateCategory} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Category Name *</label>
                <input
                  type="text" required value={categoryName}
                  onChange={e => {
                    setCategoryName(e.target.value)
                    if (!categorySlug) setCategorySlug(e.target.value.toLowerCase().replace(/\s+/g, "-"))
                  }}
                  placeholder="e.g. Footwear"
                  className="w-full bg-zinc-50 border border-zinc-200 text-zinc-900 rounded-xl px-4 py-2 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Slug URL</label>
                <input
                  type="text" value={categorySlug}
                  onChange={e => setCategorySlug(e.target.value)}
                  placeholder="e.g. footwear"
                  className="w-full bg-zinc-50 border border-zinc-200 text-zinc-900 rounded-xl px-4 py-2 text-xs focus:bg-white focus:outline-none font-mono"
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-100 mt-6">
                <button type="button" onClick={() => setIsCategoryModalOpen(false)} disabled={isCategorySubmitting} className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-600 hover:bg-zinc-100 cursor-pointer">
                  Cancel
                </button>
                <button type="submit" disabled={isCategorySubmitting} className="px-5 py-2 rounded-xl text-xs font-medium bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-50 cursor-pointer">
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
