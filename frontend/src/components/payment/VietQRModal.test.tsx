import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VietQRModal } from './VietQRModal';
import { PaymentCreateResponse } from '@/types/payment';
import { paymentApi } from '@/services/paymentApi';

const mockPaymentData: PaymentCreateResponse = {
  order_id: '018e38f1-62a2-7000-8000-000000000001',
  order_code: 88992233,
  payment_method: 'VIETQR',
  amount: 250000,
  currency: 'VND',
  qr_code_url: 'https://img.vietqr.io/image/vietinbank-100879630629-compact2.png',
  bank_name: 'Vietinbank',
  bank_account_number: '100879630629',
  account_name: 'ECOMMERCE ENTERPRISE',
  transfer_memo: 'DH88992233',
  expires_at: '2026-09-13T19:15:00Z',
};

describe('VietQRModal Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
      writable: true,
      configurable: true,
    });
  });

  it('does not render when isOpen is false', () => {
    const { container } = render(
      <VietQRModal
        isOpen={false}
        paymentData={mockPaymentData}
        onClose={vi.fn()}
        onPaymentSuccess={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders QR code, bank name, account number, amount and memo correctly', () => {
    render(
      <VietQRModal
        isOpen={true}
        paymentData={mockPaymentData}
        onClose={vi.fn()}
        onPaymentSuccess={vi.fn()}
      />
    );

    expect(screen.getByText(/VietQR \/ PayOS Payment/i)).toBeInTheDocument();
    expect(screen.getByText(/#88992233/i)).toBeInTheDocument();
    expect(screen.getByText('Vietinbank')).toBeInTheDocument();
    expect(screen.getByText('100879630629')).toBeInTheDocument();
    expect(screen.getByText('DH88992233')).toBeInTheDocument();
    expect(screen.getByAltText('VietQR Payment Code')).toBeInTheDocument();
  });

  it('copies account number to clipboard with tactile feedback', async () => {
    render(
      <VietQRModal
        isOpen={true}
        paymentData={mockPaymentData}
        onClose={vi.fn()}
        onPaymentSuccess={vi.fn()}
      />
    );

    const copyButtons = screen.getAllByRole('button', { name: /copy/i });
    expect(copyButtons.length).toBeGreaterThan(0);

    fireEvent.click(copyButtons[0]);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('100879630629');
  });

  it('triggers onPaymentSuccess when payment status check returns PAID', async () => {
    const onPaymentSuccess = vi.fn();
    vi.spyOn(paymentApi, 'getPaymentStatus').mockResolvedValueOnce({
      order_id: mockPaymentData.order_id,
      status: 'PAID',
      amount: 250000,
    });

    render(
      <VietQRModal
        isOpen={true}
        paymentData={mockPaymentData}
        onClose={vi.fn()}
        onPaymentSuccess={onPaymentSuccess}
      />
    );

    const checkBtn = screen.getByRole('button', { name: /Check Payment Status/i });
    fireEvent.click(checkBtn);

    await waitFor(() => {
      expect(paymentApi.getPaymentStatus).toHaveBeenCalledWith(mockPaymentData.order_id);
      expect(onPaymentSuccess).toHaveBeenCalled();
      expect(screen.getByText(/Payment Confirmed!/i)).toBeInTheDocument();
    });
  });
});
