import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useCartStore } from '@/store/useCartStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useAddressStore } from '@/store/useAddressStore';
import { useOrderStore } from '@/store/useOrderStore';
import { Navbar } from '@/components/layout/Navbar';
import { toast } from 'sonner';

export function Checkout() {
  const [, setLocation] = useLocation();
  const { items, clearCart } = useCartStore();
  const { isAuthenticated, isLoading: authLoading } = useAuthStore();
  const token = localStorage.getItem('access_token') || localStorage.getItem('token');
  const { addresses, fetchAddresses } = useAddressStore();
  const { createOrder, isLoading: creatingOrder } = useOrderStore();
  
  const [selectedAddressId, setSelectedAddressId] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('COD');

  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      setLocation('/login');
    }
  }, [isAuthenticated, authLoading, setLocation]);

  useEffect(() => {
    if (token) {
      fetchAddresses(token);
    }
  }, [token, fetchAddresses]);

  useEffect(() => {
    if (addresses.length > 0 && !selectedAddressId) {
      const defaultAddr = addresses.find(a => a.is_default);
      setSelectedAddressId(defaultAddr ? defaultAddr.id : addresses[0].id);
    }
  }, [addresses, selectedAddressId]);

  const handlePlaceOrder = async () => {
    if (!token) {
      toast.error('Please login to place an order');
      setLocation('/login');
      return;
    }
    if (items.length === 0) {
      toast.error('Your cart is empty');
      return;
    }
    if (!selectedAddressId) {
      toast.error('Please select a shipping address');
      return;
    }

    try {
      const orderData = {
        items: items.map(item => ({ product_id: item.id, quantity: item.quantity })),
        address_id: selectedAddressId,
        payment_method: paymentMethod,
      };
      
      const order = await createOrder(token, orderData);
      clearCart();
      toast.success('Order placed successfully!');
      
      if (order.payment_url) {
        toast.info(`Redirecting to payment gateway...`);
        setTimeout(() => window.location.href = order.payment_url!, 1500);
      } else {
        setLocation('/profile');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to place order');
    }
  };

  if (authLoading) return <div>Loading...</div>;
  if (items.length === 0) {
    setLocation('/cart');
    return null;
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen pt-32 pb-24 px-4 md:px-12 bg-zinc-50">
        <div className="max-w-5xl mx-auto flex flex-col lg:flex-row gap-12">
          
          <div className="flex-1 flex flex-col gap-8">
            <h1 className="text-3xl font-medium tracking-tight text-zinc-900">Checkout</h1>
            
            <section className="bg-white rounded-[2rem] p-8 border border-zinc-100 shadow-sm">
              <h2 className="text-xl font-medium mb-6">Shipping Address</h2>
              {addresses.length === 0 ? (
                <div className="text-zinc-500 text-sm">
                  You don't have any addresses yet. Please add one in your <a href="/profile" className="text-zinc-900 underline">Profile</a>.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {addresses.map(addr => (
                    <div 
                      key={addr.id}
                      onClick={() => setSelectedAddressId(addr.id)}
                      className={`cursor-pointer p-5 rounded-2xl border transition-colors ${selectedAddressId === addr.id ? 'border-zinc-900 bg-zinc-50' : 'border-zinc-200 hover:border-zinc-300'}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center mt-0.5 ${selectedAddressId === addr.id ? 'border-zinc-900' : 'border-zinc-300'}`}>
                          {selectedAddressId === addr.id && <div className="w-3 h-3 rounded-full bg-zinc-900" />}
                        </div>
                        <div>
                          <p className="font-medium text-zinc-900">{addr.phone_number}</p>
                          <p className="text-sm text-zinc-500 leading-relaxed mt-1">
                            {addr.street_detail}<br />
                            {addr.ward}, {addr.district}<br />
                            {addr.province}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="bg-white rounded-[2rem] p-8 border border-zinc-100 shadow-sm">
              <h2 className="text-xl font-medium mb-6">Payment Method</h2>
              <div className="flex flex-col gap-4">
                {[
                  { id: 'COD', label: 'Cash on Delivery (COD)' },
                  { id: 'VNPAY', label: 'VNPay' },
                  { id: 'MOMO', label: 'MoMo E-Wallet' },
                  { id: 'CREDIT_CARD', label: 'Credit Card' }
                ].map(method => (
                  <label key={method.id} className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-colors ${paymentMethod === method.id ? 'border-zinc-900 bg-zinc-50' : 'border-zinc-200 hover:border-zinc-300'}`}>
                    <input 
                      type="radio" 
                      name="payment_method" 
                      value={method.id} 
                      checked={paymentMethod === method.id} 
                      onChange={() => setPaymentMethod(method.id)} 
                      className="hidden"
                    />
                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${paymentMethod === method.id ? 'border-zinc-900' : 'border-zinc-300'}`}>
                      {paymentMethod === method.id && <div className="w-3 h-3 rounded-full bg-zinc-900" />}
                    </div>
                    <span className="font-medium text-zinc-900">{method.label}</span>
                  </label>
                ))}
              </div>
            </section>
          </div>

          <div className="w-full lg:w-[400px]">
            <div className="sticky top-32 bg-zinc-900 text-white rounded-[2rem] p-8 shadow-xl">
              <h2 className="text-xl font-medium mb-6">Order Summary</h2>
              <div className="flex flex-col gap-4 mb-8">
                {items.map(item => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <div className="flex gap-3 text-zinc-400">
                      <span className="text-white bg-zinc-800 px-2 rounded-md">{item.quantity}x</span>
                      <span className="line-clamp-1">{item.name}</span>
                    </div>
                    <span className="text-white font-medium">${(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              
              <div className="border-t border-zinc-800 pt-6 flex justify-between items-end mb-8">
                <span className="text-zinc-400">Total</span>
                <span className="text-3xl font-medium">${total.toFixed(2)}</span>
              </div>

              <button
                onClick={handlePlaceOrder}
                disabled={creatingOrder || !selectedAddressId}
                className="w-full bg-white text-zinc-900 font-medium py-4 rounded-xl hover:bg-zinc-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creatingOrder ? 'Processing...' : 'Place Order'}
              </button>
            </div>
          </div>

        </div>
      </main>
    </>
  );
}
