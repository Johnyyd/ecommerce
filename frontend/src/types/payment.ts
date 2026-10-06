export interface PaymentCreateRequest {
  order_id: string;
  provider: 'VIETQR' | 'PAYOS' | 'COD' | 'VNPAY' | 'MOMO';
}

export interface PaymentCreateResponse {
  order_id: string;
  order_code: number;
  payment_method: string;
  amount: number;
  currency: string;
  qr_code_url: string;
  checkout_url?: string;
  payment_link_id?: string;
  expires_at?: string;
  bank_name: string;
  bank_account_number?: string;
  account_name: string;
  transfer_memo?: string;
}

export interface PaymentStatusResponse {
  order_id: string;
  status: 'PENDING' | 'PAID' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  amount: number;
  paid_at?: string;
  transaction_id?: string;
}