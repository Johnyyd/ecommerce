import * as React from "react"
import { motion, AnimatePresence } from "motion/react"
import { ShoppingBag } from "@phosphor-icons/react"
import { useCartStore } from "@/store/useCartStore"
import { useAuthStore } from "@/store/useAuthStore"
import { useLocation } from "wouter"

export function Navbar() {
  const [isOpen, setIsOpen] = React.useState(false)
  const { toggleCart, items } = useCartStore()
  const { isAuthenticated, logout } = useAuthStore()
  const [, setLocation] = useLocation()
  
  const cartItemCount = items.reduce((acc, item) => acc + item.quantity, 0)
  
  const handleNav = (path: string) => {
    setIsOpen(false)
    if (path === '/logout') {
      logout()
      setLocation('/')
    } else {
      setLocation(path)
    }
  }

  const navItems = [
    { label: 'Home', path: '/' },
    { label: 'Shop', path: '/products' },
    ...(isAuthenticated 
      ? [
          { label: 'Profile', path: '/profile' },
          { label: 'Sign out', path: '/logout' }
        ]
      : [
          { label: 'Sign in', path: '/login' },
          { label: 'Sign up', path: '/register' }
        ])
  ]

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-40 flex justify-center pt-6 px-4 pointer-events-none">
        <nav className="pointer-events-auto flex items-center justify-between bg-white/70 backdrop-blur-2xl rounded-full px-6 py-3 ring-1 ring-black/5 shadow-sm min-w-[320px] gap-6">
          <div className="font-sans font-medium tracking-tight text-lg">Platform</div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={toggleCart}
              className="relative w-10 h-10 rounded-full flex items-center justify-center bg-zinc-100 hover:bg-zinc-200 transition-colors"
              aria-label="Toggle Cart"
            >
              <ShoppingBag weight="bold" />
              {cartItemCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-electric-blue text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white">
                  {cartItemCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="w-10 h-10 rounded-full flex items-center justify-center bg-zinc-100 hover:bg-zinc-200 transition-colors"
              aria-label="Toggle Menu"
            >
              <div className="relative w-5 h-5 flex flex-col justify-center items-center">
              <motion.div
                animate={isOpen ? { rotate: 45, y: 1 } : { rotate: 0, y: -3 }}
                transition={{ type: "spring", stiffness: 260, damping: 20 }}
                className="absolute w-full h-[2px] bg-zinc-950 rounded-full"
              />
              <motion.div
                animate={isOpen ? { rotate: -45, y: 1 } : { rotate: 0, y: 3 }}
                transition={{ type: "spring", stiffness: 260, damping: 20 }}
                className="absolute w-full h-[2px] bg-zinc-950 rounded-full"
              />
            </div>
          </button>
          </div>
        </nav>
      </header>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
            className="fixed inset-0 z-40 bg-zinc-950/80 backdrop-blur-3xl flex items-center justify-center"
          >
            <nav className="flex flex-col gap-8 items-center">
              {navItems.map((item, i) => (
                <div key={item.label} className="overflow-hidden">
                  <motion.button
                    onClick={() => handleNav(item.path)}
                    initial={{ y: "100%", opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: "100%", opacity: 0 }}
                    transition={{
                      delay: i * 0.1,
                      duration: 0.6,
                      ease: [0.32, 0.72, 0, 1]
                    }}
                    className="block text-4xl md:text-6xl font-medium text-white hover:text-zinc-300 transition-colors tracking-tighter"
                  >
                    {item.label}
                  </motion.button>
                </div>
              ))}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
