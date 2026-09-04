import { useEffect, useState } from "react"
import { useLocation } from "wouter"
import { useAuthStore } from "@/store/useAuthStore"
import { Navbar } from "@/components/layout/Navbar"
import { motion, AnimatePresence } from "motion/react"
import { OrderHistory } from "@/components/profile/OrderHistory"
import { AddressBook } from "@/components/profile/AddressBook"

export function Profile() {
  const { user, isAuthenticated, isLoading: authLoading, logout } = useAuthStore()
  const [, setLocation] = useLocation()
  const [activeTab, setActiveTab] = useState<'orders' | 'addresses'>('orders')

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      setLocation("/login")
    }
  }, [isAuthenticated, authLoading, setLocation])

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
        <div className="max-w-[1000px] mx-auto flex flex-col md:flex-row gap-12">
          
          {/* Sidebar */}
          <div className="w-full md:w-64 flex-shrink-0">
            <div className="sticky top-32 flex flex-col gap-8">
              <div>
                <h1 className="text-2xl tracking-tight font-medium text-zinc-950 mb-1">
                  Hello, {user.username}
                </h1>
                <p className="text-zinc-500 text-sm truncate">
                  {user.email}
                </p>
              </div>

              <nav className="flex flex-col gap-2">
                <button
                  onClick={() => setActiveTab('orders')}
                  className={`text-left px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${activeTab === 'orders' ? 'bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200' : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900'}`}
                >
                  Order History
                </button>
                <button
                  onClick={() => setActiveTab('addresses')}
                  className={`text-left px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${activeTab === 'addresses' ? 'bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200' : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900'}`}
                >
                  Address Book
                </button>
              </nav>

              <div className="mt-8 pt-8 border-t border-zinc-200">
                <button 
                  onClick={() => {
                    logout()
                    setLocation("/")
                  }}
                  className="w-full text-left px-4 py-2 text-sm font-medium text-red-500 hover:text-red-600 transition-colors"
                >
                  Sign out
                </button>
              </div>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1">
            <div className="bg-white rounded-[2rem] p-8 md:p-12 shadow-sm border border-zinc-100 min-h-[600px]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  {activeTab === 'orders' ? <OrderHistory /> : <AddressBook />}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

        </div>
      </main>
    </>
  )
}
