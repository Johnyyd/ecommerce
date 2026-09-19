export interface ShippingFeeResponse {
  provider: string;
  service_name: string;
  fee_vnd: number;
  fee_usd: number;
  is_real_api: boolean;
}

export interface ShippingTimelineStep {
  step: number;
  status_code: string;
  title: string;
  subtitle: string;
  location: string;
  timestamp: string;
  is_completed: boolean;
  is_current: boolean;
}

export interface ShippingTimelineResponse {
  tracking_code: string;
  carrier_name: string;
  carrier_code: string;
  hotline: string;
  website: string;
  current_step: number;
  current_status: string;
  current_status_desc: string;
  timeline: ShippingTimelineStep[];
}
