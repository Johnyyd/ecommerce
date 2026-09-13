import { useEffect, useState } from 'react';
import { useOrderStore, Order } from '@/store/useOrderStore';
import { motion, AnimatePresence } from 'motion/react';
import { 
  QrCode, 
  ArrowsLeftRight, 
  X, 
  Money, 
  CreditCard, 
  DeviceMobile,
  ArrowClockwise 
} from '@phosphor-icons/react';
import { VietQRModal } from '@/components/payment/VietQRModal';
import { paymentApi } from '@/services/paymentApi';
import { PaymentCreateResponse } from '@/types/payment';
import { toast } from 'sonner';

export function OrderHistory() {
  const token = localStorage.getItem('access_token') || localStorage.getItem('token');
  const { orders, isLoading, error, fetchOrders, cancelOrder, updatePaymentMethod } = useOrderStore();

  // VietQR Modal state for re-paying or paying from Order History
  const [vietQRData, setVietQRData] = useState<PaymentCreateResponse | null>(null);
  const [isQRModalOpen, setIsQRModalOpen] = useState<boolean>(false);
  const [loadingQRId, setLoadingQRId] = useState<string | null>(null);

  // Change Payment Method modal state
  const [orderToChange, setOrderToChange] = useState<Order | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<string>('COD');
  const [isUpdatingMethod, setIsUpdatingMethod] = useState<boolean>(false);

  useEffect(() => {
    if (token) fetchOrders(token);
  }, [token, fetchOrders]);

  const handleCancel = async (id: string) => {
    if (!token) return;
    if (window.confirm('Are you sure you want to cancel this order? Reserved stock will be restored immediately.')) {
      try {
        await cancelOrder(token, id);
        toast.success('Order cancelled successfully.');
      } catch (err: any) {
        toast.error('Failed to cancel order: ' + (err.message || 'Error'));
      }
    }
  };

  // Open VietQR modal for a pending order
  const handleOpenVietQR = async (orderId: string) => {
    try {
      setLoadingQRId(orderId);
      const res = await paymentApi.createPaymentLink(orderId, 'VIETQR');
      setVietQRData(res);
      setIsQRModalOpen(true);
    } catch (err: any) {
      toast.error('Unable to load VietQR link: ' + (err.message || 'Error'));
    } finally {
      setLoadingQRId(null);
    }
  };

  // Open Change Payment Method modal
  const handleOpenChangeMethod = (order: Order) => {
    setOrderToChange(order);
    setSelectedMethod(order.payment_method === 'COD' ? 'VIETQR' : 'COD');
  };

  // Submit payment method change
  const handleConfirmMethodChange = async () => {
    if (!orderToChange || !token) return;
    try {
      setIsUpdatingMethod(true);
      const updatedOrder = await updatePaymentMethod(token, orderToChange.id, selectedMethod);
      toast.success(`Payment method updated to ${selectedMethod}!`);
      const targetId = orderToChange.id;
      setOrderToChange(null);

      if (selectedMethod === 'VIETQR') {
        // Automatically open the VietQR modal
        await handleOpenVietQR(targetId);
      } else if (selectedMethod === 'VNPAY' || selectedMethod === 'MOMO') {
        if (updatedOrder.payment_url) {
          window.location.href = updatedOrder.payment_url;
        } else {
          window.location.href = `http://localhost/payment?order_id=${targetId}&amount=${updatedOrder.total_amount}&method=${selectedMethod}&mock_secret=mock_secret_123`;
        }
      }
    } catch (err: any) {
      toast.error('Failed to update payment method: ' + (err.message || 'Error'));
    } finally {
      setIsUpdatingMethod(false);
    }
  };

  const statusColors: Record<string, string> = {
    PENDING: 'bg-yellow-50 text-yellow-700 ring-yellow-600/20',
    PROCESSING: 'bg-blue-50 text-blue-700 ring-blue-600/20',
    SHIPPED: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
    DELIVERED: 'bg-green-50 text-green-700 ring-green-600/20',
    CANCELLED: 'bg-red-50 text-red-700 ring-red-600/20',
  };

  const paymentOptions = [
    {
      id: 'COD',
      title: 'Cash on Delivery (COD)',
      desc: 'Pay upon delivery at your shipping address',
      icon: Money,
      badge: 'Popular'
    },
    {
      id: 'VIETQR',
      title: 'VietQR / PayOS',
      desc: 'Instant 24/7 NAPAS Bank Transfer with QR code',
      icon: QrCode,
      badge: 'Zero Fee'
    },
    {
      id: 'VNPAY',
      title: 'VNPay Gateway',
      desc: 'ATM debit cards, QR Pay, & domestic bank accounts',
      icon: CreditCard
    },
    {
      id: 'MOMO',
      title: 'MoMo E-Wallet',
      desc: 'Instant payment via MoMo mobile application',
      icon: DeviceMobile
    },
    {
      id: 'CREDIT_CARD',
      title: 'Credit / Debit Card',
      desc: 'International Visa, MasterCard, JCB',
      icon: CreditCard
    }
  ];

  return (
    <div className="flex flex-col gap-8">
      <h2 className="text-xl font-medium tracking-tight text-zinc-900">Order History</h2>
      
      {error && <div className="text-red-500 text-sm bg-red-50 p-4 rounded-xl">{error}</div>}
      
      {isLoading && orders.length === 0 ? (
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
              className="border border-zinc-200 bg-white rounded-2xl p-6 shadow-sm"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-6 border-b border-zinc-100">
                <div>
                  <p className="text-[10px] font-mono text-zinc-400 mb-1 tracking-widest uppercase">Order ID</p>
                  <p className="font-medium text-sm text-zinc-900 font-mono">{order.id}</p>
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
                <div className="mt-6 pt-4 border-t border-zinc-100 flex flex-wrap items-center justify-end gap-3">
                  {/* Pay via QR button for VietQR orders */}
                  {order.status === 'PENDING' && (order.payment_method === 'VIETQR' || order.payment_method === 'PAYOS') && (
                    <button 
                      onClick={() => handleOpenVietQR(order.id)}
                      disabled={loadingQRId === order.id}
                      className="text-xs font-medium text-white bg-zinc-900 hover:bg-zinc-800 px-3.5 py-2 rounded-xl transition-all shadow-sm active:scale-95 flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {loadingQRId === order.id ? (
                        <ArrowClockwise size={14} className="animate-spin" />
                      ) : (
                        <QrCode size={15} weight="bold" />
                      )}
                      Pay via VietQR
                    </button>
                  )}

                  {/* Pay Online button for gateway orders */}
                  {order.status === 'PENDING' && order.payment_method !== 'COD' && order.payment_method !== 'VIETQR' && order.payment_method !== 'PAYOS' && order.payment_url && (
                    <button 
                      onClick={() => window.location.href = order.payment_url!}
                      className="text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 px-3.5 py-2 rounded-xl transition-all shadow-sm active:scale-95 flex items-center gap-1.5"
                    >
                      <CreditCard size={15} />
                      Pay Online
                    </button>
                  )}

                  {/* Change Payment Method button for any PENDING order */}
                  {order.status === 'PENDING' && (
                    <button 
                      onClick={() => handleOpenChangeMethod(order)}
                      className="text-xs font-medium text-zinc-700 hover:text-zinc-950 bg-zinc-100 hover:bg-zinc-200 px-3.5 py-2 rounded-xl transition-all active:scale-95 flex items-center gap-1.5"
                    >
                      <ArrowsLeftRight size={14} />
                      Change Payment Method
                    </button>
                  )}

                  {/* Cancel Order */}
                  <button 
                    onClick={() => handleCancel(order.id)}
                    className="text-xs font-medium text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-2 rounded-xl transition-colors"
                  >
                    Cancel Order
                  </button>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {/* Reusable VietQR Modal for paying orders directly from history */}
      <VietQRModal
        isOpen={isQRModalOpen}
        paymentData={vietQRData}
        onClose={() => {
          setIsQRModalOpen(false);
          if (token) fetchOrders(token);
        }}
        onPaymentSuccess={() => {
          if (token) fetchOrders(token);
        }}
        onChangePaymentMethod={() => {
          if (token) fetchOrders(token);
        }}
        onCancelOrder={() => {
          if (token) fetchOrders(token);
        }}
      />

      {/* Change Payment Method Modal */}
      <AnimatePresence>
        {orderToChange && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: 'spring', damping: 30, stiffness: 350 }}
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-zinc-100 overflow-hidden my-8"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-zinc-100">
                <div>
                  <h3 className="text-lg font-semibold text-zinc-900 tracking-tight">
                    Change Payment Method
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Order #{orderToChange.id.substring(0, 8)} • ${orderToChange.total_amount.toFixed(2)}
                  </p>
                </div>
                <button
                  onClick={() => setOrderToChange(null)}
                  className="w-8 h-8 rounded-full bg-zinc-100 text-zinc-500 flex items-center justify-center hover:bg-zinc-200 transition-colors"
                >
                  <X size={16} weight="bold" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 flex flex-col gap-3">
                <p className="text-xs text-zinc-500 mb-1">
                  Select a new payment method for this pending order:
                </p>

                <div className="flex flex-col gap-2.5 max-h-[340px] overflow-y-auto pr-1">
                  {paymentOptions.map((opt) => {
                    const IconComp = opt.icon;
                    const isSelected = selectedMethod === opt.id;
                    const isCurrent = orderToChange.payment_method === opt.id;
                    return (
                      <div
                        key={opt.id}
                        onClick={() => setSelectedMethod(opt.id)}
                        className={`cursor-pointer p-3.5 rounded-2xl border transition-all flex items-center justify-between ${
                          isSelected 
                            ? 'border-zinc-900 bg-zinc-50/80 shadow-sm' 
                            : 'border-zinc-200 hover:border-zinc-300'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                            isSelected ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600'
                          }`}>
                            <IconComp size={20} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-zinc-900">{opt.title}</p>
                              {isCurrent && (
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 border border-zinc-200">
                                  Current
                                </span>
                              )}
                              {opt.badge && !isCurrent && (
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  {opt.badge}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-zinc-500 line-clamp-1">{opt.desc}</p>
                          </div>
                        </div>
                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                          isSelected ? 'border-zinc-900' : 'border-zinc-300'
                        }`}>
                          {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-zinc-900" />}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 pt-4 border-t border-zinc-100 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setOrderToChange(null)}
                    className="px-4 py-2.5 rounded-xl text-xs font-medium text-zinc-600 hover:bg-zinc-100 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmMethodChange}
                    disabled={isUpdatingMethod || selectedMethod === orderToChange.payment_method}
                    className="px-5 py-2.5 rounded-xl bg-zinc-900 text-white text-xs font-medium hover:bg-zinc-800 transition-all shadow-sm active:scale-95 disabled:opacity-50 flex items-center gap-2"
                  >
                    {isUpdatingMethod && <ArrowClockwise size={14} className="animate-spin" />}
                    {isUpdatingMethod ? 'Updating...' : 'Save & Apply'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
