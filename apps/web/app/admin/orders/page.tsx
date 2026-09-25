'use client';

import { useEffect, useState } from 'react';
import type { OrderResponse, OrderStatus } from '@kletak/contracts';
import { apiFetch } from '@/lib/api';
import { formatRupiah } from '@/lib/format';

const statuses: OrderStatus[] = [
  'PENDING',
  'CONFIRMED',
  'PREPARING',
  'PACKED',
  'READY_DELIVERY',
  'READY_PICKUP',
  'COMPLETED',
  'CANCELLED',
];

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<OrderResponse[]>([]);
  const [error, setError] = useState('');
  async function load() {
    try {
      const result = await apiFetch<{ data: OrderResponse[] }>('/orders?pageSize=50');
      setOrders(result.data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Gagal memuat pesanan');
    }
  }
  useEffect(() => {
    load();
  }, []);
  async function updateStatus(id: string, status: OrderStatus) {
    try {
      await apiFetch(`/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Status gagal diubah');
    }
  }
  return (
    <div className="page-shell">
      <div className="container">
        <div className="page-header">
          <span className="eyebrow">ORDER OPERATIONS</span>
          <h1>Kelola pesanan</h1>
          <p>Status berubah dicatat di audit log dan memicu event internal.</p>
        </div>
        {error ? <div className="notice notice-info">{error}</div> : null}
        <div className="order-list">
          {orders.map((order) => (
            <article className="order-card" key={order.id}>
              <div>
                <h3>{order.orderNumber}</h3>
                <p>
                  {order.customerName} • {formatRupiah(order.totalIdr)}
                </p>
                <span className="status-pill">{order.status}</span>
              </div>
              <select
                className="form-select"
                value={order.status}
                onChange={(event) => updateStatus(order.id, event.target.value as OrderStatus)}
              >
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
