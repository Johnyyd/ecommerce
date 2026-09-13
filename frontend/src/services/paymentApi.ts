import { PaymentCreateResponse, PaymentStatusResponse } from '@/types/payment';

const API_BASE_URL = '/api/v1';

async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const token = localStorage.getItem('access_token') || localStorage.getItem('token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, { ...options, headers });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'API request failed');
  }
  return response.json();
}

export const paymentApi = {
  async createPaymentLink(orderId: string, provider: 'VIETQR' | 'PAYOS' = 'VIETQR'): Promise<PaymentCreateResponse> {
    return fetchWithAuth(`${API_BASE_URL}/payments/create`, {
      method: 'POST',
      body: JSON.stringify({ order_id: orderId, provider }),
    });
  },

  async getPaymentStatus(orderId: string): Promise<PaymentStatusResponse> {
    return fetchWithAuth(`${API_BASE_URL}/payments/${orderId}/status`);
  },

  async simulateWebhookPayment(_orderId: string, amount: number, orderCode: number): Promise<any> {
    // Calls webhook with mock HMAC / mock signature or simulation endpoint
    return fetch(`${API_BASE_URL}/payments/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: '00',
        desc: 'Success',
        success: true,
        data: {
          orderCode,
          amount,
          description: `DH${orderCode}`,
          accountNumber: '0987654321',
          reference: `SIM_${Date.now()}`,
          transactionDateTime: new Date().toISOString(),
          currency: 'VND',
          paymentLinkId: `plink_${orderCode}`
        },
        signature: 'SIMULATION_BYPASS'
      })
    }).then(res => res.json()).catch(() => ({ status: 'simulated' }));
  }
};
