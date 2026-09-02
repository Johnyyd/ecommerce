import { useEffect } from "react"
import { motion } from "motion/react"
import { Card } from "@/components/ui/Card"
import { ArrowRight } from "@phosphor-icons/react"
import { useCartStore } from "@/store/useCartStore"
import { useProductStore } from "@/store/useProductStore"
import { useLocation } from "wouter"

export function ProductBento() {
  const [, navigate] = useLocation()
  const { products, isLoading, error, fetchProducts } = useProductStore()

  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  // Helper array to keep the bento layout asymmetrical for up to 3 items
  const bentoStyles = [
    { span: "col-span-1 md:col-span-8 row-span-2", height: "min-h-[400px] md:min-h-[600px]" },
    { span: "col-span-1 md:col-span-4 row-span-1", height: "min-h-[250px] md:min-h-[290px]" },
    { span: "col-span-1 md:col-span-4 row-span-1", height: "min-h-[250px] md:min-h-[290px]" }
  ]

  return (
    <section className="w-full px-4 md:px-12 py-32 bg-zinc-50">
      <div className="max-w-[1400px] mx-auto">
        <div className="mb-16">
          <h2 className="text-4xl md:text-5xl tracking-tighter font-medium text-zinc-950 mb-4">
            Curated Products
          </h2>
          <p className="text-lg text-zinc-500 max-w-lg">
            Discover collections designed with uncompromising attention to detail and materiality.
          </p>
        </div>

        {isLoading ? (
          <div className="text-zinc-500">Loading products...</div>
        ) : error ? (
          <div className="text-red-500">Error: {error}</div>
        ) : products.length === 0 ? (
          <div className="text-zinc-500">No products available.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 auto-rows-auto">
            {products.map((product, i) => {
              // Apply bento styles for the first 3 items, fallback for the rest
              const style = bentoStyles[i] || { span: "col-span-1 md:col-span-4 row-span-1", height: "min-h-[250px] md:min-h-[290px]" }
              
              return (
                <motion.div
                  key={product.id}
                  className={style.span}
                  initial={{ opacity: 0, y: 32 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ delay: i * 0.1, duration: 0.8, ease: [0.32, 0.72, 0, 1] }}
                >
                  <Card 
                    className={`w-full h-full group cursor-pointer ${style.height} flex flex-col justify-end p-8 relative hover:ring-2 hover:ring-zinc-200 transition-all`}
                    onClick={() => {
                        navigate(`/product/${product.id}`);
                     }}
                  >
                    <div className="absolute inset-0 bg-zinc-100 m-1.5 rounded-[calc(2rem-0.375rem)] overflow-hidden">
                       <div className="absolute inset-0 bg-gradient-to-t from-zinc-200 to-transparent mix-blend-multiply opacity-50" />
                    </div>
                    
                    <div className="relative z-10 flex items-end justify-between w-full">
                    <div className="pr-4">
                      <h3 className="text-2xl tracking-tight font-medium text-zinc-900 mb-1">{product.name}</h3>
                      <p className="text-zinc-600 line-clamp-1 mb-2">{product.description}</p>
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
                      className="flex-shrink-0 w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm text-zinc-950 transform group-hover:scale-110 transition-transform duration-apple ease-apple hover:bg-zinc-100"
                    >
                      <ArrowRight weight="bold" />
                    </button>
                  </div>
                  </Card>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
