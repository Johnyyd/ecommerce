import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { OrderTrackingTimeline } from './OrderTrackingTimeline';
import { ShippingTimelineResponse } from '@/types/shipping';

describe('OrderTrackingTimeline Component', () => {
  const mockShippingData: ShippingTimelineResponse = {
    tracking_code: 'GHN-SGN-123456',
    carrier_code: 'GHN',
    carrier_name: 'Giao Hàng Nhanh (GHN Express)',
    hotline: '1900 636677',
    website: 'https://ghn.vn',
    current_step: 3,
    current_status: 'IN_TRANSIT',
    current_status_desc: 'Đang luân chuyển qua kho trung chuyển',
    timeline: [
      {
        step: 1,
        status_code: 'READY_TO_PICK',
        title: 'Đã tạo vận đơn',
        subtitle: 'Vận đơn được tạo trên hệ thống GHN Express',
        location: 'Hệ thống GHN API',
        timestamp: '19/09/2026 08:00',
        is_completed: true,
        is_current: false,
      },
      {
        step: 2,
        status_code: 'PICKED_UP',
        title: 'Đã lấy hàng',
        subtitle: 'Tài xế GHN đã nhận hàng từ kho người gửi',
        location: 'Kho tổng Ecommerce, TP. Hồ Chí Minh',
        timestamp: '19/09/2026 09:30',
        is_completed: true,
        is_current: false,
      },
      {
        step: 3,
        status_code: 'IN_TRANSIT',
        title: 'Đang luân chuyển',
        subtitle: 'Kiện hàng đang được trung chuyển qua các bưu cục',
        location: 'Kho phân loại GHN Sài Gòn',
        timestamp: '19/09/2026 11:00',
        is_completed: true,
        is_current: true,
      },
      {
        step: 4,
        status_code: 'DELIVERING',
        title: 'Đang giao hàng',
        subtitle: 'Shipper đang trên đường phát hàng đến địa chỉ nhận',
        location: 'Bưu cục Quận 1 - GHN Express',
        timestamp: '19/09/2026 14:00',
        is_completed: false,
        is_current: false,
      },
      {
        step: 5,
        status_code: 'DELIVERED',
        title: 'Giao thành công',
        subtitle: 'Người nhận đã nhận hàng và xác nhận nguyên vẹn',
        location: 'Điểm nhận hàng',
        timestamp: '19/09/2026 16:00',
        is_completed: false,
        is_current: false,
      },
    ],
  };

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <OrderTrackingTimeline
        isOpen={false}
        onClose={vi.fn()}
        data={mockShippingData}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders tracking code, carrier name and milestones when open', () => {
    const handleClose = vi.fn();
    render(
      <OrderTrackingTimeline
        isOpen={true}
        onClose={handleClose}
        data={mockShippingData}
      />
    );

    // Assert carrier name and tracking code are visible
    expect(screen.getByText('Giao Hàng Nhanh (GHN Express)')).toBeInTheDocument();
    expect(screen.getByText('GHN-SGN-123456')).toBeInTheDocument();

    // Assert milestones appear
    expect(screen.getByText('Đã tạo vận đơn')).toBeInTheDocument();
    expect(screen.getByText('Đã lấy hàng')).toBeInTheDocument();
    expect(screen.getByText('Đang luân chuyển')).toBeInTheDocument();
    expect(screen.getByText('Đang giao hàng')).toBeInTheDocument();
    expect(screen.getByText('Giao thành công')).toBeInTheDocument();

    // Assert close button triggers onClose
    const closeButtons = screen.getAllByRole('button');
    const xButton = closeButtons[0];
    fireEvent.click(xButton);
    expect(handleClose).toHaveBeenCalled();
  });
});
