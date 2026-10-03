"use client"

import { motion, AnimatePresence } from "motion/react"
import { X, ShoppingBag, Trash, CaretLeft, CaretRight } from "@phosphor-icons/react"
import { useCartStore } from "@/store/useCartStore"
import { useAuthStore } from "@/store/useAuthStore"
import { Button } from "@/components/ui/Button"
import { useLocation } from "wouter"
import { useState, useEffect } from "react"

export const CartDrawer = () => {
  const { isOpen, items, getTotal, toggleCart, removeItem, updateQuantity } = useCartStore()
  const { isAuthenticated } = useAuthStore()
  const [, setLocation] = useLocation()
  const [isMobile, setIsMobile] = useState(false)
  const total = getTotal()

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  const handleCheckout = () => {
    if (!isAuthenticated) {
      toggleCart()
      setLocation("/login")
      return
    }
    toggleCart()
    setLocation("/checkout")
  }

  const handleSwipeClose = () => {
    if (isMobile) {
      toggleCart()
    }
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
            className={`fixed top-0 right-0 bottom-0 z-50 flex flex-col bg-white dark:bg-zinc-900 shadow-2xl border-l border-zinc-100 dark:border-zinc-800 text-zinc-900 dark:text-zinc-50 ${
              isMobile ? "w-full" : "w-full md:w-[480px]"
            }`}
            onTouchStart={(e) => { /* Track touch start for swipe detection */ }}
            onTouchEnd={handleSwipeClose}
          >
            {/* Mobile drag handle */}
            {isMobile && (
              <div className="flex justify-center pt-3 pb-2 -mx-6 mx-6">
                <div className="w-10 h-1 bg-zinc-200 dark:bg-zinc-700 rounded-full" />
              </div>
            )}

            <div className="flex items-center justify-between p-6 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <ShoppingBag weight="bold" className="text-xl text-zinc-900 dark:text-zinc-100" />
                <h2 data-testid="cart-drawer-title" className="text-lg font-medium tracking-tight text-zinc-900 dark:text-zinc-100">Your Cart</h2>
              </div>
              <button
                onClick={toggleCart}
                className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 transition-colors touch-active min-h-touch min-w-touch"
                aria-label="Close Cart"
              >
                <X weight="bold" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
              {items.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-zinc-400 dark:text-zinc-500">
                  <ShoppingBag weight="light" className="text-6xl mb-4" />
                  <p>Your cart is empty.</p>
                </div>
              ) : (
                items.map((item) => (
                  <div key={item.id} className="flex gap-4">
                    <div className="w-20 h-24 bg-zinc-100 dark:bg-zinc-800 rounded-2xl flex-shrink-0 flex items-center justify-center">
                      <span className="text-xs font-mono text-zinc-400 dark:text-zinc-500">IMG</span>
                    </div>
                    <div className="flex flex-col justify-between flex-1 py-1">
                      <div>
                        <div className="flex justify-between items-start">
                          <h3 className="font-medium text-zinc-900 dark:text-zinc-100">{item.name}</h3>
                          <button
                            onClick={() => removeItem(item.id)}
                            className="text-zinc-400 hover:text-red-500 transition-colors touch-active min-h-touch min-w-touch"
                          >
                            <Trash weight="bold" />
                          </button>
                        </div>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">${item.price.toFixed(2)}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-3 bg-zinc-50 dark:bg-zinc-800 rounded-full px-4 py-2 ring-1 ring-zinc-200 dark:ring-zinc-700 min-h-touch">
                          <button
                            className="text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 touch-active min-h-touch min-w-touch flex items-center justify-center"
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            aria-label="Decrease quantity"
                          >
                            <CaretLeft weight="bold" className="w-4 h-4" />
                          </button>
                          <span className="text-sm font-medium w-6 text-center text-zinc-900 dark:text-zinc-100">{item.quantity}</span>
                          <button
                            className="text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 touch-active min-h-touch min-w-touch flex items-center justify-center"
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            aria-label="Increase quantity"
                          >
                            <CaretRight weight="bold" className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-6 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
              <div className="flex items-center justify-between mb-6">
                <span className="font-medium text-zinc-500 dark:text-zinc-400">Subtotal</span>
                <span className="font-medium text-xl text-zinc-900 dark:text-zinc-100">${total.toFixed(2)}</span>
              </div>
              <Button
                className="w-full min-h-touch-lg"
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