import { useCartStore } from '@/store/useCartStore'
import { motion } from 'motion/react'
import type { CartItem as CartItemType } from '@/store/useCartStore'

export function CartItem({ item }: { item: CartItemType }) {
  const { removeItem, updateQuantity } = useCartStore()

  const handleRemove = () => {
    removeItem(item.id)
  }

  const changeQty = (delta: number) => {
    const newQty = item.quantity + delta
    if (newQty > 0) {
      updateQuantity(item.id, newQty)
    }
  }

  return (
    <motion.div
      layout
      className="flex items-center gap-4 p-2 border-b border-zinc-200"
    >
      {item.image && (
        <img src={item.image} alt={item.name} className="w-16 h-16 object-cover rounded" />
      )}
      <div className="flex-1">
        <h3 className="font-medium">{item.name}</h3>
        <p className="text-sm text-zinc-500">${item.price?.toFixed(2)}</p>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => changeQty(-1)}
          className="px-2 py-1 bg-zinc-100 rounded hover:bg-zinc-200"
        >-</button>
        <span>{item.quantity}</span>
        <button
          onClick={() => changeQty(1)}
          className="px-2 py-1 bg-zinc-100 rounded hover:bg-zinc-200"
        >+</button>
      </div>
      <button
        onClick={handleRemove}
        className="text-red-500 hover:underline"
      >Remove</button>
    </motion.div>
  )
}
