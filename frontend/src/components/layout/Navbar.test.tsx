import { render, screen, fireEvent } from '@testing-library/react';
import { Navbar } from './Navbar';
import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from '@/store/useAuthStore';
import { useCartStore } from '@/store/useCartStore';

describe('Navbar', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    useAuthStore.getState().setUser(null);
    useCartStore.getState().clearCart();
    useCartStore.getState().setCartOpen(false);
  });

  it('renders floating navbar', () => {
    render(<Navbar />);
    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });

  it('does NOT show Admin Portal for customer even if admin token is present in localStorage', () => {
    localStorage.setItem('admin_access_token', 'leaked-admin-token');
    useAuthStore.getState().setUser({
      id: 'c1',
      username: 'customer1',
      email: 'customer@test.com',
      role: 'customer',
      is_active: true,
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    });

    render(<Navbar />);
    const menuBtn = screen.getByLabelText('Toggle Menu');
    fireEvent.click(menuBtn);

    expect(screen.queryByText('Admin Portal')).toBeNull();
  });

  it('shows Admin Portal when active user is admin', () => {
    useAuthStore.getState().setUser({
      id: 'a1',
      username: 'admin1',
      email: 'admin@test.com',
      role: 'admin',
      is_active: true,
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    });

    render(<Navbar />);
    const menuBtn = screen.getByLabelText('Toggle Menu');
    fireEvent.click(menuBtn);

    expect(screen.getByText('Admin Portal')).toBeInTheDocument();
  });

  it('opens cart drawer when clicking Toggle Cart button', () => {
    render(<Navbar />);
    
    const cartBtn = screen.getByLabelText('Toggle Cart');
    fireEvent.click(cartBtn);
    
    expect(screen.getByText('Your Cart')).toBeInTheDocument();
    expect(screen.getByText('Your cart is empty.')).toBeInTheDocument();
  });

  it('displays items and Checkout button when cart has items', () => {
    useCartStore.getState().addItem({
      id: 'p1',
      name: 'Premium Leather Shoes',
      price: 150,
      quantity: 1,
    });

    render(<Navbar />);
    const cartBtn = screen.getByLabelText('Toggle Cart');
    fireEvent.click(cartBtn);

    expect(screen.getByText('Your Cart')).toBeInTheDocument();
    expect(screen.getByText('Premium Leather Shoes')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /checkout/i })).toBeInTheDocument();
  });
});
