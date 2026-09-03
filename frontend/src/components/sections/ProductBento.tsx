import { useEffect } from "react"
import { motion } from "motion/react"
import { Card } from "@/components/ui/Card"
import { ArrowRight, CaretLeft, CaretRight } from "@phosphor-icons/react"
import { useCartStore } from "@/store/useCartStore"
import { useProductStore } from "@/store/useProductStore"
import { useLocation } from "wouter"

export function ProductBento() {
  const [, navigate] = useLocation()
  const { products, isLoading, error, fetchProducts, page, total, limit, setPage } = useProductStore()

  useEffect(() => {
    fetchProducts(page)
  }, [fetchProducts, page])

  const totalPages = Math.ceil(total / limit)

  return (
    <section className="w-full px-4 md:px-12 py-32 bg-zinc-50 min-h-screen">
      <div className="max-w-[1400px] mx-auto flex flex-col min-h-full">
        <div className="mb-16 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h2 className="text-4xl md:text-5xl tracking-tighter font-medium text-zinc-950 mb-4">
              Curated Products
            </h2>
            <p className="text-lg text-zinc-500 max-w-lg">
              Discover collections designed with uncompromising attention to detail and materiality.
            </p>
          </div>
          
          {totalPages > 1 && (
            <div className="flex items-center gap-4 text-sm font-medium text-zinc-600">
              <button 
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-white shadow-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-100 transition-colors"
              >
                <CaretLeft weight="bold" className="w-5 h-5" />
              </button>
              <span>Page {page} of {totalPages}</span>
              <button 
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-white shadow-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-100 transition-colors"
              >
                <CaretRight weight="bold" className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center text-zinc-500 h-96">
            <motion.div 
              animate={{ opacity: [0.5, 1, 0.5] }} 
              transition={{ repeat: Infinity, duration: 1.5 }}
            >
              Loading products...
            </motion.div>
          </div>
        ) : error ? (
          <div className="flex-1 flex items-center justify-center text-red-500 h-96">
            Error: {error}
          </div>
        ) : products.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-zinc-500 h-96">
            No products available.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 flex-1">
            {products.map((product, i) => (
              <motion.div
                key={product.id}
                className="col-span-1"
                initial={{ opacity: 0, y: 32 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.8, ease: [0.32, 0.72, 0, 1] }}
              >
                <Card 
                  className="w-full h-full group cursor-pointer min-h-[400px] flex flex-col justify-end p-8 relative overflow-hidden transition-all duration-500 hover:shadow-2xl hover:shadow-zinc-200/50 hover:-translate-y-1"
                  onClick={() => {
                      navigate(`/product/${product.id}`);
                   }}
                >
                  <div className="absolute inset-0 bg-zinc-100/50 m-2 rounded-[calc(2rem-0.5rem)] overflow-hidden transition-transform duration-700 group-hover:scale-[1.02]">
                     <div className="absolute inset-0 bg-gradient-to-t from-zinc-200/80 to-transparent mix-blend-multiply opacity-50" />
                     {/* Placeholder for actual image */}
                  </div>
                  
                  <div className="relative z-10 flex items-end justify-between w-full backdrop-blur-md bg-white/40 p-6 rounded-2xl border border-white/50 shadow-sm">
                    <div className="pr-4">
                      <h3 className="text-xl tracking-tight font-semibold text-zinc-900 mb-1">{product.name}</h3>
                      <p className="text-zinc-600 line-clamp-1 mb-2 text-sm">{product.description}</p>
                      <p className="text-zinc-900 font-medium">${product.price}</p>
                    </div>
                    
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        useCartStore.getState().addItem({
                          id: product.id,
                          name: product.name,
                          price: product.price,
                          quantity: 1
                        });
                      }}
                      className="flex-shrink-0 w-12 h-12 rounded-full bg-zinc-900 flex items-center justify-center text-white transform group-hover:scale-110 group-hover:bg-electric-blue transition-all duration-300 ease-out shadow-lg"
                    >
                      <ArrowRight weight="bold" />
                    </button>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
