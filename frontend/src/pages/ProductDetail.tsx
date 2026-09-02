import { useEffect, useState } from "react"
import { Link, useParams } from "wouter"
import { motion } from "motion/react"
import { ArrowLeft, ShoppingBag } from "@phosphor-icons/react"
import { useCartStore } from "@/store/useCartStore"
import { Product } from "@/store/useProductStore"
import { Button } from "@/components/ui/Button"
import { Navbar } from "@/components/layout/Navbar"
import { Cart } from "@/components/layout/Cart"

export function ProductDetail({ params: propsParams }: { params?: { id: string } }) {
  const routerParams = useParams()
  const id = propsParams?.id || routerParams?.id

  const [product, setProduct] = useState<Product | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { addItem } = useCartStore()

  useEffect(() => {
    if (!id) {
      setIsLoading(false)
      setError("Product ID is missing in URL")
      return
    }

    const fetchProduct = async () => {
      try {
        setIsLoading(true)
        const res = await fetch(`/api/v1/products/${id}`)
        if (!res.ok) throw new Error("Product not found")
        const data = await res.json()
        setProduct(data)
      } catch (err: any) {
        setError(err.message)
      } finally {
        setIsLoading(false)
      }
    }

    fetchProduct()
  }, [id])

  return (
    <>
      <Navbar />
      <Cart />
      
      <main className="min-h-screen pt-24 pb-16 px-4 md:px-12 bg-white selection:bg-zinc-200">
        <div className="max-w-[1200px] mx-auto">
          <Link href="/">
            <button className="flex items-center gap-2 text-zinc-500 hover:text-zinc-900 transition-colors mb-12">
              <ArrowLeft weight="bold" />
              <span className="font-medium text-sm">Back to storefront</span>
            </button>
          </Link>

          {isLoading ? (
            <div className="animate-pulse flex flex-col md:flex-row gap-12">
              <div className="w-full md:w-1/2 aspect-square bg-zinc-100 rounded-3xl" />
              <div className="w-full md:w-1/2 flex flex-col gap-4 py-8">
                <div className="h-10 bg-zinc-100 rounded w-3/4" />
                <div className="h-6 bg-zinc-100 rounded w-1/4 mb-8" />
                <div className="h-24 bg-zinc-100 rounded w-full" />
              </div>
            </div>
          ) : error || !product ? (
            <div className="text-center py-32">
              <h1 className="text-2xl font-medium text-zinc-900 mb-2">Product not found</h1>
              <p className="text-zinc-500">{error}</p>
            </div>
          ) : (
            <div className="flex flex-col md:flex-row gap-12 lg:gap-24">
              {/* Product Image Side */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: [0.32, 0.72, 0, 1] }}
                className="w-full md:w-1/2 aspect-square bg-zinc-50 rounded-[2.5rem] relative overflow-hidden flex items-center justify-center"
              >
                {/* Decorative gradient since we don't have real images */}
                <div className="absolute inset-0 bg-gradient-to-tr from-zinc-200/50 to-transparent mix-blend-multiply" />
                <ShoppingBag weight="thin" className="text-[12rem] text-zinc-200" />
              </motion.div>

              {/* Product Info Side */}
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8, delay: 0.1, ease: [0.32, 0.72, 0, 1] }}
                className="w-full md:w-1/2 flex flex-col justify-center py-8"
              >
                <h1 className="text-4xl md:text-5xl font-medium tracking-tight text-zinc-950 mb-4">
                  {product.name}
                </h1>
                
                <p className="text-2xl text-zinc-900 mb-8">
                  ${product.price}
                </p>

                <div className="prose prose-zinc prose-p:text-zinc-500 mb-12">
                  <p className="text-lg leading-relaxed">
                    {product.description || "No description available for this product. It is beautifully crafted with premium materials."}
                  </p>
                </div>

                <div className="pt-8 border-t border-zinc-100 mt-auto">
                  <div className="flex items-center justify-between mb-6">
                    <span className="text-sm font-medium text-zinc-500">
                      {product.stock_quantity > 0 ? `${product.stock_quantity} in stock` : "Out of stock"}
                    </span>
                  </div>
                  
                  <Button 
                    className="w-full py-6 text-lg rounded-2xl"
                    disabled={product.stock_quantity === 0}
                    onClick={() => {
                      addItem({
                        id: product.id,
                        name: product.name,
                        price: product.price,
                        quantity: 1
                      })
                    }}
                  >
                    Add to Bag
                  </Button>
                </div>
              </motion.div>
            </div>
          )}
        </div>
      </main>
    </>
  )
}
