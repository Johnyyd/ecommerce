import { create } from 'zustand';

export interface Address {
  id: string;
  user_id: string;
  province: string;
  district: string;
  ward: string;
  street_detail: string;
  phone_number: string;
  is_default: boolean;
}

export type AddressCreate = Omit<Address, 'id' | 'user_id'>;

interface AddressState {
  addresses: Address[];
  isLoading: boolean;
  error: string | null;
  fetchAddresses: (token: string) => Promise<void>;
  createAddress: (token: string, address: AddressCreate) => Promise<void>;
  updateAddress: (token: string, id: string, address: Partial<AddressCreate>) => Promise<void>;
  deleteAddress: (token: string, id: string) => Promise<void>;
}

const API_URL = (import.meta as any).env.VITE_API_URL || 'http://127.0.0.1/api/v1';

export const useAddressStore = create<AddressState>((set, get) => ({
  addresses: [],
  isLoading: false,
  error: null,

  fetchAddresses: async (token) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`${API_URL}/addresses/`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch addresses');
      const data = await res.json();
      set({ addresses: data, isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  createAddress: async (token, address) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`${API_URL}/addresses/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(address)
      });
      if (!res.ok) throw new Error('Failed to create address');
      await get().fetchAddresses(token);
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  updateAddress: async (token, id, address) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`${API_URL}/addresses/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(address)
      });
      if (!res.ok) throw new Error('Failed to update address');
      await get().fetchAddresses(token);
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  deleteAddress: async (token, id) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`${API_URL}/addresses/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to delete address');
      await get().fetchAddresses(token);
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  }
}));
