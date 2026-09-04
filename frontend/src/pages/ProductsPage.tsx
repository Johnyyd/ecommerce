import { useEffect, useState } from "react"
import { Navbar } from "@/components/layout/Navbar"
import { useProductStore } from "@/store/useProductStore"
import { Link } from "wouter"
import { motion } from "motion/react"
import { Funnel, MagnifyingGlass, X } from "@phosphor-icons/react"
import { Button } from "@/components/ui/Button"

export function ProductsPage() {
  const { products, isLoading, fetchProducts, filters, setFilters, clearFilters, page, total, limit, setPage } = useProductStore()
  const [searchTerm, setSearchTerm] = useState(filters.q || "")
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setFilters({ q: searchTerm })
    fetchProducts()
  }

  const handleFilterChange = (key: string, value: any) => {
    setFilters({ [key]: value })
    fetchProducts()
  }

  const handleClearFilters = () => {
    setSearchTerm("")
    clearFilters()
    fetchProducts()
  }

  const handlePageChange = (newPage: number) => {
    setPage(newPage)
    fetchProducts(newPage)
  }

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50">
      <Navbar />
      
      <main className="flex-1 pt-24 px-4 md:px-12 max-w-[1600px] mx-auto w-full flex gap-8">
        {/* Sidebar Filters */}
        <aside className={`w-full md:w-64 flex-shrink-0 space-y-8 ${isSidebarOpen ? 'block' : 'hidden md:block'}`}>
          <div className="flex items-center justify-between md:hidden">
            <h2 className="text-xl font-medium">Filters</h2>
            <button onClick={() => setIsSidebarOpen(false)}>
              <X className="w-6 h-6" />
            </button>
          </div>

          <form onSubmit={handleSearch} className="relative">
            <input
              type="text"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-zinc-200 rounded-xl px-4 py-3 pl-10 focus:outline-none focus:ring-2 focus:ring-zinc-950 transition-all"
            />
            <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 w-5 h-5" />
          </form>

          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-medium text-zinc-950 mb-3">Price Range</h3>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="Min"
                  className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                  value={filters.min_price || ''}
                  onChange={(e) => handleFilterChange('min_price', e.target.value ? Number(e.target.value) : undefined)}
                />
                <span className="text-zinc-400">-</span>
                <input
                  type="number"
                  placeholder="Max"
                  className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
                  value={filters.max_price || ''}
                  onChange={(e) => handleFilterChange('max_price', e.target.value ? Number(e.target.value) : undefined)}
                />
              </div>
            </div>

            {/* Example static categories */}
            <div>
              <h3 className="text-sm font-medium text-zinc-950 mb-3">Category</h3>
              <div className="space-y-2">
                {['Electronics', 'Fashion', 'Home'].map((cat) => (
                  <label key={cat} className="flex items-center gap-2 text-sm text-zinc-600 cursor-pointer">
                    <input
                      type="radio"
                      name="category"
                      checked={filters.category_id === cat} // Using name as ID for mock
                      onChange={() => handleFilterChange('category_id', cat)}
                      className="accent-zinc-950"
                    />
                    {cat}
                  </label>
                ))}
              </div>
            </div>

            {Object.keys(filters).length > 0 && (
              <button
                onClick={handleClearFilters}
                className="text-sm text-zinc-500 underline hover:text-zinc-950 transition-colors"
              >
                Clear all filters
              </button>
            )}
          </div>
        </aside>

        {/* Product Grid */}
        <div className="flex-1 pb-24">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-medium tracking-tight text-zinc-950">
              Collection {total > 0 && <span className="text-zinc-400 text-xl font-normal ml-2">({total})</span>}
            </h1>
            <button 
              className="md:hidden flex items-center gap-2 text-sm font-medium"
              onClick={() => setIsSidebarOpen(true)}
            >
              <Funnel className="w-4 h-4" />
              Filters
            </button>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="aspect-[4/5] bg-zinc-200 rounded-2xl mb-4" />
                  <div className="h-4 bg-zinc-200 rounded w-2/3 mb-2" />
                  <div className="h-4 bg-zinc-200 rounded w-1/3" />
                </div>
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mb-4">
                <MagnifyingGlass className="w-8 h-8 text-zinc-400" />
              </div>
              <h3 className="text-xl font-medium text-zinc-950 mb-2">No products found</h3>
              <p className="text-zinc-500 max-w-md">
                We couldn't find any products matching your current filters. Try adjusting your search criteria.
              </p>
              <Button onClick={handleClearFilters} className="mt-6">
                Clear Filters
              </Button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {products.map((product, index) => (
                  <motion.div
                    key={product.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05, duration: 0.5 }}
                  >
                    <Link href={`/product/${product.id}`}>
                      <a className="group block">
                        <div className="relative aspect-[4/5] bg-zinc-100 rounded-2xl overflow-hidden mb-4 border border-zinc-200/50">
                          {product.image_url ? (
                            <img
                              src={product.image_url}
                              alt={product.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-zinc-200/50 text-zinc-400 font-mono text-xs uppercase tracking-widest">
                              No Image
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors duration-500" />
                        </div>
                        <h3 className="text-sm font-medium text-zinc-950 truncate">{product.name}</h3>
                        <p className="text-sm text-zinc-500 mt-1">${product.price.toLocaleString()}</p>
                      </a>
                    </Link>
                  </motion.div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-16">
                  <button
                    onClick={() => handlePageChange(page - 1)}
                    disabled={page === 1}
                    className="px-4 py-2 rounded-lg border border-zinc-200 text-sm font-medium disabled:opacity-50 hover:bg-zinc-50 transition-colors"
                  >
                    Previous
                  </button>
                  <div className="flex items-center gap-1">
                    {[...Array(totalPages)].map((_, i) => (
                      <button
                        key={i}
                        onClick={() => handlePageChange(i + 1)}
                        className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${
                          page === i + 1
                            ? 'bg-zinc-950 text-white'
                            : 'hover:bg-zinc-100 text-zinc-600'
                        }`}
                      >
                        {i + 1}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => handlePageChange(page + 1)}
                    disabled={page === totalPages}
                    className="px-4 py-2 rounded-lg border border-zinc-200 text-sm font-medium disabled:opacity-50 hover:bg-zinc-50 transition-colors"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  )
}
