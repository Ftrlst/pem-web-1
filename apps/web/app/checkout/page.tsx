'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { CreateOrderInput, OrderResponse } from '@kletak/contracts';
import { createOrder } from '@/lib/api';
import { clearCart, readCart } from '@/lib/cart';
import { formatRupiah } from '@/lib/format';

function tomorrow() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

export default function CheckoutPage() {
  const [items, setItems] = useState(readCart());
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [pickup, setPickup] = useState('Kletak-Kletik Snack Pusat');
  const [fulfillment, setFulfillment] = useState<'DELIVERY' | 'PICKUP'>('PICKUP');
  const [payment, setPayment] = useState<'TRANSFER' | 'QRIS' | 'EWALLET' | 'COD'>('TRANSFER');
  const [date, setDate] = useState(tomorrow());
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [order, setOrder] = useState<OrderResponse | null>(null);

  useEffect(() => {
    setItems(readCart());
    try {
      const user = JSON.parse(localStorage.getItem('kletak_user') || '{}') as {
        name?: string;
        phone?: string;
      };
      setName(user.name || '');
      setPhone(user.phone || '');
    } catch {
      /* guest checkout */
    }
  }, []);

  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + item.product.priceIdr * item.quantity, 0),
    [items],
  );
  const shipping = fulfillment === 'DELIVERY' ? 10000 : 0;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (!name.trim()) {
      setError('Nama wajib diisi.');
      return;
    }
    if (fulfillment === 'DELIVERY' && address.trim().length < 10) {
      setError('Alamat delivery minimal 10 karakter.');
      return;
    }
    if (items.length === 0) {
      setError('Keranjang masih kosong.');
      return;
    }
    setBusy(true);
    try {
      const payload = {
        customerName: name.trim(),
        customerPhone: phone.trim() || undefined,
        items: items.map((item) => ({ productId: item.product.id, quantity: item.quantity })),
        fulfillmentMethod: fulfillment,
        scheduledDate: date,
        deliveryAddress: fulfillment === 'DELIVERY' ? address.trim() : undefined,
        pickupLocation: fulfillment === 'PICKUP' ? pickup : undefined,
        paymentMethod: payment,
        customerNote: note.trim() || undefined,
      } as CreateOrderInput;
      const result = await createOrder(payload, crypto.randomUUID());
      setOrder(result);
      clearCart();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Checkout gagal. Coba lagi.');
    } finally {
      setBusy(false);
    }
  }

  if (order) {
    return (
      <div className="page-shell">
        <div className="container">
          <div className="content-card auth-card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 58 }}>🎉</div>
            <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: 36 }}>Pesanan tersimpan!</h1>
            <p className="notice notice-info" style={{ display: 'inline-block' }}>
              {order.orderNumber}
            </p>
            <p style={{ color: 'var(--muted)', fontSize: 12 }}>
              Order ID: <code>{order.id}</code>
            </p>
            <p style={{ color: 'var(--muted)', lineHeight: 1.7 }}>
              Simpan nomor pesanan ini untuk melacak prosesnya. Total{' '}
              <strong>{formatRupiah(order.totalIdr)}</strong>.
            </p>
            {order.trackingToken ? (
              <p className="form-success">
                Simpan token tracking ini:{' '}
                <code style={{ overflowWrap: 'anywhere' }}>{order.trackingToken}</code>
              </p>
            ) : null}
            <Link className="button button-primary" href="/katalog">
              Kembali ke katalog
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className="container">
        <div className="page-header">
          <span className="eyebrow">ALMOST THERE</span>
          <h1>Checkout</h1>
          <p>Pilih cara mengambil dan pembayaran yang paling nyaman.</p>
        </div>
        <form className="cart-layout" onSubmit={submit}>
          <div className="content-card">
            <div className="form-grid">
              <div className="form-field">
                <label htmlFor="name">Nama</label>
                <input
                  id="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Nama lengkap"
                  required
                />
              </div>
              <div className="form-field">
                <label htmlFor="phone">Nomor HP (opsional)</label>
                <input
                  id="phone"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="08xxxxxxxxxx"
                />
              </div>
              <div className="form-field full">
                <label htmlFor="date">Tanggal pesanan</label>
                <input
                  id="date"
                  type="date"
                  min={tomorrow()}
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                  required
                />
              </div>
              <div className="form-field full">
                <label>Metode pengambilan</label>
                <div className="auth-switch">
                  <button
                    type="button"
                    className={fulfillment === 'PICKUP' ? 'active' : ''}
                    onClick={() => setFulfillment('PICKUP')}
                  >
                    Ambil sendiri
                  </button>
                  <button
                    type="button"
                    className={fulfillment === 'DELIVERY' ? 'active' : ''}
                    onClick={() => setFulfillment('DELIVERY')}
                  >
                    Diantar
                  </button>
                </div>
              </div>
              {fulfillment === 'DELIVERY' ? (
                <div className="form-field full">
                  <label htmlFor="address">Alamat delivery</label>
                  <textarea
                    id="address"
                    value={address}
                    onChange={(event) => setAddress(event.target.value)}
                    placeholder="Nama jalan, nomor rumah, kelurahan, kota"
                    required
                  />
                </div>
              ) : (
                <div className="form-field full">
                  <label htmlFor="pickup">Lokasi pengambilan</label>
                  <input
                    id="pickup"
                    value={pickup}
                    onChange={(event) => setPickup(event.target.value)}
                    required
                  />
                </div>
              )}
              <div className="form-field full">
                <label htmlFor="payment">Metode pembayaran</label>
                <select
                  id="payment"
                  className="form-select"
                  value={payment}
                  onChange={(event) => setPayment(event.target.value as typeof payment)}
                >
                  <option value="TRANSFER">Transfer bank</option>
                  <option value="QRIS">QRIS</option>
                  <option value="EWALLET">E-wallet</option>
                  <option value="COD">COD (delivery)</option>
                </select>
              </div>
              <div className="form-field full">
                <label htmlFor="note">Catatan (opsional)</label>
                <textarea
                  id="note"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Rasa,pedas, atau permintaan khusus"
                />
              </div>
            </div>
            {error ? (
              <p className="form-error" role="alert">
                {error}
              </p>
            ) : null}
            <div className="form-actions">
              <button className="button button-primary" disabled={busy}>
                {busy ? 'Menyimpan…' : 'Konfirmasi pesanan'}
              </button>
              <Link className="text-button" href="/keranjang">
                Kembali ke keranjang
              </Link>
            </div>
          </div>
          <aside className="content-card summary-card">
            <h2 style={{ marginTop: 0, fontFamily: 'Fraunces, serif' }}>Pesananmu</h2>
            {items.map((item) => (
              <div className="summary-row" key={item.product.id}>
                <span>
                  {item.quantity}× {item.product.name}
                </span>
                <strong>{formatRupiah(item.product.priceIdr * item.quantity)}</strong>
              </div>
            ))}
            <div className="summary-row">
              <span>Ongkir</span>
              <strong>{shipping ? formatRupiah(shipping) : 'Gratis'}</strong>
            </div>
            <div className="summary-row total">
              <span>Total</span>
              <strong>{formatRupiah(subtotal + shipping)}</strong>
            </div>
          </aside>
        </form>
      </div>
    </div>
  );
}
