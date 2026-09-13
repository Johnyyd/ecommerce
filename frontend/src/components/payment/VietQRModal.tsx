import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Copy, 
  Check, 
  Clock, 
  ArrowClockwise, 
  ShieldCheck, 
  CheckCircle, 
  QrCode 
} from '@phosphor-icons/react';
import { PaymentCreateResponse, PaymentStatusResponse } from '@/types/payment';
import { paymentApi } from '@/services/paymentApi';
import { toast } from 'sonner';

interface VietQRModalProps {
  isOpen: boolean;
  paymentData: PaymentCreateResponse | null;
  onClose: () => void;
  onPaymentSuccess: (status: PaymentStatusResponse) => void;
}

export const VietQRModal: React.FC<VietQRModalProps> = ({
  isOpen,
  paymentData,
  onClose,
  onPaymentSuccess,
}) => {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(15 * 60); // 15 minutes
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);

  // Copy to clipboard helper with tactile feedback
  const handleCopy = useCallback((text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    toast.success(`Copied ${fieldName} to clipboard`);
    setTimeout(() => {
      setCopiedField(null);
    }, 2000);
  }, []);

  // Format currency
  const formatVND = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };

  // 15-minute countdown timer
  useEffect(() => {
    if (!isOpen || isSuccess) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isOpen, isSuccess]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const timeFormatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  // Check payment status polling
  const checkPaymentStatus = useCallback(async () => {
    if (!paymentData || isSuccess) return;
    try {
      setIsChecking(true);
      const res = await paymentApi.getPaymentStatus(paymentData.order_id);
      if (res.status === 'PAID' || res.status === 'COMPLETED') {
        setIsSuccess(true);
        toast.success('Payment completed successfully!');
        onPaymentSuccess(res);
      }
    } catch {
      // Background poll silently fails without disrupting user
    } finally {
      setIsChecking(false);
    }
  }, [paymentData, isSuccess, onPaymentSuccess]);

  // Auto-polling every 3 seconds
  useEffect(() => {
    if (!isOpen || isSuccess || !paymentData) return;
    const interval = setInterval(() => {
      checkPaymentStatus();
    }, 3000);
    return () => clearInterval(interval);
  }, [isOpen, isSuccess, paymentData, checkPaymentStatus]);

  // Sandbox simulation trigger for testing
  const handleSimulatePayment = async () => {
    if (!paymentData) return;
    try {
      setIsSimulating(true);
      await paymentApi.simulateWebhookPayment(
        paymentData.order_id,
        paymentData.amount,
        paymentData.order_code
      );
      // Wait slightly then check status
      setTimeout(async () => {
        await checkPaymentStatus();
        setIsSimulating(false);
      }, 800);
    } catch (err: any) {
      toast.error('Simulation error: ' + err.message);
      setIsSimulating(false);
    }
  };

  if (!isOpen || !paymentData) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md overflow-y-auto">
        {/* Apple-style modal surface */}
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
              <div className="w-10 h-10 rounded-2xl bg-zinc-900 text-white flex items-center justify-center shadow-sm">
                <QrCode size={22} weight="bold" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-zinc-900 tracking-tight flex items-center gap-1.5">
                  VietQR / PayOS Payment
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                    24/7 NAPAS Standard
                  </span>
                </h3>
                <p className="text-xs text-zinc-500">Order Code: #{paymentData.order_code}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-zinc-100 text-zinc-500 flex items-center justify-center hover:bg-zinc-200 hover:text-zinc-800 transition-colors"
            >
              <X size={16} weight="bold" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 flex flex-col items-center">
            {isSuccess ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="py-12 flex flex-col items-center text-center"
              >
                <div className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-4">
                  <CheckCircle size={48} weight="fill" />
                </div>
                <h4 className="text-2xl font-bold text-zinc-900 mb-2">Payment Confirmed!</h4>
                <p className="text-sm text-zinc-500 max-w-xs mb-6">
                  We have received your payment of {formatVND(paymentData.amount)} for order #{paymentData.order_code}.
                </p>
                <button
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-full bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-800 transition-all shadow-md active:scale-95"
                >
                  View Orders
                </button>
              </motion.div>
            ) : (
              <>
                {/* Dynamic QR Display */}
                <div className="relative group p-4 rounded-2xl bg-zinc-50 border border-zinc-200/80 shadow-inner flex flex-col items-center">
                  <img
                    src={paymentData.qr_code_url}
                    alt="VietQR Payment Code"
                    className="w-56 h-56 object-contain rounded-xl shadow-sm bg-white p-2"
                  />
                  <div className="mt-3 flex items-center gap-1.5 text-xs text-zinc-600 font-medium">
                    <ShieldCheck size={16} className="text-emerald-600" />
                    <span>Open your Banking app to scan QR</span>
                  </div>
                </div>

                {/* Countdown & Status Banner */}
                <div className="w-full mt-4 flex items-center justify-between px-4 py-2.5 rounded-xl bg-zinc-100 text-xs text-zinc-600">
                  <div className="flex items-center gap-2">
                    <Clock size={16} className="text-zinc-500" />
                    <span>Expires in: <strong className="font-mono text-zinc-900">{timeFormatted}</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <span className="text-zinc-500">Awaiting transfer</span>
                  </div>
                </div>

                {/* Transfer Details Cards */}
                <div className="w-full mt-4 space-y-2.5">
                  {/* Bank Name */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 border border-zinc-100 text-sm">
                    <span className="text-zinc-500 text-xs">Bank</span>
                    <span className="font-medium text-zinc-900">{paymentData.bank_name}</span>
                  </div>

                  {/* Account Number */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 border border-zinc-100 text-sm">
                    <div>
                      <span className="block text-zinc-500 text-xs">Account Number</span>
                      <span className="font-mono font-semibold text-zinc-900">{paymentData.bank_account_number}</span>
                    </div>
                    <button
                      onClick={() => handleCopy(paymentData.bank_account_number, 'Account Number')}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-700 bg-white border border-zinc-200 hover:bg-zinc-100 active:scale-95 transition-all"
                    >
                      {copiedField === 'Account Number' ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                      {copiedField === 'Account Number' ? 'Copied' : 'Copy'}
                    </button>
                  </div>

                  {/* Account Holder */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 border border-zinc-100 text-sm">
                    <span className="text-zinc-500 text-xs">Account Holder</span>
                    <span className="font-medium text-zinc-900 uppercase">{paymentData.account_name}</span>
                  </div>

                  {/* Transfer Amount */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 border border-zinc-100 text-sm">
                    <div>
                      <span className="block text-zinc-500 text-xs">Amount</span>
                      <span className="font-mono font-bold text-base text-zinc-950">{formatVND(paymentData.amount)}</span>
                    </div>
                    <button
                      onClick={() => handleCopy(String(Math.round(paymentData.amount)), 'Amount')}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-700 bg-white border border-zinc-200 hover:bg-zinc-100 active:scale-95 transition-all"
                    >
                      {copiedField === 'Amount' ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                      {copiedField === 'Amount' ? 'Copied' : 'Copy'}
                    </button>
                  </div>

                  {/* Memo / Description */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-amber-50/70 border border-amber-200/60 text-sm">
                    <div>
                      <span className="block text-amber-800 text-xs font-semibold uppercase tracking-wider">
                        Transfer Memo / Note (Required)
                      </span>
                      <span className="font-mono font-bold text-amber-950 text-base tracking-wide">
                        {paymentData.transfer_memo}
                      </span>
                    </div>
                    <button
                      onClick={() => handleCopy(paymentData.transfer_memo, 'Transfer Memo')}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-amber-950 bg-amber-100/80 border border-amber-300 hover:bg-amber-200 active:scale-95 transition-all"
                    >
                      {copiedField === 'Transfer Memo' ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                      {copiedField === 'Transfer Memo' ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>

                {/* Footer action buttons */}
                <div className="w-full mt-6 flex flex-col gap-2.5">
                  <button
                    onClick={checkPaymentStatus}
                    disabled={isChecking}
                    className="w-full py-3 rounded-xl bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-800 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50"
                  >
                    <ArrowClockwise size={16} className={isChecking ? 'animate-spin' : ''} />
                    {isChecking ? 'Verifying transaction...' : 'Check Payment Status'}
                  </button>

                  {/* Sandbox simulation button */}
                  <button
                    onClick={handleSimulatePayment}
                    disabled={isSimulating}
                    className="w-full py-2 rounded-xl text-xs font-medium text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100 transition-colors"
                  >
                    {isSimulating ? 'Simulating transaction...' : '⚡ Sandbox Test: Confirm Payment Instantly'}
                  </button>
                </div>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
