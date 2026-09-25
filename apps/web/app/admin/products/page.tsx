'use client';

import { FormEvent, useEffect, useState } from 'react';
import type { ProductResponse } from '@kletak/contracts';
import { apiFetch, getProducts } from '@/lib/api';
import { formatRupiah } from '@/lib/format';

export default function AdminProductsPage() {
  const [products, setProducts] = useState<ProductResponse[]>([]);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Keripik');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('0');
  const [minStock, setMinStock] = useState('5');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      setProducts((await getProducts({})).data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Gagal memuat produk');
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await apiFetch<ProductResponse>('/products', {
        method: 'POST',
        body: JSON.stringify({
          name,
          category,
          priceIdr: Number(price),
          stock: Number(stock),
          minStock: Number(minStock),
        }),
      });
      setName('');
      setPrice('');
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Produk gagal disimpan');
    } finally {
      setBusy(false);
    }
  }

  async function deactivate(id: string) {
    try {
      await apiFetch(`/products/${id}`, { method: 'DELETE' });
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Produk gagal dinonaktifkan');
    }
  }

  return (
    <div className="page-shell">
      <div className="container">
        <div className="page-header">
          <span className="eyebrow">CATALOG OPERATIONS</span>
          <h1>Kelola produk</h1>
          <p>Tambah harga, deskripsi, dan stok awal produk.</p>
        </div>
        <div className="cart-layout">
          <form className="content-card" onSubmit={submit}>
            <h2 style={{ marginTop: 0, fontFamily: 'Fraunces, serif' }}>Produk baru</h2>
            <div className="form-grid">
              <div className="form-field full">
                <label htmlFor="product-name">Nama produk</label>
                <input
                  id="product-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                />
              </div>
              <div className="form-field">
                <label htmlFor="category">Kategori</label>
                <input
                  id="category"
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  required
                />
              </div>
              <div className="form-field">
                <label htmlFor="price">Harga (Rp)</label>
                <input
                  id="price"
                  type="number"
                  min="1"
                  value={price}
                  onChange={(event) => setPrice(event.target.value)}
                  required
                />
              </div>
              <div className="form-field">
                <label htmlFor="stock">Stok</label>
                <input
                  id="stock"
                  type="number"
                  min="0"
                  value={stock}
                  onChange={(event) => setStock(event.target.value)}
                  required
                />
              </div>
              <div className="form-field">
                <label htmlFor="min-stock">Stok minimum</label>
                <input
                  id="min-stock"
                  type="number"
                  min="0"
                  value={minStock}
                  onChange={(event) => setMinStock(event.target.value)}
                  required
                />
              </div>
            </div>
            {error ? <p className="form-error">{error}</p> : null}
            <button className="button button-primary" style={{ marginTop: 18 }} disabled={busy}>
              {busy ? 'Menyimpan…' : 'Simpan produk'}
            </button>
          </form>
          <div className="content-card">
            <h2 style={{ marginTop: 0, fontFamily: 'Fraunces, serif' }}>Produk aktif</h2>
            <div className="order-list">
              {products.map((product) => (
                <div className="order-card" key={product.id}>
                  <div>
                    <h3>{product.name}</h3>
                    <p>
                      {product.category} • {product.stockAvailable} tersedia
                    </p>
                  </div>
                  <div className="order-total">
                    <strong>{formatRupiah(product.priceIdr)}</strong>
                    <button className="text-button" onClick={() => deactivate(product.id)}>
                      Nonaktifkan
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
