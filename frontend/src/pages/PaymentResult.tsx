import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { Navbar } from '@/components/layout/Navbar';
import { toast } from 'sonner';

export function PaymentResult() {
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'IDLE' | 'SUCCESS' | 'FAILED'>('IDLE');
  
  const searchParams = new URLSearchParams(window.location.search);
  const orderId = searchParams.get('order_id');
  const method = searchParams.get('method');
  const amount = searchParams.get('amount');
  const mockSecret = searchParams.get('mock_secret');

  useEffect(() => {
    if (!orderId) {
      setLocation('/profile');
    }
  }, [orderId, setLocation]);

  const API_URL = (import.meta as any).env.VITE_API_URL || 'http://127.0.0.1/api/v1';

  const handlePayment = async (result: 'SUCCESS' | 'FAILED') => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/payments/webhook?order_id=${orderId}&status=${result}&mock_secret=${mockSecret}`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Webhook failed');
      
      setStatus(result);
      if (result === 'SUCCESS') {
        toast.success('Payment completed successfully!');
      } else {
        toast.error('Payment failed or was cancelled.');
      }
      setTimeout(() => setLocation('/profile'), 2000);
    } catch (error) {
      console.error(error);
      toast.error('Error processing payment simulation');
      setLoading(false);
    }
  };

  if (!orderId) return null;

  return (
    <>
      <Navbar />
      <main className="min-h-screen pt-32 pb-24 px-4 md:px-12 bg-zinc-50 flex flex-col items-center justify-center">
        <div className="bg-white rounded-[2rem] p-12 border border-zinc-100 shadow-sm max-w-md w-full text-center">
          
          {status === 'IDLE' ? (
            <>
              <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <h1 className="text-2xl font-medium tracking-tight text-zinc-900 mb-2">
                Mock Payment Gateway
              </h1>
              <p className="text-zinc-500 mb-8">
                You are paying <strong>${amount}</strong> via {method}.
              </p>
              
              <div className="flex flex-col gap-4">
                <button
                  onClick={() => handlePayment('SUCCESS')}
                  disabled={loading}
                  className="w-full bg-zinc-900 text-white font-medium py-3 rounded-xl hover:bg-zinc-800 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Processing...' : 'Simulate Success'}
                </button>
                <button
                  onClick={() => handlePayment('FAILED')}
                  disabled={loading}
                  className="w-full bg-red-50 text-red-600 font-medium py-3 rounded-xl hover:bg-red-100 transition-colors disabled:opacity-50"
                >
                  Simulate Failure
                </button>
              </div>
            </>
          ) : (
            <>
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 ${status === 'SUCCESS' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                {status === 'SUCCESS' ? (
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
              </div>
              <h1 className="text-2xl font-medium tracking-tight text-zinc-900 mb-2">
                {status === 'SUCCESS' ? 'Payment Successful' : 'Payment Failed'}
              </h1>
              <p className="text-zinc-500">
                Redirecting you back to your profile...
              </p>
            </>
          )}

        </div>
      </main>
    </>
  );
}
