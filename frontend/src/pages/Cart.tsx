import { useCartStore } from '@/store/useCartStore'
import { CartItem } from '@/components/CartItem'
import { useEffect } from 'react'
import { useLocation } from 'wouter'
import { toast } from 'sonner'

// Helper navigate function using wouter's useLocation
const useNavigate = () => {
  const [, setLocation] = useLocation()
  return (path: string) => setLocation(path)
}

export function Cart() {
  const { items, clearCart } = useCartStore()
  const navigate = useNavigate()

  useEffect(() => {
    // Ensure cart overlay is closed when on page
  }, [])

  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0)

  const handleCheckout = async () => {
    try {
      const res = await fetch('/api/v1/checkout/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      })
      if (res.ok) {
        const order = await res.json()
        toast.success('Order placed!')
        clearCart()
        navigate(`/orders/${order.id}`)
      } else {
        const err = await res.json()
        toast.error(err.detail || 'Checkout failed')
      }
    } catch (e) {
      toast.error('Network error')
    }
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen space-y-4">
        <img src="/static/empty_cart_illustration.jpg" alt="Empty Cart" className="w-64 h-64" />
        <h2 className="text-2xl font-medium">Your cart is empty</h2>
        <button
          onClick={() => navigate('/')}
          className="px-4 py-2 bg-electric-blue text-white rounded-lg hover:bg-electric-blue/80 transition"
        >
          Continue Shopping
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-4">
      <h1 className="text-3xl font-bold mb-4">Shopping Cart</h1>
      <div className="space-y-2">
        {items.map(item => (
          <CartItem key={item.id} item={item} />
        ))}
      </div>
      <div className="flex justify-between items-center mt-6">
        <span className="text-xl font-semibold">Total: ${total.toFixed(2)}</span>
        <button
          onClick={handleCheckout}
          className="px-6 py-2 bg-electric-blue text-white rounded-lg hover:bg-electric-blue/80 transition"
        >
          Checkout
        </button>
      </div>
    </div>
  )
}
