'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { OrderResponse } from '@kletak/contracts';
import { getMyOrders } from '@/lib/api';
import { formatDate, formatRupiah } from '@/lib/format';

function statusClass(status: string) {
  if (status === 'COMPLETED') return 'success';
  if (status === 'CANCELLED' || status === 'EXPIRED') return 'danger';
  return '';
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hasUser, setHasUser] = useState(false);

  useEffect(() => {
    const loggedIn = Boolean(localStorage.getItem('kletak_user'));
    setHasUser(loggedIn);
    if (!loggedIn) {
      setLoading(false);
      return;
    }
    getMyOrders()
      .then((response) => setOrders(response.data))
      .catch((caught) =>
        setError(caught instanceof Error ? caught.message : 'Gagal memuat pesanan'),
      )
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="page-shell">
      <div className="container">
        <div className="page-header">
          <span className="eyebrow">YOUR ORDERS</span>
          <h1>Pesanan saya</h1>
          <p>Pantau perjalanan camilanmu dari pembayaran sampai selesai.</p>
        </div>
        {!hasUser ? (
          <div className="empty-state">
            <h2>Masuk untuk melihat pesanan</h2>
            <p>Order tamu tetap bisa dilacak dengan nomor pesanan dan token tracking.</p>
            <Link className="button button-primary" href="/login">
              Masuk
            </Link>
          </div>
        ) : loading ? (
          <div className="skeleton-card" />
        ) : error ? (
          <div className="notice notice-info">{error}</div>
        ) : orders.length === 0 ? (
          <div className="empty-state">
            <h2>Belum ada pesanan</h2>
            <p>Mulai dari katalog dan pilih camilan favoritmu.</p>
            <Link className="button button-primary" href="/katalog">
              Mulai belanja
            </Link>
          </div>
        ) : (
          <div className="order-list">
            {orders.map((order) => (
              <article className="order-card" key={order.id}>
                <div>
                  <h3>{order.orderNumber}</h3>
                  <p>
                    {formatDate(order.scheduledDate)} •{' '}
                    {order.fulfillmentMethod === 'DELIVERY' ? 'Diantar' : 'Ambil sendiri'}
                  </p>
                  <span className={`status-pill ${statusClass(order.status)}`}>
                    {order.status.replaceAll('_', ' ')}
                  </span>
                </div>
                <div className="order-total">
                  <strong>{formatRupiah(order.totalIdr)}</strong>
                  <small>{order.items.length} jenis produk</small>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
