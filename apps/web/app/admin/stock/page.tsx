'use client';

import { FormEvent, useEffect, useState } from 'react';
import type { ProductResponse } from '@kletak/contracts';
import { apiFetch, getProducts } from '@/lib/api';

export default function AdminStockPage() {
  const [products, setProducts] = useState<ProductResponse[]>([]);
  const [productId, setProductId] = useState('');
  const [type, setType] = useState('IN');
  const [quantity, setQuantity] = useState('1');
  const [reason, setReason] = useState('Restock');
  const [message, setMessage] = useState('');
  useEffect(() => {
    getProducts({})
      .then((result) => {
        setProducts(result.data);
        if (result.data[0]) setProductId(result.data[0].id);
      })
      .catch(() => undefined);
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await apiFetch('/inventory/movements', {
        method: 'POST',
        body: JSON.stringify({ productId, type, quantity: Number(quantity), reason }),
      });
      setMessage('Pergerakan stok berhasil dicatat.');
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'Gagal menyimpan stok');
    }
  }
  return (
    <div className="page-shell">
      <div className="container">
        <div className="page-header">
          <span className="eyebrow">INVENTORY CONTROL</span>
          <h1>Mutasi stok</h1>
          <p>Setiap perubahan stok memiliki alasan, aktor, dan jejak audit.</p>
        </div>
        <form className="content-card auth-card" onSubmit={submit}>
          <div className="form-field">
            <label htmlFor="product">Produk</label>
            <select
              id="product"
              value={productId}
              onChange={(event) => setProductId(event.target.value)}
            >
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-grid" style={{ marginTop: 15 }}>
            <div className="form-field">
              <label htmlFor="type">Jenis</label>
              <select id="type" value={type} onChange={(event) => setType(event.target.value)}>
                <option value="IN">Stok masuk</option>
                <option value="OUT">Stok keluar</option>
                <option value="DAMAGE">Rusak</option>
                <option value="EXPIRED">Kedaluwarsa</option>
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="quantity">Jumlah</label>
              <input
                id="quantity"
                type="number"
                min="1"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
              />
            </div>
            <div className="form-field full">
              <label htmlFor="reason">Alasan</label>
              <input
                id="reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                required
              />
            </div>
          </div>
          {message ? <p className="form-success">{message}</p> : null}
          <button className="button button-primary button-wide" style={{ marginTop: 18 }}>
            Catat mutasi
          </button>
        </form>
      </div>
    </div>
  );
}
