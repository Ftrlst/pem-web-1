'use client';

import { FormEvent, useState } from 'react';
import type { OrderResponse } from '@kletak/contracts';
import { apiFetch } from '@/lib/api';
import { formatDate, formatRupiah } from '@/lib/format';

export default function TrackPage() {
  const [orderId, setOrderId] = useState('');
  const [token, setToken] = useState('');
  const [order, setOrder] = useState<OrderResponse | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setOrder(null);
    try {
      const result = await apiFetch<OrderResponse>(
        `/orders/${encodeURIComponent(orderId.trim())}/tracking?token=${encodeURIComponent(token.trim())}`,
      );
      setOrder(result);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Pesanan tidak ditemukan');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-shell">
      <div className="container">
        <div className="page-header">
          <span className="eyebrow">ORDER TRACKING</span>
          <h1>Lacak pesanan</h1>
          <p>Masukkan order ID dan tracking token yang kamu dapatkan saat checkout.</p>
        </div>
        <div className="content-card auth-card">
          <form onSubmit={submit}>
            <div className="form-field">
              <label htmlFor="order-id">Order ID</label>
              <input
                id="order-id"
                value={orderId}
                onChange={(event) => setOrderId(event.target.value)}
                placeholder="UUID pesanan"
                required
              />
            </div>
            <div className="form-field" style={{ marginTop: 15 }}>
              <label htmlFor="token">Tracking token</label>
              <input
                id="token"
                value={token}
                onChange={(event) => setToken(event.target.value)}
                placeholder="Token dari halaman checkout"
                required
              />
            </div>
            {error ? <p className="form-error">{error}</p> : null}
            <button
              className="button button-primary button-wide"
              style={{ marginTop: 20 }}
              disabled={busy}
            >
              {busy ? 'Mencari…' : 'Lacak pesanan'}
            </button>
          </form>
        </div>
        {order ? (
          <div className="content-card" style={{ marginTop: 20 }}>
            <div className="order-card" style={{ padding: 0, border: 0 }}>
              <div>
                <h3>{order.orderNumber}</h3>
                <p>
                  {formatDate(order.scheduledDate)} • {order.status.replaceAll('_', ' ')}
                </p>
              </div>
              <strong>{formatRupiah(order.totalIdr)}</strong>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
