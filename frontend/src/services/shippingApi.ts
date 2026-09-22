import { ShippingFeeResponse, ShippingTimelineResponse } from '@/types/shipping';

const API_BASE_URL = (import.meta as any).env.VITE_API_URL || '/api/v1';

export const shippingApi = {
  async calculateFee(toDistrictId?: number, toWardCode?: string, weightGrams = 1000): Promise<ShippingFeeResponse> {
    const res = await fetch(`${API_BASE_URL}/shipping/calculate-fee`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to_district_id: toDistrictId || 1444,
        to_ward_code: toWardCode || '20308',
        weight_grams: weightGrams,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to calculate shipping fee' }));
      throw new Error(err.detail || 'Failed to calculate shipping fee');
    }
    return res.json();
  },

  async fulfillOrder(orderId: string, token: string): Promise<any> {
    const res = await fetch(`${API_BASE_URL}/shipping/orders/${orderId}/fulfill`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to fulfill shipping order' }));
      throw new Error(err.detail || 'Failed to fulfill shipping order');
    }
    return res.json();
  },

  async getTrackingByCode(trackingCode: string): Promise<ShippingTimelineResponse> {
    const res = await fetch(`${API_BASE_URL}/shipping/tracking/${encodeURIComponent(trackingCode)}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to fetch tracking details' }));
      throw new Error(err.detail || 'Failed to fetch tracking details');
    }
    return res.json();
  },

  async getOrderTracking(orderId: string, token: string): Promise<ShippingTimelineResponse> {
    const res = await fetch(`${API_BASE_URL}/shipping/orders/${orderId}/tracking`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'Failed to fetch order tracking' }));
      throw new Error(err.detail || 'Failed to fetch order tracking');
    }
    return res.json();
  },
};
