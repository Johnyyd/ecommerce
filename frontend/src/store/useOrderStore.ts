import { create } from 'zustand';

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
}

export interface Payment {
  id: string;
  transaction_id: string | null;
  status: string;
  provider: string;
}

export interface Order {
  id: string;
  user_id: string;
  address_id: string;
  total_amount: number;
  status: string;
  payment_method: string;
  items: OrderItem[];
  payment: Payment | null;
  payment_url?: string;
}

export interface OrderCreate {
  items: { product_id: string; quantity: number }[];
  address_id: string;
  payment_method: string;
}

interface OrderState {
  orders: Order[];
  isLoading: boolean;
  error: string | null;
  fetchOrders: (token: string) => Promise<void>;
  createOrder: (token: string, order: OrderCreate) => Promise<Order>;
  cancelOrder: (token: string, id: string) => Promise<void>;
}

const API_URL = (import.meta as any).env.VITE_API_URL || 'http://127.0.0.1/api/v1';

export const useOrderStore = create<OrderState>((set, get) => ({
  orders: [],
  isLoading: false,
  error: null,

  fetchOrders: async (token) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`${API_URL}/orders/`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch orders');
      const data = await res.json();
      set({ orders: data, isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  createOrder: async (token, order) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`${API_URL}/orders/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(order)
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || 'Failed to create order');
      }
      const data = await res.json();
      await get().fetchOrders(token);
      return data;
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      throw err;
    }
  },

  cancelOrder: async (token, id) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`${API_URL}/orders/${id}/cancel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to cancel order');
      await get().fetchOrders(token);
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      throw err;
    }
  }
}));
