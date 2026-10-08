import type {
  AuthResponse,
  CreateOrderInput,
  OrderResponse,
  ProductResponse,
} from '@kletak/contracts';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
let accessToken: string | null = null;
let refreshPromise: Promise<boolean> | null = null;

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

async function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_URL}/auth/refresh-token`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
      .then(async (response) => {
        if (!response.ok) return false;
        const data = (await response.json()) as AuthResponse;
        setAccessToken(data.accessToken);
        localStorage.setItem('kletak_user', JSON.stringify(data.user));
        return true;
      })
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

export async function apiFetch<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  });

  if (response.status === 401 && retry && !path.startsWith('/auth/')) {
    if (await refreshAccessToken()) return apiFetch<T>(path, init, false);
  }
  if (!response.ok) {
    let message = `Request gagal (${response.status})`;
    try {
      const payload = (await response.json()) as { message?: string };
      if (payload.message) message = payload.message;
    } catch {
      // Keep the HTTP status message when the body is not JSON.
    }
    throw new ApiError(message, response.status);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export type ProductListResponse = {
  data: ProductResponse[];
  meta: { total: number; page: number; pageSize: number; totalPages: number };
};

export function getProducts(params: { q?: string; category?: string } = {}) {
  const search = new URLSearchParams();
  if (params.q) search.set('q', params.q);
  if (params.category) search.set('category', params.category);
  const suffix = search.toString() ? `?${search.toString()}` : '';
  return apiFetch<ProductListResponse>(`/products${suffix}`);
}

export function createOrder(input: CreateOrderInput, idempotencyKey?: string) {
  return apiFetch<OrderResponse>('/orders', {
    method: 'POST',
    headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
    body: JSON.stringify(input),
  });
}

export function getMyOrders() {
  return apiFetch<{ data: OrderResponse[]; meta: { total: number } }>('/orders?pageSize=50');
}

export function login(email: string, password: string) {
  return apiFetch<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function register(name: string, email: string, phone: string | undefined, password: string) {
  return apiFetch<AuthResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, phone, password }),
  });
}

export function logout() {
  return apiFetch<void>('/auth/logout', { method: 'POST' }, false);
}

export function getProfile() {
  return apiFetch<AuthResponse['user']>('/users/me');
}
