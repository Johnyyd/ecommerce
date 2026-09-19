import { useEffect } from "react"
import { Route, Switch } from "wouter"
import { Toaster } from "sonner"
import { Storefront } from "@/pages/Storefront"
import { ProductsPage } from "@/pages/ProductsPage"
import { ProductDetail } from "@/pages/ProductDetail"
import { Profile } from "@/pages/Profile"
import { Login } from "@/pages/Login"
import { Register } from "@/pages/Register"
import { Admin } from "@/pages/Admin"
import { Checkout } from "@/pages/Checkout"
import { Cart } from "@/pages/Cart"
import { PaymentResult } from "@/pages/PaymentResult"
import { useAuthStore } from "@/store/useAuthStore"
import { useThemeStore } from "@/store/useThemeStore"
import { getAuthToken, clearAuthToken } from "@/lib/auth"

function App() {
  const { setUser, setIsLoading } = useAuthStore()
  const { isDark, initTheme } = useThemeStore()

  useEffect(() => {
    initTheme()
  }, [initTheme])

  useEffect(() => {
    const checkAuth = async () => {
      const token = getAuthToken()
      if (!token) {
        setIsLoading(false)
        return
      }

      try {
        const res = await fetch("/api/v1/auth/me", {
          headers: {
            "Authorization": `Bearer ${token}`
          }
        })
        if (res.ok) {
          const user = await res.json()
          setUser(user)
        } else {
          clearAuthToken()
          setUser(null)
        }
      } catch {
        clearAuthToken()
        setUser(null)
      } finally {
        setIsLoading(false)
      }
    }
    
    checkAuth()
  }, [setUser, setIsLoading])

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 selection:bg-electric-blue selection:text-white transition-colors duration-200">
      <Toaster
        position="top-right"
        richColors
        closeButton
        theme={isDark ? "dark" : "light"}
      />
      <Switch>
        <Route path="/" component={Storefront} />
        <Route path="/products" component={ProductsPage} />
        <Route path="/product/:id" component={ProductDetail} />
        <Route path="/products/:id" component={ProductDetail} />
        <Route path="/cart" component={Cart} />
        <Route path="/checkout" component={Checkout} />
        <Route path="/payment" component={PaymentResult} />
        <Route path="/profile" component={Profile} />
        <Route path="/login" component={Login} />
        <Route path="/register" component={Register} />
        <Route path="/admin" component={Admin} />
        <Route>404, Not Found!</Route>
      </Switch>
    </div>
  )
}

export default App
