import { useEffect, useState } from 'react';
import { useOrderStore, Order, OrderItem } from '@/store/useOrderStore';
import { useProductStore } from '@/store/useProductStore';
import { motion, AnimatePresence } from 'motion/react';
import { 
  QrCode, 
  ArrowsLeftRight, 
  X, 
  Money, 
  CreditCard, 
  DeviceMobile,
  ArrowClockwise,
  Truck,
  Star,
  ShieldCheck,
  ArrowSquareOut
} from '@phosphor-icons/react';
import { VietQRModal } from '@/components/payment/VietQRModal';
import { OrderTrackingTimeline } from '@/components/shipping/OrderTrackingTimeline';
import { shippingApi } from '@/services/shippingApi';
import { ShippingTimelineResponse } from '@/types/shipping';
import { paymentApi } from '@/services/paymentApi';
import { PaymentCreateResponse } from '@/types/payment';
import { reviewApi } from '@/services/reviewApi';
import { getAuthToken } from '@/lib/auth';
import { toast } from 'sonner';

export function OrderHistory() {
  const token = getAuthToken();
  const { orders, isLoading, error, fetchOrders, cancelOrder, updatePaymentMethod } = useOrderStore();
  const { products, fetchProducts } = useProductStore();

  // VietQR Modal state for re-paying or paying from Order History
  const [vietQRData, setVietQRData] = useState<PaymentCreateResponse | null>(null);
  const [isQRModalOpen, setIsQRModalOpen] = useState<boolean>(false);
  const [loadingQRId, setLoadingQRId] = useState<string | null>(null);

  // Change Payment Method modal state
  const [orderToChange, setOrderToChange] = useState<Order | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<string>('COD');
  const [isUpdatingMethod, setIsUpdatingMethod] = useState<boolean>(false);

  // Tracking Timeline Modal state
  const [trackingData, setTrackingData] = useState<ShippingTimelineResponse | null>(null);
  const [isTrackingModalOpen, setIsTrackingModalOpen] = useState<boolean>(false);
  const [loadingTrackingId, setLoadingTrackingId] = useState<string | null>(null);

  // In-app Verified Review Modal state
  const [reviewModalData, setReviewModalData] = useState<{
    orderId: string;
    productId: string;
    productName: string;
    unitPrice?: number;
    quantity?: number;
  } | null>(null);
  const [reviewRating, setReviewRating] = useState<number>(5);
  const [reviewHoverRating, setReviewHoverRating] = useState<number>(0);
  const [reviewComment, setReviewComment] = useState<string>('');
  const [isSubmittingReview, setIsSubmittingReview] = useState<boolean>(false);

  const getProductName = (item: OrderItem): string => {
    if (item.product_name) return item.product_name;
    const found = products.find(p => p.id === item.product_id);
    if (found?.name) return found.name;
    return `Product #${item.product_id.substring(0, 8)}`;
  };

  const handleOpenReviewModal = (
    orderId: string, 
    productId: string, 
    productName: string, 
    unitPrice?: number, 
    quantity?: number
  ) => {
    setReviewModalData({ orderId, productId, productName, unitPrice, quantity });
    setReviewRating(5);
    setReviewHoverRating(0);
    setReviewComment('');
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewModalData) return;
    try {
      setIsSubmittingReview(true);
      await reviewApi.createReview({
        product_id: reviewModalData.productId,
        order_id: reviewModalData.orderId,
        rating: reviewRating,
        comment: reviewComment.trim() || undefined,
      });
      toast.success('Review submitted successfully!');
      setReviewModalData(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit review');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleOpenTracking = async (order: Order) => {
    try {
      setLoadingTrackingId(order.id);
      setIsTrackingModalOpen(true);
      if (order.tracking_code) {
        const res = await shippingApi.getTrackingByCode(order.tracking_code);
        setTrackingData(res);
      } else if (token) {
        const res = await shippingApi.getOrderTracking(order.id, token);
        setTrackingData(res);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to load shipment tracking data');
    } finally {
      setLoadingTrackingId(null);
    }
  };

  useEffect(() => {
    if (token) fetchOrders(token);
    if (products.length === 0) fetchProducts();
  }, [token, fetchOrders, fetchProducts, products.length]);

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
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
                    <span>Ordered: {order.created_at ? new Date(order.created_at).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}</span>
                    {order.completed_at && (
                      <span className="text-emerald-600 font-medium">
                        • Completed: {new Date(order.completed_at).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                  {order.tracking_code && (
                    <div className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-orange-50 border border-orange-200 text-orange-700 text-[11px] font-mono font-semibold">
                      <Truck size={13} weight="bold" />
                      <span>GHN: {order.tracking_code}</span>
                    </div>
                  )}
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
              
              <div className="flex flex-col gap-2.5">
                {order.items.map((item) => (
                  <div key={item.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3.5 bg-zinc-50/75 rounded-2xl border border-zinc-100 text-sm">
                    <div className="flex items-center gap-3 text-zinc-600">
                      <span className="font-medium text-zinc-900 bg-white px-2 py-0.5 rounded-md border border-zinc-200 text-xs">
                        {item.quantity}x
                      </span>
                      <div>
                        <a
                          href={`/product/${item.product_id}`}
                          className="font-medium text-zinc-900 hover:text-orange-600 transition-colors inline-flex items-center gap-1.5"
                        >
                          <span>{getProductName(item)}</span>
                          <ArrowSquareOut size={13} className="text-zinc-400" />
                        </a>
                        <span className="text-xs text-zinc-400 block">${item.unit_price.toFixed(2)} each</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-auto">
                      {['DELIVERED', 'COMPLETED'].includes(order.status) && (
                        <button
                          onClick={() => handleOpenReviewModal(order.id, item.product_id, getProductName(item), item.unit_price, item.quantity)}
                          className="text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200/80 px-3 py-1.5 rounded-xl transition-all active:scale-95 flex items-center gap-1.5 shadow-xs cursor-pointer"
                        >
                          <Star size={13} weight="fill" className="text-amber-500" />
                          Review
                        </button>
                      )}
                      <span className="font-semibold text-zinc-900 sm:min-w-[70px] text-right">
                        ${(item.unit_price * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 pt-4 border-t border-zinc-100 flex flex-wrap items-center justify-end gap-3">
                {/* Track Shipment Button (GHN) */}
                {(order.tracking_code || ['SHIPPED', 'DELIVERED', 'COMPLETED', 'PROCESSING'].includes(order.status)) && (
                  <button
                    onClick={() => handleOpenTracking(order)}
                    disabled={loadingTrackingId === order.id}
                    className="text-xs font-semibold text-orange-700 hover:text-orange-900 bg-orange-50 hover:bg-orange-100 border border-orange-200/80 px-3.5 py-2 rounded-xl transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-sm"
                  >
                    {loadingTrackingId === order.id ? (
                      <ArrowClockwise size={14} className="animate-spin" />
                    ) : (
                      <Truck size={15} weight="bold" />
                    )}
                    Track Shipment (GHN)
                  </button>
                )}

                {/* Write Review shortcut button for delivered products */}
                {['DELIVERED', 'COMPLETED'].includes(order.status) && order.items.length > 0 && (
                  <button
                    onClick={() => {
                      const firstItem = order.items[0];
                      handleOpenReviewModal(order.id, firstItem.product_id, getProductName(firstItem), firstItem.unit_price, firstItem.quantity);
                    }}
                    className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 px-3.5 py-2 rounded-xl transition-all active:scale-95 flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <Star size={14} weight="fill" className="text-amber-500" />
                    Review Items
                  </button>
                )}

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
                {['PENDING', 'PROCESSING'].includes(order.status) && (
                  <button 
                    onClick={() => handleCancel(order.id)}
                    className="text-xs font-medium text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-2 rounded-xl transition-colors cursor-pointer"
                  >
                    Cancel Order
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Reusable GHN Order Tracking Timeline Modal */}
      <OrderTrackingTimeline
        isOpen={isTrackingModalOpen}
        onClose={() => setIsTrackingModalOpen(false)}
        data={trackingData}
        isLoading={loadingTrackingId !== null}
      />

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

        {/* Verified Product Review Modal */}
        {reviewModalData && (
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
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200/60 flex items-center justify-center shadow-xs">
                    <Star size={20} weight="fill" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-zinc-900 tracking-tight flex items-center gap-1.5">
                      Review Product
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <ShieldCheck size={12} weight="bold" />
                        Verified Purchase
                      </span>
                    </h3>
                    <p className="text-xs text-zinc-500">
                      Order #{reviewModalData.orderId.substring(0, 8)}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setReviewModalData(null)}
                  className="w-8 h-8 rounded-full bg-zinc-100 text-zinc-500 flex items-center justify-center hover:bg-zinc-200 transition-colors"
                >
                  <X size={16} weight="bold" />
                </button>
              </div>

              {/* Form Body */}
              <form onSubmit={handleSubmitReview} className="p-6 flex flex-col gap-4">
                {/* Product link badge */}
                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200/80">
                  <div className="min-w-0 pr-3">
                    <p className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">Product Name</p>
                    <p className="text-sm font-semibold text-zinc-900 truncate">
                      {reviewModalData.productName}
                    </p>
                  </div>
                  <a
                    href={`/product/${reviewModalData.productId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-xs font-semibold text-zinc-700 hover:text-zinc-900 inline-flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-zinc-200 hover:border-zinc-300 shadow-xs transition-colors"
                  >
                    View Product
                    <ArrowSquareOut size={13} weight="bold" />
                  </a>
                </div>

                {/* Rating selection */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-zinc-700">Your Rating</label>
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((starVal) => {
                      const active = (reviewHoverRating || reviewRating) >= starVal;
                      return (
                        <button
                          key={starVal}
                          type="button"
                          onMouseEnter={() => setReviewHoverRating(starVal)}
                          onMouseLeave={() => setReviewHoverRating(0)}
                          onClick={() => setReviewRating(starVal)}
                          className="p-1 text-2xl transition-transform hover:scale-110 focus:outline-hidden"
                          aria-label={`${starVal} stars`}
                        >
                          <Star
                            size={28}
                            weight={active ? 'fill' : 'regular'}
                            className={active ? 'text-amber-400' : 'text-zinc-300'}
                          />
                        </button>
                      );
                    })}
                    <span className="text-xs font-medium text-zinc-500 ml-2">
                      {reviewHoverRating === 1 || (!reviewHoverRating && reviewRating === 1) ? '1/5 - Terrible' :
                       reviewHoverRating === 2 || (!reviewHoverRating && reviewRating === 2) ? '2/5 - Poor' :
                       reviewHoverRating === 3 || (!reviewHoverRating && reviewRating === 3) ? '3/5 - Average' :
                       reviewHoverRating === 4 || (!reviewHoverRating && reviewRating === 4) ? '4/5 - Good' :
                       '5/5 - Excellent'}
                    </span>
                  </div>
                </div>

                {/* Comment */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-zinc-700">
                    Review Details <span className="text-zinc-400 font-normal">(Optional)</span>
                  </label>
                  <textarea
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    rows={4}
                    placeholder="Share your thoughts about the product quality, performance, and packaging..."
                    className="w-full text-xs rounded-2xl border border-zinc-200 p-3 focus:outline-hidden focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 transition-all resize-none"
                  />
                </div>

                {/* Actions */}
                <div className="pt-2 border-t border-zinc-100 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setReviewModalData(null)}
                    className="px-4 py-2.5 rounded-xl text-xs font-medium text-zinc-600 hover:bg-zinc-100 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingReview}
                    className="px-5 py-2.5 rounded-xl bg-zinc-900 text-white text-xs font-medium hover:bg-zinc-800 transition-all shadow-sm active:scale-95 disabled:opacity-50 flex items-center gap-2"
                  >
                    {isSubmittingReview && <ArrowClockwise size={14} className="animate-spin" />}
                    {isSubmittingReview ? 'Submitting...' : 'Submit Review'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
