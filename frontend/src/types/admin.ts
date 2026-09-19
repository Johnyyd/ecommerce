export interface ProductItem {
  id: string
  name: string
  description?: string | null
  price: number
  stock_quantity: number
  category_id?: string | null
  brand?: string | null
  rating?: number
  image_url?: string | null
}

export interface BrandItem {
  id: string
  name: string
  slug: string
  logo_url?: string | null
  description?: string | null
  website?: string | null
}

export interface VoucherItem {
  id: string
  code: string
  discount_type: string
  discount_value: number
  min_order_amount: number
  max_discount_amount?: number | null
  usage_limit?: number | null
  times_used: number
  valid_until?: string | null
  is_active: boolean
}

export interface OrderItemDetail {
  id: string
  product_id: string
  quantity: number
  unit_price: number
}

export interface OrderPayment {
  id: string
  status: string
  provider: string
  transaction_id?: string | null
}

export interface OrderData {
  id: string
  user_id: string
  address_id: string
  total_amount: number
  status: string
  payment_method: string
  items: OrderItemDetail[]
  payment?: OrderPayment | null
  created_at?: string
  tracking_code?: string | null
  shipping_provider?: string | null
  shipping_fee?: number | null
  estimated_delivery?: string | null
  shipping_status?: string | null
}

export interface UserData {
  id: string
  username: string
  email: string
  role: string
  is_active: boolean
  created_at: string
}

export interface CategoryData {
  id: string
  name: string
  slug: string
}

export interface BackupFile {
  filename: string
  size_bytes: number
  size_human: string
  created_at: string
}

export interface ProductFormData {
  name: string
  description: string
  price: string
  stock_quantity: string
  category_id?: string
  brand: string
  image_url: string
}

export interface BrandFormData {
  name: string
  slug: string
  logo_url: string
  description: string
  website: string
}

export interface VoucherFormData {
  code: string
  discount_type: string
  discount_value: string
  min_order_amount: string
  max_discount_amount: string
  usage_limit: string
  valid_until: string
  is_active: boolean
}

export interface CategoryFormData {
  name: string
  slug: string
}

export type TabType =
  | "overview"
  | "products"
  | "brands"
  | "vouchers"
  | "orders"
  | "users"
  | "categories"
  | "backups"
  | "async_jobs"
  | "reviews"

export interface AdminReviewItem {
  id: string
  product_id: string
  product_name?: string
  user_id: string
  username?: string
  user_email?: string
  order_id: string
  rating: number
  comment?: string | null
  is_verified_purchase: boolean
  created_at: string
}

export interface AdminOverviewStats {
  totalRevenue: number
  totalOrders: number
  activeUsers: number
  totalProducts: number
}

export interface QueueMetrics {
  worker_status: string
  queued_jobs: number
  active_or_cached_jobs: number
  total_reports_generated: number
  redis_connected: boolean
  timestamp: string
}

export interface SandboxEmail {
  id: string
  recipient: string
  subject: string
  template: string
  context: Record<string, any>
  html_body: string
  sent_at: string
  delivery_mode: string
}

export interface MediaUploadResult {
  file_id: string
  job_id: string
  original_url: string
  variants?: {
    thumb: string
    medium: string
    full: string
  }
  savings_percentage?: number
}

