import { useEffect } from "react"
import { Route, Switch } from "wouter"
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

function App() {
  const { setUser, setIsLoading } = useAuthStore()

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem("access_token")
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
          localStorage.removeItem("access_token")
          setUser(null)
        }
      } catch {
        localStorage.removeItem("access_token")
        setUser(null)
      } finally {
        setIsLoading(false)
      }
    }
    
    checkAuth()
  }, [setUser, setIsLoading])

  return (
    <div className="min-h-screen bg-zinc-50 selection:bg-electric-blue selection:text-white">
      <Switch>
        <Route path="/" component={Storefront} />
        <Route path="/products" component={ProductsPage} />
        <Route path="/product/:id" component={ProductDetail} />
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
