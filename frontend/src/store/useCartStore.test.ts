import { describe, it, expect, beforeEach } from 'vitest'
import { useCartStore } from './useCartStore'

describe('useCartStore', () => {
  beforeEach(() => {
    useCartStore.getState().clearCart()
  })

  it('should add an item to the cart', () => {
    const item = { id: '1', name: 'Product 1', price: 100, quantity: 1 }
    useCartStore.getState().addItem(item)
    
    expect(useCartStore.getState().items).toHaveLength(1)
    expect(useCartStore.getState().items[0].name).toBe('Product 1')
  })

  it('should increment quantity if item already exists', () => {
    const item = { id: '1', name: 'Product 1', price: 100, quantity: 1 }
    useCartStore.getState().addItem(item)
    useCartStore.getState().addItem(item)
    
    expect(useCartStore.getState().items).toHaveLength(1)
    expect(useCartStore.getState().items[0].quantity).toBe(2)
  })

  it('should calculate total correctly', () => {
    useCartStore.getState().addItem({ id: '1', name: 'Product 1', price: 100, quantity: 1 })
    useCartStore.getState().addItem({ id: '2', name: 'Product 2', price: 200, quantity: 1 })
    
    // total is 100 * 1 + 200 * 1 = 300
    expect(useCartStore.getState().getTotal()).toBe(300)
  })
})
