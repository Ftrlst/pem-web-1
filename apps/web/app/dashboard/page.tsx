'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { formatRupiah } from '@/lib/format';
import type { OrderResponse } from '@kletak/contracts';

export default function DashboardPage() {
  const [orders, setOrders] = useState<OrderResponse[]>([]);
  const [lowStock, setLowStock] = useState<Array<{ name: string; stockAvailable: number }>>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      apiFetch<{ data: OrderResponse[] }>('/orders?pageSize=50'),
      apiFetch<Array<{ name: string; stockAvailable: number }>>('/inventory/low-stock'),
    ])
      .then(([orderResponse, stockResponse]) => {
        setOrders(orderResponse.data);
        setLowStock(stockResponse);
      })
      .catch((caught) =>
        setError(caught instanceof Error ? caught.message : 'Dashboard tidak dapat dimuat'),
      );
  }, []);

  const total = orders.reduce((sum, order) => sum + order.totalIdr, 0);
  const pending = orders.filter((order) => order.status === 'PENDING').length;

  return (
    <div className="page-shell">
      <div className="container">
        <div className="page-header">
          <span className="eyebrow">OPERATIONS DESK</span>
          <h1>Dashboard</h1>
          <p>Ringkasan pesanan dan stock untuk operasional Seller/Owner.</p>
        </div>
        {error ? <div className="notice notice-info">{error}</div> : null}
        <div className="dashboard-grid">
          <div className="metric-card">
            <span>Total order</span>
            <strong>{orders.length}</strong>
          </div>
          <div className="metric-card">
            <span>Menunggu pembayaran</span>
            <strong>{pending}</strong>
          </div>
          <div className="metric-card">
            <span>Nilai order</span>
            <strong>{formatRupiah(total)}</strong>
          </div>
        </div>
        <div className="content-card" style={{ marginTop: 24 }}>
          <div className="section-heading" style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: 32 }}>Perlu perhatian</h2>
          </div>
          {lowStock.length === 0 ? (
            <p className="notice notice-info">Stok aman. Tidak ada produk di bawah minimum.</p>
          ) : (
            <div className="order-list">
              {lowStock.map((item) => (
                <div className="order-card" key={item.name}>
                  <div>
                    <h3>{item.name}</h3>
                    <p>Stok tersedia</p>
                  </div>
                  <span className="status-pill danger">{item.stockAvailable} tersisa</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{ marginTop: 20, display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <Link className="button button-primary" href="/admin/orders">
            Kelola pesanan
          </Link>
          <Link className="button button-ghost" href="/admin/products">
            Kelola produk
          </Link>
          <Link className="button button-ghost" href="/admin/stock">
            Kelola stok
          </Link>
        </div>
      </div>
    </div>
  );
}
