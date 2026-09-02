const API_BASE_URL = '/api/v1'

export interface OrderItemCreate {
  product_id: string
  quantity: number
}

export interface OrderCreate {
  items: OrderItemCreate[]
}

export interface OrderItemResponse {
  id: string
  product_id: string
  quantity: number
  unit_price: number
}

export interface OrderResponse {
  id: string
  user_id: string
  total_amount: number
  status: string
  items: OrderItemResponse[]
}

async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const token = localStorage.getItem('access_token')
  if (!token) {
    throw new Error('Not authenticated')
  }

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    ...options.headers,
  }

  const response = await fetch(url, { ...options, headers })
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.detail || 'API request failed')
  }
  return response.json()
}

export async function createOrder(data: OrderCreate): Promise<OrderResponse> {
  return fetchWithAuth(`${API_BASE_URL}/orders/`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function getUserOrders(): Promise<OrderResponse[]> {
  return fetchWithAuth(`${API_BASE_URL}/orders/`)
}
