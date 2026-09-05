import { motion, AnimatePresence } from "motion/react"
import { X, ShoppingBag, Trash } from "@phosphor-icons/react"
import { useCartStore } from "@/store/useCartStore"
import { useAuthStore } from "@/store/useAuthStore"
import { Button } from "@/components/ui/Button"
import { useLocation } from "wouter"

export function Cart() {
  const { isOpen, items, getTotal, toggleCart, removeItem, updateQuantity } = useCartStore()
  const { isAuthenticated } = useAuthStore()
  const [, setLocation] = useLocation()
  const total = getTotal()

  const handleCheckout = () => {
    if (!isAuthenticated) {
      toggleCart()
      setLocation("/login")
      return
    }
    toggleCart()
    setLocation("/checkout")
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={toggleCart}
            className="fixed inset-0 z-50 bg-zinc-950/20 backdrop-blur-sm"
          />
          <motion.div
            initial={{ x: "100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 bottom-0 z-50 w-full md:w-[480px] bg-white shadow-2xl flex flex-col border-l border-zinc-100"
          >
            <div className="flex items-center justify-between p-6 border-b border-zinc-100">
              <div className="flex items-center gap-2">
                <ShoppingBag weight="bold" className="text-xl" />
                <h2 className="text-lg font-medium tracking-tight">Your Cart</h2>
              </div>
              <button
                onClick={toggleCart}
                className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-zinc-100 transition-colors"
              >
                <X weight="bold" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
              {items.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-zinc-400">
                  <ShoppingBag weight="light" className="text-6xl mb-4" />
                  <p>Your cart is empty.</p>
                </div>
              ) : (
                items.map((item) => (
                  <div key={item.id} className="flex gap-4">
                    <div className="w-20 h-24 bg-zinc-100 rounded-2xl flex-shrink-0 flex items-center justify-center">
                      <span className="text-xs font-mono text-zinc-400">IMG</span>
                    </div>
                    <div className="flex flex-col justify-between flex-1 py-1">
                      <div>
                        <div className="flex justify-between items-start">
                          <h3 className="font-medium text-zinc-900">{item.name}</h3>
                          <button 
                            onClick={() => removeItem(item.id)}
                            className="text-zinc-400 hover:text-red-500 transition-colors"
                          >
                            <Trash weight="bold" />
                          </button>
                        </div>
                        <p className="text-sm text-zinc-500">${item.price.toFixed(2)}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-3 bg-zinc-50 rounded-full px-3 py-1 ring-1 ring-zinc-200">
                          <button 
                            className="text-zinc-500 hover:text-zinc-900"
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          >
                            -
                          </button>
                          <span className="text-sm font-medium w-4 text-center">{item.quantity}</span>
                          <button 
                            className="text-zinc-500 hover:text-zinc-900"
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-6 border-t border-zinc-100 bg-zinc-50/50">
              <div className="flex items-center justify-between mb-6">
                <span className="font-medium text-zinc-500">Subtotal</span>
                <span className="font-medium text-xl">${total.toFixed(2)}</span>
              </div>
              <Button 
                className="w-full" 
                disabled={items.length === 0}
                onClick={handleCheckout}
              >
                Checkout
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
