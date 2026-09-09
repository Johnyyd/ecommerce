import { useEffect } from 'react';
import { useOrderStore } from '@/store/useOrderStore';
import { motion } from 'motion/react';

export function OrderHistory() {
  const token = localStorage.getItem('access_token') || localStorage.getItem('token');
  const { orders, isLoading, error, fetchOrders, cancelOrder } = useOrderStore();

  useEffect(() => {
    if (token) fetchOrders(token);
  }, [token, fetchOrders]);

  const handleCancel = async (id: string) => {
    if (!token) return;
    if (window.confirm('Are you sure you want to cancel this order? Refunds may take 3-5 business days if already paid.')) {
      await cancelOrder(token, id);
    }
  };

  const statusColors: Record<string, string> = {
    PENDING: 'bg-yellow-50 text-yellow-700 ring-yellow-600/20',
    PROCESSING: 'bg-blue-50 text-blue-700 ring-blue-600/20',
    SHIPPED: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
    DELIVERED: 'bg-green-50 text-green-700 ring-green-600/20',
    CANCELLED: 'bg-red-50 text-red-700 ring-red-600/20',
  };

  return (
    <div className="flex flex-col gap-8">
      <h2 className="text-xl font-medium tracking-tight text-zinc-900">Order History</h2>
      
      {error && <div className="text-red-500 text-sm bg-red-50 p-4 rounded-xl">{error}</div>}
      
      {isLoading ? (
        <div className="text-zinc-500">Loading orders...</div>
      ) : orders.length === 0 ? (
        <div className="text-zinc-500 py-12 text-center border-2 border-dashed border-zinc-100 rounded-2xl">
          You haven't placed any orders yet.
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {orders.map((order, i) => (
            <motion.div 
              key={order.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="border border-zinc-200 bg-white rounded-2xl p-6"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-6 border-b border-zinc-100">
                <div>
                  <p className="text-[10px] font-mono text-zinc-400 mb-1 tracking-widest uppercase">Order ID</p>
                  <p className="font-medium text-sm text-zinc-900">{order.id}</p>
                </div>
                <div className="flex items-center gap-6">
                  <div>
                    <p className="text-[10px] text-zinc-400 mb-1 tracking-widest uppercase">Status</p>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ring-1 ${statusColors[order.status] || 'bg-zinc-50 text-zinc-700 ring-zinc-600/20'}`}>
                      {order.status}
                    </span>
                  </div>
                  <div>
                    <p className="text-[10px] text-zinc-400 mb-1 tracking-widest uppercase">Payment</p>
                    <span className="inline-flex items-center text-xs font-medium text-zinc-700">
                      {order.payment_method} {order.payment?.status ? `(${order.payment.status})` : ''}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-zinc-400 mb-1 tracking-widest uppercase">Total</p>
                    <p className="font-medium text-zinc-900">${order.total_amount.toFixed(2)}</p>
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col gap-3">
                {order.items.map((item) => (
                  <div key={item.id} className="flex justify-between items-center text-sm">
                    <div className="flex items-center gap-3 text-zinc-600">
                      <span className="font-medium text-zinc-900 bg-zinc-100 px-2 rounded-md">{item.quantity}x</span>
                      <span>Product {item.product_id.substring(0, 8)}</span>
                    </div>
                    <span className="text-zinc-500">${item.unit_price.toFixed(2)}</span>
                  </div>
                ))}
              </div>

              {(['PENDING', 'PROCESSING'].includes(order.status)) && (
                <div className="mt-6 pt-4 border-t border-zinc-50 flex justify-end gap-4">
                  {order.status === 'PENDING' && order.payment_method !== 'COD' && order.payment_url && (
                    <button 
                      onClick={() => window.location.href = order.payment_url!}
                      className="text-xs font-medium text-blue-600 hover:text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      Pay Now
                    </button>
                  )}
                  <button 
                    onClick={() => handleCancel(order.id)}
                    className="text-xs font-medium text-red-500 hover:text-red-600 px-3 py-1.5"
                  >
                    Cancel Order
                  </button>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
