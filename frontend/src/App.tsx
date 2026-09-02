import { useEffect } from "react"
import { Route, Switch } from "wouter"
import { Storefront } from "@/pages/Storefront"
import { ProductDetail } from "@/pages/ProductDetail"
import { Profile } from "@/pages/Profile"
import { Login } from "@/pages/Login"
import { Admin } from "@/pages/Admin"
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
      } catch (e) {
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
        <Route path="/product/:id" component={ProductDetail} />
        <Route path="/profile" component={Profile} />
        <Route path="/login" component={Login} />
        <Route path="/admin" component={Admin} />
        <Route>404, Not Found!</Route>
      </Switch>
    </div>
  )
}

export default App
