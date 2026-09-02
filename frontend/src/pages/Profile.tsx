import { useEffect, useState } from "react"
import { useLocation } from "wouter"
import { useAuthStore } from "@/store/useAuthStore"
import { getUserOrders, OrderResponse } from "@/lib/api/orders"
import { Navbar } from "@/components/layout/Navbar"
import { motion } from "motion/react"

export function Profile() {
  const { user, isAuthenticated, isLoading: authLoading, logout } = useAuthStore()
  const [, setLocation] = useLocation()
  const [orders, setOrders] = useState<OrderResponse[]>([])
  const [loadingOrders, setLoadingOrders] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      setLocation("/login")
    }
  }, [isAuthenticated, authLoading, setLocation])

  useEffect(() => {
    if (isAuthenticated) {
      const fetchOrders = async () => {
        try {
          const data = await getUserOrders()
          setOrders(data)
        } catch (err: any) {
          setError(err.message || "Failed to load orders")
        } finally {
          setLoadingOrders(false)
        }
      }
      fetchOrders()
    }
  }, [isAuthenticated])

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-2 border-zinc-200 border-t-zinc-900 animate-spin" />
          <p className="text-zinc-500 text-sm font-medium">Loading profile...</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen pt-32 pb-24 px-4 md:px-12 bg-zinc-50">
        <div className="max-w-[1000px] mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
            <div>
              <h1 className="text-4xl tracking-tight font-medium text-zinc-950 mb-2">
                Hello, {user.username}
              </h1>
              <p className="text-zinc-500">
                {user.email}
              </p>
            </div>
            
            <button 
              onClick={() => {
                logout()
                setLocation("/")
              }}
              className="text-sm font-medium text-red-500 hover:text-red-600 transition-colors"
            >
              Sign out
            </button>
          </div>

          <div className="bg-white rounded-3xl p-8 md:p-12 shadow-sm border border-zinc-100">
            <h2 className="text-2xl font-medium tracking-tight text-zinc-900 mb-8">Order History</h2>
            
            {loadingOrders ? (
              <div className="text-zinc-500">Loading orders...</div>
            ) : error ? (
              <div className="text-red-500">{error}</div>
            ) : orders.length === 0 ? (
              <div className="text-zinc-500 py-8 text-center border-2 border-dashed border-zinc-100 rounded-2xl">
                You haven't placed any orders yet.
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                {orders.map((order, i) => (
                  <motion.div 
                    key={order.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="border border-zinc-100 rounded-2xl p-6 hover:border-zinc-200 transition-colors"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-6 border-b border-zinc-100">
                      <div>
                        <p className="text-xs font-mono text-zinc-400 mb-1">ORDER ID</p>
                        <p className="font-medium text-sm text-zinc-900">{order.id}</p>
                      </div>
                      <div className="flex items-center gap-6">
                        <div>
                          <p className="text-xs text-zinc-400 mb-1 uppercase tracking-wider">Status</p>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 ring-1 ring-green-600/20">
                            {order.status}
                          </span>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-zinc-400 mb-1 uppercase tracking-wider">Total</p>
                          <p className="font-medium text-zinc-900">${order.total_amount.toFixed(2)}</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-3">
                      {order.items.map((item) => (
                        <div key={item.id} className="flex justify-between items-center text-sm">
                          <div className="flex items-center gap-3 text-zinc-600">
                            <span className="font-medium text-zinc-900">{item.quantity}x</span>
                            <span>Product {item.product_id.substring(0, 8)}</span>
                          </div>
                          <span className="text-zinc-500">${item.unit_price.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  )
}
