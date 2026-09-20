import * as React from "react"
import { motion, AnimatePresence } from "motion/react"
import { ShoppingBag, Sun, Moon } from "@phosphor-icons/react"
import { useCartStore } from "@/store/useCartStore"
import { useAuthStore } from "@/store/useAuthStore"
import { useThemeStore } from "@/store/useThemeStore"
import { useLocation } from "wouter"
import { Cart } from "@/components/layout/Cart"

export function Navbar() {
  const [isOpen, setIsOpen] = React.useState(false)
  const { toggleCart, items } = useCartStore()
  const { user, isAuthenticated, logout } = useAuthStore()
  const { isDark, toggleTheme } = useThemeStore()
  const [, setLocation] = useLocation()
  
  const cartItemCount = items.reduce((acc, item) => acc + item.quantity, 0)

  const hasAdminSession = user?.role === 'admin' || user?.role === 'manager'
  
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
    ...(hasAdminSession ? [{ label: 'Admin Portal', path: '/admin' }] : []),
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
        <nav className="pointer-events-auto flex items-center justify-between bg-white/80 dark:bg-zinc-900/80 backdrop-blur-2xl rounded-full px-6 py-3 ring-1 ring-black/5 dark:ring-white/10 shadow-sm min-w-[340px] gap-6 transition-colors duration-200">
          <div className="font-sans font-medium tracking-tight text-lg text-zinc-900 dark:text-zinc-100">Platform</div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="w-10 h-10 rounded-full flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 transition-all active:scale-95"
              aria-label="Toggle Theme"
            >
              {isDark ? (
                <Sun weight="bold" className="w-5 h-5 text-amber-400" />
              ) : (
                <Moon weight="bold" className="w-5 h-5" />
              )}
            </button>
            <button
              onClick={toggleCart}
              className="relative w-10 h-10 rounded-full flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 transition-all active:scale-95"
              aria-label="Toggle Cart"
            >
              <ShoppingBag weight="bold" className="w-5 h-5" />
              {cartItemCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-electric-blue text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white dark:border-zinc-900">
                  {cartItemCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="w-10 h-10 rounded-full flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all active:scale-95"
              aria-label="Toggle Menu"
            >
              <div className="relative w-5 h-5 flex flex-col justify-center items-center">
                <motion.div
                  animate={isOpen ? { rotate: 45, y: 1 } : { rotate: 0, y: -3 }}
                  transition={{ type: "spring", stiffness: 260, damping: 20 }}
                  className="absolute w-full h-[2px] bg-zinc-950 dark:bg-zinc-100 rounded-full"
                />
                <motion.div
                  animate={isOpen ? { rotate: -45, y: 1 } : { rotate: 0, y: 3 }}
                  transition={{ type: "spring", stiffness: 260, damping: 20 }}
                  className="absolute w-full h-[2px] bg-zinc-950 dark:bg-zinc-100 rounded-full"
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
                    className="text-4xl md:text-5xl font-sans tracking-tight text-white/90 hover:text-white transition-colors"
                  >
                    {item.label}
                  </motion.button>
                </div>
              ))}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
      <Cart />
    </>
  )
}
