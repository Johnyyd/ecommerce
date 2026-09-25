import { useState, useMemo, useEffect, useRef, useCallback } from "react"
import { motion, AnimatePresence } from "motion/react"
import {
  MagnifyingGlass,
  Plus,
  PencilSimple,
  Trash,
  X,
  Package,
  CaretLeft,
  CaretRight,
  CaretDoubleLeft,
  CaretDoubleRight,
  ArrowClockwise
} from "@phosphor-icons/react"
import { toast } from "sonner"
import { ProductItem, CategoryData, ProductFormData } from "@/types/admin"
import { adminApi } from "@/services/adminApi"
import { Skeleton } from "@/components/ui/Skeleton"

const PAGE_SIZE = 100

interface AdminProductsProps {
  products: ProductItem[]
  categories: CategoryData[]
  isFetching: boolean
  onRefresh: () => Promise<void>
  totalCount?: number
}

export function AdminProducts({
  products,
  categories,
  isFetching,
  onRefresh,
  totalCount
}: AdminProductsProps) {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [items, setItems] = useState<ProductItem[]>(products)
  const [total, setTotal] = useState<number>(totalCount ?? products.length)
  const [isLoadingPage, setIsLoadingPage] = useState(false)
  const [jumpPageInput, setJumpPageInput] = useState("")

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [form, setForm] = useState<ProductFormData>({
    name: "",
    description: "",
    price: "",
    stock_quantity: "0",
    category_id: "",
    brand: "",
    image_url: ""
  })

  // Debounce search query changes
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim())
      setPage(1)
    }, 350)
    return () => clearTimeout(timer)
  }, [search])

  // Fetch page data from server
  const fetchPageData = useCallback(async (targetPage: number, query: string) => {
    setIsLoadingPage(true)
    try {
      const res = await adminApi.getProducts({
        page: targetPage,
        limit: PAGE_SIZE,
        q: query || undefined
      })
      const prods = Array.isArray(res) ? (res as ProductItem[]) : ((res as any).items || [])
      const count = typeof (res as any).total === "number" ? (res as any).total : prods.length
      setItems(prods)
      setTotal(count)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load products"
      toast.error(msg)
    } finally {
      setIsLoadingPage(false)
    }
  }, [])

  // Avoid refetching on mount if initial products are already provided
  const isInitialMount = useRef(true)

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      if (products && products.length > 0) {
        setItems(products)
        setTotal(totalCount ?? products.length)
        return
      }
    }
    fetchPageData(page, debouncedSearch)
  }, [page, debouncedSearch, fetchPageData])

  // Keep in sync with parent when page is 1 and no search query active
  useEffect(() => {
    if (page === 1 && !debouncedSearch && products.length > 0) {
      setItems(products)
      setTotal(totalCount ?? products.length)
    }
  }, [products, totalCount, page, debouncedSearch])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const startItem = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const endItem = Math.min(page * PAGE_SIZE, total)

  // Smart pagination button list
  const paginationRange = useMemo(() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1)
    }

    if (page <= 4) {
      return [1, 2, 3, 4, 5, "...", totalPages]
    }

    if (page >= totalPages - 3) {
      return [1, "...", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages]
    }

    return [1, "...", page - 1, page, page + 1, "...", totalPages]
  }, [page, totalPages])

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages || newPage === page) return
    setPage(newPage)
  }

  const handleJumpSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const target = parseInt(jumpPageInput, 10)
    if (!isNaN(target) && target >= 1 && target <= totalPages) {
      setPage(target)
      setJumpPageInput("")
    }
  }

  const handleOpenAdd = () => {
    setEditingProduct(null)
    setForm({ name: "", description: "", price: "", stock_quantity: "0", category_id: "", brand: "", image_url: "" })
    setIsModalOpen(true)
  }

  const handleOpenEdit = (prod: ProductItem) => {
    setEditingProduct(prod)
    setForm({
      name: prod.name,
      description: prod.description || "",
      price: prod.price.toString(),
      stock_quantity: (prod.stock_quantity ?? 0).toString(),
      category_id: prod.category_id || "",
      brand: prod.brand || "",
      image_url: prod.image_url || ""
    })
    setIsModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) {
      toast.error("Product name is required")
      return
    }

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      price: parseFloat(form.price) || 0,
      stock_quantity: parseInt(form.stock_quantity, 10) || 0,
      category_id: form.category_id || null,
      brand: form.brand.trim() || null,
      image_url: form.image_url.trim() || null
    }

    setIsSubmitting(true)
    try {
      if (editingProduct) {
        await adminApi.updateProduct(editingProduct.id, payload)
        toast.success("Product updated successfully")
      } else {
        await adminApi.createProduct(payload)
        toast.success("Product created successfully")
      }
      setIsModalOpen(false)
      await fetchPageData(page, debouncedSearch)
      await onRefresh()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error saving product"
      toast.error(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete "${name}"?`)) return
    try {
      await adminApi.deleteProduct(id)
      toast.success("Product deleted successfully")
      await fetchPageData(page, debouncedSearch)
      await onRefresh()
    } catch {
      toast.error("Failed to delete product")
    }
  }

  const isTableLoading = (isFetching && items.length === 0) || isLoadingPage

  return (
    <div className="space-y-6">
      {/* Top action bar */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <h3 className="font-bold text-lg text-zinc-900 dark:text-zinc-50">Store Catalog</h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Manage product inventory, pricing, and merchandising ({total.toLocaleString()} total items • {PAGE_SIZE} per page)
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-72">
            <MagnifyingGlass
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400"
            />
            <input
              type="text"
              placeholder="Search products..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 rounded-xl text-xs placeholder-zinc-400 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-zinc-100/10 transition-all shadow-xs"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-0.5"
                title="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl text-xs font-semibold hover:bg-zinc-800 dark:hover:bg-zinc-200 active:scale-[0.98] transition-all shadow-xs shrink-0 cursor-pointer"
          >
            <Plus size={16} weight="bold" />
            Add Product
          </button>
        </div>
      </div>

      {/* Products Table Card */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl overflow-hidden shadow-xs">
        {isTableLoading && items.length === 0 ? (
          <div className="p-6 space-y-4">
            {[1, 2, 3, 4, 5].map(i => (
              <Skeleton key={i} className="h-12 w-full rounded-xl" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="p-16 text-center text-zinc-400 dark:text-zinc-500">
            <Package size={36} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm font-medium">No products found</p>
            {debouncedSearch && (
              <button
                onClick={() => setSearch("")}
                className="mt-2 text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                Clear search filter
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto relative">
            {isLoadingPage && (
              <div className="absolute inset-0 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-[1px] flex items-center justify-center z-10">
                <ArrowClockwise size={24} className="animate-spin text-zinc-600 dark:text-zinc-300" />
              </div>
            )}
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-50/70 dark:bg-zinc-800/40 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider border-b border-zinc-100 dark:border-zinc-800">
                <tr>
                  <th className="py-3.5 px-5">Product</th>
                  <th className="py-3.5 px-5">Brand</th>
                  <th className="py-3.5 px-5">Price</th>
                  <th className="py-3.5 px-5">Stock</th>
                  <th className="py-3.5 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/70 text-zinc-700 dark:text-zinc-300">
                {items.map(prod => (
                  <tr key={prod.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-3">
                        {prod.image_url ? (
                          <img
                            src={prod.image_url}
                            alt={prod.name}
                            className="w-10 h-10 rounded-lg object-cover bg-zinc-100 dark:bg-zinc-800 border border-zinc-200/50 dark:border-zinc-700/50"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400">
                            <Package size={20} />
                          </div>
                        )}
                        <div>
                          <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                            {prod.name}
                          </div>
                          {prod.description && (
                            <div className="text-xs text-zinc-400 line-clamp-1 max-w-xs">
                              {prod.description}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-5 text-xs text-zinc-500 dark:text-zinc-400">
                      {prod.brand || "—"}
                    </td>
                    <td className="py-3.5 px-5 font-semibold text-zinc-900 dark:text-zinc-100">
                      ${prod.price.toFixed(2)}
                    </td>
                    <td className="py-3.5 px-5">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                          (prod.stock_quantity ?? 0) <= 5
                            ? "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400 border-rose-200 dark:border-rose-800/50"
                            : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50"
                        }`}
                      >
                        {prod.stock_quantity ?? 0} in stock
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(prod)}
                          className="p-2 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors active:scale-95"
                          title="Edit product"
                        >
                          <PencilSimple size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(prod.id, prod.name)}
                          className="p-2 rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors active:scale-95"
                          title="Delete product"
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

        {/* Pagination Bar */}
        {total > 0 && (
          <div className="border-t border-zinc-100 dark:border-zinc-800/80 px-5 py-3.5 flex flex-col md:flex-row items-center justify-between gap-4 bg-zinc-50/50 dark:bg-zinc-800/20 text-xs">
            <div className="text-zinc-500 dark:text-zinc-400">
              Showing <span className="font-semibold text-zinc-900 dark:text-zinc-100">{startItem.toLocaleString()}</span> to{" "}
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">{endItem.toLocaleString()}</span> of{" "}
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">{total.toLocaleString()}</span> products
              {totalPages > 1 && (
                <span className="ml-2 text-zinc-400">
                  (Page {page} of {totalPages.toLocaleString()})
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {/* First Page */}
              <button
                onClick={() => handlePageChange(1)}
                disabled={page === 1 || isLoadingPage}
                className="p-1.5 rounded-lg border border-zinc-200/80 dark:border-zinc-700/80 text-zinc-600 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                title="First Page"
              >
                <CaretDoubleLeft size={14} weight="bold" />
              </button>

              {/* Previous Page */}
              <button
                onClick={() => handlePageChange(page - 1)}
                disabled={page === 1 || isLoadingPage}
                className="p-1.5 rounded-lg border border-zinc-200/80 dark:border-zinc-700/80 text-zinc-600 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                title="Previous Page"
              >
                <CaretLeft size={14} weight="bold" />
              </button>

              {/* Number Buttons */}
              <div className="flex items-center gap-1 mx-1">
                {paginationRange.map((num, idx) => {
                  if (num === "...") {
                    return (
                      <span key={`dots-${idx}`} className="px-1.5 text-zinc-400 select-none">
                        ...
                      </span>
                    )
                  }
                  const pageNum = num as number
                  const isCurrent = pageNum === page
                  return (
                    <button
                      key={pageNum}
                      onClick={() => handlePageChange(pageNum)}
                      disabled={isLoadingPage}
                      className={`min-w-8 h-8 px-2 rounded-lg text-xs font-semibold transition-all ${
                        isCurrent
                          ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-xs"
                          : "text-zinc-600 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-800 border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700"
                      }`}
                    >
                      {pageNum.toLocaleString()}
                    </button>
                  )
                })}
              </div>

              {/* Next Page */}
              <button
                onClick={() => handlePageChange(page + 1)}
                disabled={page === totalPages || isLoadingPage}
                className="p-1.5 rounded-lg border border-zinc-200/80 dark:border-zinc-700/80 text-zinc-600 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                title="Next Page"
              >
                <CaretRight size={14} weight="bold" />
              </button>

              {/* Last Page */}
              <button
                onClick={() => handlePageChange(totalPages)}
                disabled={page === totalPages || isLoadingPage}
                className="p-1.5 rounded-lg border border-zinc-200/80 dark:border-zinc-700/80 text-zinc-600 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                title="Last Page"
              >
                <CaretDoubleRight size={14} weight="bold" />
              </button>

              {/* Jump to Page Form */}
              {totalPages > 1 && (
                <form
                  onSubmit={handleJumpSubmit}
                  className="flex items-center gap-1.5 ml-2 pl-2 border-l border-zinc-200 dark:border-zinc-700/80"
                >
                  <span className="text-zinc-400">Page:</span>
                  <input
                    type="number"
                    min={1}
                    max={totalPages}
                    placeholder={page.toString()}
                    value={jumpPageInput}
                    onChange={e => setJumpPageInput(e.target.value)}
                    className="w-16 px-2 py-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs text-center text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                  />
                  <button
                    type="submit"
                    disabled={!jumpPageInput || parseInt(jumpPageInput, 10) < 1 || parseInt(jumpPageInput, 10) > totalPages || parseInt(jumpPageInput, 10) === page}
                    className="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 rounded-lg text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  >
                    Go
                  </button>
                </form>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal Add / Edit Product */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
              className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl p-6 w-full max-w-lg shadow-xl relative"
            >
              <div className="flex justify-between items-center pb-4 border-b border-zinc-100 dark:border-zinc-800">
                <h3 className="font-bold text-lg text-zinc-900 dark:text-zinc-50">
                  {editingProduct ? "Edit Product" : "Add New Product"}
                </h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="mt-4 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Product Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3.5 py-2 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-electric-blue/30 focus:border-electric-blue transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Price ($) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={form.price}
                      onChange={e => setForm({ ...form, price: e.target.value })}
                      className="w-full px-3.5 py-2 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-electric-blue/30 focus:border-electric-blue transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Stock Quantity *
                    </label>
                    <input
                      type="number"
                      required
                      value={form.stock_quantity}
                      onChange={e => setForm({ ...form, stock_quantity: e.target.value })}
                      className="w-full px-3.5 py-2 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-electric-blue/30 focus:border-electric-blue transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Category
                  </label>
                  <select
                    value={form.category_id}
                    onChange={e => setForm({ ...form, category_id: e.target.value })}
                    className="w-full px-3.5 py-2 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-zinc-900/10 dark:focus:ring-zinc-100/10 focus:border-zinc-900 transition-all cursor-pointer"
                  >
                    <option value="">-- No Category --</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Brand Name
                  </label>
                  <input
                    type="text"
                    value={form.brand}
                    onChange={e => setForm({ ...form, brand: e.target.value })}
                    className="w-full px-3.5 py-2 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-electric-blue/30 focus:border-electric-blue transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Image URL
                  </label>
                  <input
                    type="url"
                    value={form.image_url}
                    onChange={e => setForm({ ...form, image_url: e.target.value })}
                    className="w-full px-3.5 py-2 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-electric-blue/30 focus:border-electric-blue transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Description
                  </label>
                  <textarea
                    rows={3}
                    value={form.description}
                    onChange={e => setForm({ ...form, description: e.target.value })}
                    className="w-full px-3.5 py-2 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-electric-blue/30 focus:border-electric-blue transition-all resize-none"
                  />
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
                    {isSubmitting ? "Saving..." : editingProduct ? "Update Product" : "Create Product"}
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
