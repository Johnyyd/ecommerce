import { useEffect, useState } from "react"
import { Link } from "wouter"
import { motion } from "motion/react"
import { Sparkle, ShoppingBag, ArrowRight } from "@phosphor-icons/react"
import { Product } from "@/store/useProductStore"

interface ProductRecommendationsProps {
  productId: string
}

export function ProductRecommendations({ productId }: ProductRecommendationsProps) {
  const [recommendations, setRecommendations] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    const fetchRecommendations = async () => {
      try {
        setIsLoading(true)
        setError(null)
        const res = await fetch(`/api/v1/products/${productId}/recommendations?limit=4`)
        if (!res.ok) {
          throw new Error("Failed to load recommendations")
        }
        const data = await res.json()
        if (isMounted) {
          const recs = Array.isArray(data) ? data : data.recommendations || []
          setRecommendations(recs)
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message)
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    if (productId) {
      fetchRecommendations()
    }

    return () => {
      isMounted = false
    }
  }, [productId])

  if (isLoading) {
    return (
      <div className="mt-24 pt-12 border-t border-zinc-100">
        <div className="flex items-center gap-2 mb-8">
          <Sparkle className="w-5 h-5 text-amber-500 animate-spin" weight="fill" />
          <h2 className="text-2xl font-medium tracking-tight text-zinc-950">
            Curating recommendations...
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="animate-pulse bg-zinc-50 rounded-2xl p-4 flex flex-col gap-4">
              <div className="aspect-square bg-zinc-200/60 rounded-xl" />
              <div className="h-5 bg-zinc-200/60 rounded w-3/4" />
              <div className="h-4 bg-zinc-200/60 rounded w-1/3" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error || recommendations.length === 0) {
    return null // Gracefully conceal section if empty or failed
  }

  return (
    <section className="mt-24 pt-12 border-t border-zinc-100">
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-amber-600 uppercase mb-1">
            <Sparkle className="w-4 h-4" weight="fill" />
            AI & Similar Picks
          </div>
          <h2 className="text-2xl md:text-3xl font-medium tracking-tight text-zinc-950">
            Frequently Explored Together
          </h2>
        </div>
        <span className="text-sm text-zinc-500 hidden sm:inline">
          Handpicked based on community tastes
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {recommendations.map((item, index) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: index * 0.08 }}
            className="group relative flex flex-col bg-zinc-50 hover:bg-zinc-100/80 rounded-2xl p-4 transition-all duration-300 border border-zinc-200/50 hover:border-zinc-300 shadow-sm hover:shadow"
          >
            <div className="aspect-square bg-white rounded-xl relative overflow-hidden mb-4 flex items-center justify-center">
              <div className="absolute inset-0 bg-gradient-to-tr from-zinc-100/80 to-transparent mix-blend-multiply" />
              {item.image_url ? (
                <img
                  src={item.image_url}
                  alt={item.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              ) : (
                <ShoppingBag weight="thin" className="text-5xl text-zinc-300 group-hover:scale-110 transition-transform duration-300" />
              )}
            </div>

            <div className="flex-1 flex flex-col">
              <h3 className="font-medium text-zinc-900 group-hover:text-black line-clamp-1 mb-1">
                {item.name}
              </h3>
              <p className="text-sm text-zinc-500 line-clamp-2 mb-4 flex-1">
                {item.description || "Crafted with refined craftsmanship."}
              </p>
              
              <div className="flex items-center justify-between pt-2 border-t border-zinc-200/40">
                <span className="font-medium text-zinc-950 text-base">
                  ${typeof item.price === "number" ? item.price.toFixed(2) : item.price}
                </span>
                <Link href={`/products/${item.id}`}>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-700 hover:text-black group-hover:translate-x-0.5 transition-transform">
                    View <ArrowRight weight="bold" className="w-3.5 h-3.5" />
                  </span>
                </Link>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  )
}
