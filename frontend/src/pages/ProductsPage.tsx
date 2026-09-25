import { useEffect, useState, useMemo, useCallback } from "react"
import { Navbar } from "@/components/layout/Navbar"
import { useProductStore } from "@/store/useProductStore"
import { Link } from "wouter"
import { motion, AnimatePresence } from "motion/react"
import {
  Funnel,
  MagnifyingGlass,
  X,
  CaretLeft,
  CaretRight,
  CaretDoubleLeft,
  CaretDoubleRight,
  ArrowClockwise,
  Package
} from "@phosphor-icons/react"
import { Button } from "@/components/ui/Button"

interface CategoryOption {
  id: string
  name: string
  slug?: string
}

export function ProductsPage() {
  const {
    products,
    isLoading,
    fetchProducts,
    filters,
    setFilters,
    clearFilters,
    page,
    total,
    limit,
    setPage
  } = useProductStore()

  const [searchTerm, setSearchTerm] = useState(filters.q || "")
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [jumpPageInput, setJumpPageInput] = useState("")
  const [categories, setCategories] = useState<CategoryOption[]>([])

  // Load categories from API for dynamic UUID-based category filtering
  useEffect(() => {
    fetch("/api/v1/categories/")
      .then(res => (res.ok ? res.json() : []))
      .then((data: CategoryOption[]) => {
        if (Array.isArray(data) && data.length > 0) {
          setCategories(data)
        }
      })
      .catch(() => {})
  }, [])

  // Initial fetch on mount
  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  // Sync local search term with store filters
  useEffect(() => {
    setSearchTerm(filters.q || "")
  }, [filters.q])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setFilters({ q: searchTerm.trim() || undefined })
    fetchProducts(1)
  }

  const handleFilterChange = (key: string, value: unknown) => {
    setFilters({ [key]: value })
    fetchProducts(1)
  }

  const handleClearFilters = () => {
    setSearchTerm("")
    clearFilters()
    fetchProducts(1)
  }

  const handlePageChange = useCallback((newPage: number) => {
    const totalPages = Math.max(1, Math.ceil(total / limit))
    if (newPage < 1 || newPage > totalPages || newPage === page) return
    setPage(newPage)
    fetchProducts(newPage)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }, [total, limit, page, setPage, fetchProducts])

  const handleJumpSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const target = parseInt(jumpPageInput, 10)
    const totalPages = Math.max(1, Math.ceil(total / limit))
    if (!isNaN(target) && target >= 1 && target <= totalPages && target !== page) {
      handlePageChange(target)
      setJumpPageInput("")
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / limit))
  const startItem = total === 0 ? 0 : (page - 1) * limit + 1
  const endItem = Math.min(page * limit, total)

  // Smart, bounded pagination range (prevents rendering 80,000+ buttons!)
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

  const hasActiveFilters = Boolean(
    filters.q ||
    filters.category_id ||
    filters.brand ||
    filters.min_price !== undefined ||
    filters.max_price !== undefined
  )

  // Shared Filter Controls for both desktop sidebar and mobile drawer
  const renderFilterControls = (isMobile = false) => (
    <div className="space-y-6">
      <form onSubmit={handleSearchSubmit} className="relative">
        <input
          type="text"
          placeholder="Search products..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 pl-10 pr-8 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 transition-all"
        />
        <MagnifyingGlass className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 w-4 h-4" />
        {searchTerm && (
          <button
            type="button"
            onClick={() => {
              setSearchTerm("")
              setFilters({ q: undefined })
              fetchProducts(1)
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </form>

      {/* Price Range */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-2.5">
          Price Range ($)
        </h3>
        <div className="flex items-center gap-2">
          <input
            type="number"
            placeholder="Min"
            className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
            value={filters.min_price !== undefined ? filters.min_price : ""}
            onChange={e =>
              handleFilterChange("min_price", e.target.value ? Number(e.target.value) : undefined)
            }
          />
          <span className="text-zinc-400 text-xs">-</span>
          <input
            type="number"
            placeholder="Max"
            className="w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
            value={filters.max_price !== undefined ? filters.max_price : ""}
            onChange={e =>
              handleFilterChange("max_price", e.target.value ? Number(e.target.value) : undefined)
            }
          />
        </div>
      </div>

      {/* Category selection */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-2.5">
          Category
        </h3>
        <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
          <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300 cursor-pointer py-1 px-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
            <input
              type="radio"
              name={isMobile ? "category_mobile" : "category_desktop"}
              checked={!filters.category_id}
              onChange={() => handleFilterChange("category_id", undefined)}
              className="accent-zinc-950 dark:accent-zinc-100"
            />
            All Categories
          </label>
          {categories.map(cat => (
            <label
              key={cat.id}
              className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300 cursor-pointer py-1 px-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <input
                type="radio"
                name={isMobile ? "category_mobile" : "category_desktop"}
                checked={filters.category_id === cat.id}
                onChange={() => handleFilterChange("category_id", cat.id)}
                className="accent-zinc-950 dark:accent-zinc-100"
              />
              <span className="truncate">{cat.name}</span>
            </label>
          ))}
        </div>
      </div>

      {hasActiveFilters && (
        <button
          onClick={handleClearFilters}
          className="text-xs text-zinc-500 hover:text-zinc-950 dark:hover:text-zinc-100 underline transition-colors cursor-pointer"
        >
          Clear all filters
        </button>
      )}
    </div>
  )

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 transition-colors">
      <Navbar />

      {/* Top indeterminate loading bar */}
      {isLoading && (
        <div className="fixed top-0 left-0 right-0 h-1 bg-zinc-200 dark:bg-zinc-800 z-50 overflow-hidden">
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: "100%" }}
            transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
            className="h-full bg-zinc-900 dark:bg-zinc-100 w-1/3"
          />
        </div>
      )}

      <main className="flex-1 pt-24 px-4 sm:px-6 md:px-12 max-w-[1600px] mx-auto w-full flex flex-col md:flex-row gap-6 md:gap-8">
        {/* Desktop Sidebar Filters */}
        <aside className="w-64 flex-shrink-0 space-y-6 hidden md:block">
          <div className="pb-3 border-b border-zinc-200 dark:border-zinc-800">
            <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
              Filters
            </h2>
          </div>
          {renderFilterControls(false)}
        </aside>

        {/* Mobile Filter Drawer Modal */}
        <AnimatePresence>
          {isSidebarOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsSidebarOpen(false)}
                className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 md:hidden"
              />
              <motion.aside
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", damping: 28, stiffness: 280 }}
                className="fixed inset-y-0 right-0 w-full max-w-xs bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 z-50 p-6 flex flex-col justify-between overflow-y-auto shadow-2xl md:hidden"
              >
                <div>
                  <div className="flex items-center justify-between pb-4 mb-4 border-b border-zinc-100 dark:border-zinc-800">
                    <h2 className="text-base font-bold text-zinc-950 dark:text-zinc-50">Filters</h2>
                    <button
                      onClick={() => setIsSidebarOpen(false)}
                      className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                      aria-label="Close filters"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  {renderFilterControls(true)}
                </div>

                <div className="pt-6 border-t border-zinc-100 dark:border-zinc-800 mt-6">
                  <button
                    onClick={() => setIsSidebarOpen(false)}
                    className="w-full py-2.5 bg-zinc-950 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 rounded-xl text-xs font-semibold shadow-xs transition-colors"
                  >
                    View Results ({total.toLocaleString()} items)
                  </button>
                </div>
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* Product Grid Area */}
        <div className="flex-1 pb-24">
          {/* Header Bar */}
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-zinc-200/80 dark:border-zinc-800">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-medium tracking-tight text-zinc-950 dark:text-zinc-50">
                Collection
              </h1>
              {total > 0 && (
                <span className="text-xs sm:text-sm font-medium px-2.5 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                  {total.toLocaleString()} {total === 1 ? "item" : "items"}
                </span>
              )}
              {isLoading && (
                <ArrowClockwise className="w-4 h-4 text-zinc-400 animate-spin" />
              )}
            </div>

            {/* Mobile Filter Toggle Button */}
            <button
              className="md:hidden flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-medium text-zinc-700 dark:text-zinc-200 shadow-xs active:scale-95 transition-all"
              onClick={() => setIsSidebarOpen(true)}
            >
              <Funnel className="w-3.5 h-3.5" />
              <span>Filters</span>
              {hasActiveFilters && (
                <span className="w-2 h-2 rounded-full bg-electric-blue" />
              )}
            </button>
          </div>

          {/* Main Grid or Skeletons or Empty */}
          {isLoading && products.length === 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3.5 sm:gap-6">
              {[...Array(limit)].map((_, i) => (
                <div key={i} className="animate-pulse space-y-3">
                  <div className="aspect-[4/5] bg-zinc-200 dark:bg-zinc-800 rounded-2xl" />
                  <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-3/4" />
                  <div className="h-3.5 bg-zinc-200 dark:bg-zinc-800 rounded w-1/3" />
                </div>
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-4">
              <div className="w-14 h-14 bg-zinc-100 dark:bg-zinc-800 rounded-2xl flex items-center justify-center mb-4 text-zinc-400">
                <Package className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-medium text-zinc-950 dark:text-zinc-50 mb-1">
                No products found
              </h3>
              <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 max-w-sm mb-6">
                We couldn't find any products matching your current filters. Try adjusting or clearing your search.
              </p>
              {hasActiveFilters && (
                <Button onClick={handleClearFilters} className="text-xs px-5 py-2">
                  Clear Filters
                </Button>
              )}
            </div>
          ) : (
            <div className="relative">
              {/* Subtle loading overlay when refetching subsequent pages */}
              {isLoading && (
                <div className="absolute inset-0 bg-white/40 dark:bg-zinc-950/40 backdrop-blur-[1px] flex items-center justify-center z-10 rounded-2xl">
                  <div className="p-3 rounded-xl bg-white dark:bg-zinc-900 shadow-md border border-zinc-200 dark:border-zinc-800 flex items-center gap-2 text-xs font-medium">
                    <ArrowClockwise className="w-4 h-4 animate-spin text-zinc-600 dark:text-zinc-300" />
                    <span>Updating products...</span>
                  </div>
                </div>
              )}

              {/* 2 columns on mobile, 3 on md, 4 on xl */}
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3.5 sm:gap-6">
                {products.map((product, index) => (
                  <motion.div
                    key={product.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(index * 0.03, 0.3), duration: 0.35 }}
                  >
                    <Link href={`/product/${product.id}`} className="group block focus:outline-none">
                      <div className="relative aspect-[4/5] bg-zinc-100 dark:bg-zinc-800/80 rounded-2xl overflow-hidden mb-3 border border-zinc-200/60 dark:border-zinc-800 transition-all duration-300 group-hover:shadow-md">
                        {product.image_url ? (
                          <img
                            src={product.image_url}
                            alt={product.name}
                            loading="lazy"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-100 dark:bg-zinc-800 text-zinc-400 font-mono text-[10px] uppercase tracking-widest gap-2">
                            <Package className="w-8 h-8 opacity-40" />
                            <span>No Image</span>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 dark:group-hover:bg-white/5 transition-colors duration-300" />
                      </div>
                      <h3 className="text-xs sm:text-sm font-medium text-zinc-950 dark:text-zinc-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {product.name}
                      </h3>
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-xs sm:text-sm font-semibold text-zinc-900 dark:text-zinc-200">
                          ${product.price.toLocaleString()}
                        </p>
                        {product.brand && (
                          <span className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wider truncate max-w-[80px]">
                            {product.brand}
                          </span>
                        )}
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>

              {/* Responsive & Fast Pagination Bar */}
              {totalPages > 1 && (
                <div className="mt-12 pt-6 border-t border-zinc-200/80 dark:border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
                  <div className="text-zinc-500 dark:text-zinc-400 text-center sm:text-left">
                    Showing <span className="font-semibold text-zinc-900 dark:text-zinc-100">{startItem.toLocaleString()}</span> to{" "}
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">{endItem.toLocaleString()}</span> of{" "}
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">{total.toLocaleString()}</span> items
                    <span className="ml-2 text-zinc-400 dark:text-zinc-500">
                      (Page {page} of {totalPages.toLocaleString()})
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-1.5">
                    {/* First Page */}
                    <button
                      onClick={() => handlePageChange(1)}
                      disabled={page === 1 || isLoading}
                      className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                      title="First Page"
                      aria-label="First Page"
                    >
                      <CaretDoubleLeft className="w-3.5 h-3.5" />
                    </button>

                    {/* Previous Page */}
                    <button
                      onClick={() => handlePageChange(page - 1)}
                      disabled={page === 1 || isLoading}
                      className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                      title="Previous Page"
                      aria-label="Previous Page"
                    >
                      <CaretLeft className="w-3.5 h-3.5" />
                    </button>

                    {/* Number buttons (bounded) */}
                    <div className="flex items-center gap-1 mx-1">
                      {paginationRange.map((num, idx) => {
                        if (num === "...") {
                          return (
                            <span key={`dots-${idx}`} className="px-1 text-zinc-400 select-none">
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
                            disabled={isLoading}
                            className={`min-w-8 h-8 px-2 rounded-lg text-xs font-semibold transition-all ${
                              isCurrent
                                ? "bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 shadow-xs"
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
                      disabled={page === totalPages || isLoading}
                      className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                      title="Next Page"
                      aria-label="Next Page"
                    >
                      <CaretRight className="w-3.5 h-3.5" />
                    </button>

                    {/* Last Page */}
                    <button
                      onClick={() => handlePageChange(totalPages)}
                      disabled={page === totalPages || isLoading}
                      className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                      title="Last Page"
                      aria-label="Last Page"
                    >
                      <CaretDoubleRight className="w-3.5 h-3.5" />
                    </button>

                    {/* Quick Jump Input */}
                    {totalPages > 5 && (
                      <form
                        onSubmit={handleJumpSubmit}
                        className="flex items-center gap-1.5 ml-2 pl-2 border-l border-zinc-200 dark:border-zinc-700"
                      >
                        <span className="text-zinc-400">Page:</span>
                        <input
                          type="number"
                          min={1}
                          max={totalPages}
                          placeholder={page.toString()}
                          value={jumpPageInput}
                          onChange={e => setJumpPageInput(e.target.value)}
                          className="w-14 px-1.5 py-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs text-center text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                        />
                        <button
                          type="submit"
                          disabled={
                            !jumpPageInput ||
                            parseInt(jumpPageInput, 10) < 1 ||
                            parseInt(jumpPageInput, 10) > totalPages ||
                            parseInt(jumpPageInput, 10) === page
                          }
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
          )}
        </div>
      </main>
    </div>
  )
}
