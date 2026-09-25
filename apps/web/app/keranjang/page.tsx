'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { clearCart, readCart, updateCartQuantity } from '@/lib/cart';
import { formatRupiah } from '@/lib/format';
import type { CartItem } from '@/lib/cart';

export default function CartPage() {
  const [items, setItems] = useState<CartItem[]>([]);
  useEffect(() => setItems(readCart()), []);
  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + item.product.priceIdr * item.quantity, 0),
    [items],
  );

  function refresh() {
    setItems(readCart());
  }
  function removeAll() {
    clearCart();
    refresh();
  }

  return (
    <div className="page-shell">
      <div className="container">
        <div className="page-header">
          <span className="eyebrow">YOUR TASTY BAG</span>
          <h1>Keranjang</h1>
          <p>Cek pilihan camilanmu sebelum lanjut ke checkout.</p>
        </div>
        {items.length === 0 ? (
          <div className="empty-state">
            <h2>Keranjang masih kosong</h2>
            <p>Yuk cari bite yang bikin senyum.</p>
            <Link className="button button-primary" href="/katalog">
              Lihat katalog
            </Link>
          </div>
        ) : (
          <div className="cart-layout">
            <div className="content-card cart-list">
              {items.map((item) => (
                <div className="cart-item" key={item.product.id}>
                  <div className="cart-thumb" aria-hidden="true">
                    {item.product.category.toLowerCase().includes('kue')
                      ? '🍰'
                      : item.product.category.toLowerCase().includes('peyek')
                        ? '🥜'
                        : '🍌'}
                  </div>
                  <div>
                    <h3>{item.product.name}</h3>
                    <p>{formatRupiah(item.product.priceIdr)} / pack</p>
                    <div className="quantity-control">
                      <button
                        onClick={() => {
                          updateCartQuantity(item.product.id, item.quantity - 1);
                          refresh();
                        }}
                        aria-label="Kurangi jumlah"
                      >
                        −
                      </button>
                      <span>{item.quantity}</span>
                      <button
                        onClick={() => {
                          updateCartQuantity(
                            item.product.id,
                            Math.min(
                              item.quantity + 1,
                              item.product.stockAvailable || item.quantity + 1,
                            ),
                          );
                          refresh();
                        }}
                        aria-label="Tambah jumlah"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <div className="cart-item-price">
                    {formatRupiah(item.product.priceIdr * item.quantity)}
                  </div>
                </div>
              ))}
              <button className="text-button" onClick={removeAll}>
                Kosongkan keranjang
              </button>
            </div>
            <aside className="content-card summary-card">
              <h2 style={{ marginTop: 0, fontFamily: 'Fraunces, serif' }}>Ringkasan</h2>
              <div className="summary-row">
                <span>Subtotal</span>
                <strong>{formatRupiah(subtotal)}</strong>
              </div>
              <div className="summary-row">
                <span>Ongkir</span>
                <span>Dihitung saat checkout</span>
              </div>
              <div className="summary-row total">
                <span>Total</span>
                <strong>{formatRupiah(subtotal)}</strong>
              </div>
              <Link className="button button-primary button-wide" href="/checkout">
                Lanjut checkout
              </Link>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
