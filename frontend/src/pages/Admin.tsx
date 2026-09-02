import { useEffect, useState } from "react"
import { useLocation } from "wouter"
import { useAuthStore } from "@/store/useAuthStore"

export function Admin() {
  const { user, isLoading } = useAuthStore()
  const [, setLocation] = useLocation()
  const [products, setProducts] = useState([])

  useEffect(() => {
    if (!isLoading && (!user || user.role !== "admin")) {
      setLocation("/login")
    }
  }, [user, isLoading, setLocation])

  useEffect(() => {
    if (user && user.role === "admin") {
      fetchProducts()
    }
  }, [user])

  const fetchProducts = async () => {
    try {
      const res = await fetch("/api/v1/products/")
      if (res.ok) {
        const data = await res.json()
        setProducts(data)
      }
    } catch (e) {
      console.error(e)
    }
  }

  if (isLoading) return <div className="min-h-screen bg-zinc-50 flex justify-center items-center">Loading...</div>
  if (!user || user.role !== "admin") return null

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col">
      <header className="bg-white border-b border-zinc-200 px-8 py-4 flex justify-between items-center">
        <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">Admin Dashboard</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-zinc-500">{user.email}</span>
          <button 
            onClick={() => {
              useAuthStore.getState().logout()
              localStorage.removeItem("access_token")
              setLocation("/")
            }}
            className="text-sm text-red-500 hover:text-red-600 font-medium"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="flex-1 p-8 max-w-5xl mx-auto w-full">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-semibold tracking-tight text-zinc-900">Products</h2>
          <button className="bg-zinc-900 hover:bg-zinc-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            Add Product
          </button>
        </div>

        <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-zinc-500 border-b border-zinc-200">
              <tr>
                <th className="px-6 py-3 font-medium">Product</th>
                <th className="px-6 py-3 font-medium">Price</th>
                <th className="px-6 py-3 font-medium">Stock</th>
                <th className="px-6 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {products.map((product: any) => (
                <tr key={product.id} className="hover:bg-zinc-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {product.image_url && (
                        <img src={product.image_url} alt="" className="w-10 h-10 rounded-md object-cover" />
                      )}
                      <div>
                        <div className="font-medium text-zinc-900">{product.name}</div>
                        <div className="text-zinc-500 text-xs">{product.category}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-zinc-600">${product.price.toFixed(2)}</td>
                  <td className="px-6 py-4 text-zinc-600">{product.stock}</td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-electric-blue hover:text-blue-600 font-medium text-sm">Edit</button>
                  </td>
                </tr>
              ))}
              {products.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-zinc-500">
                    No products found. Add your first product.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  )
}
