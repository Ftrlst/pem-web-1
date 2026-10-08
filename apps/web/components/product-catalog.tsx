'use client';

import type { ProductResponse } from '@kletak/contracts';
import { useEffect, useMemo, useState } from 'react';
import { addToCart } from '@/lib/cart';
import { getProducts } from '@/lib/api';
import { formatRupiah } from '@/lib/format';
import { ProductVisual } from './product-visual';

const fallbackProducts: ProductResponse[] = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    name: 'Keripik Pisang Original',
    category: 'Keripik',
    priceIdr: 12000,
    stock: 80,
    reservedStock: 0,
    stockAvailable: 80,
    minStock: 10,
    description: 'Keripik pisang renyah, gurih, dan dibuat fresh setiap hari.',
    imageUrl: null,
    isActive: true,
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    name: 'Peyek Kacang Original',
    category: 'Peyek',
    priceIdr: 10000,
    stock: 65,
    reservedStock: 0,
    stockAvailable: 65,
    minStock: 10,
    description: 'Peyek kacang gurih dengan tekstur renyah yang favorit.',
    imageUrl: null,
    isActive: true,
  },
  {
    id: '00000000-0000-0000-0000-000000000003',
    name: 'Peyek Tempe Pedas',
    category: 'Peyek',
    priceIdr: 11000,
    stock: 45,
    reservedStock: 0,
    stockAvailable: 45,
    minStock: 8,
    description: 'Peyek tempe dengan cabai yang pedas nagih.',
    imageUrl: null,
    isActive: true,
  },
  {
    id: '00000000-0000-0000-0000-000000000004',
    name: 'Kue Putu Ayu',
    category: 'Kue',
    priceIdr: 18000,
    stock: 30,
    reservedStock: 0,
    stockAvailable: 30,
    minStock: 5,
    description: 'Kue putu ayu lembut dengan santan premium.',
    imageUrl: null,
    isActive: true,
  },
];

export function ProductCatalog() {
  const [products, setProducts] = useState<ProductResponse[]>([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Semua');
  const [loading, setLoading] = useState(true);
  const [demoMode, setDemoMode] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    getProducts()
      .then((response) => setProducts(response.data))
      .catch(() => {
        setProducts(fallbackProducts);
        setDemoMode(true);
      })
      .finally(() => setLoading(false));
  }, []);

  const categories = useMemo(
    () => ['Semua', ...new Set(products.map((product) => product.category))],
    [products],
  );
  const filtered = useMemo(
    () =>
      products.filter((product) => {
        const matchesCategory = category === 'Semua' || product.category === category;
        const haystack = `${product.name} ${product.description ?? ''}`.toLowerCase();
        return matchesCategory && haystack.includes(query.toLowerCase());
      }),
    [category, products, query],
  );

  function add(product: ProductResponse) {
    if (product.stockAvailable < 1) return;
    addToCart(product);
    setNotice(`${product.name} masuk keranjang`);
    window.setTimeout(() => setNotice(''), 2200);
  }

  return (
    <section className="catalog-section" id="katalog">
      <div className="container">
        <div className="section-heading catalog-heading">
          <div>
            <span className="eyebrow">SNACKS &amp; CHOICES</span>
            <h2>Temukan camilan favoritmu</h2>
            <p>Dibuat dari bahan pilihan, dikemas dengan cerita rasa khas Kletak-Kletik.</p>
          </div>
          <div className="catalog-tools">
            <label className="search-box">
              <span aria-hidden="true">⌕</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Cari camilan..."
              />
            </label>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              aria-label="Filter kategori"
            >
              {categories.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </div>
        </div>
        {demoMode ? (
          <div className="notice notice-info">
            Mode demo aktif — sambungkan API untuk melihat stok dan pesanan live.
          </div>
        ) : null}
        {loading ? (
          <div className="product-grid">
            <div className="skeleton-card" />
            <div className="skeleton-card" />
            <div className="skeleton-card" />
          </div>
        ) : (
          <div className="product-grid">
            {filtered.map((product) => (
              <article className="product-card" key={product.id}>
                <ProductVisual category={product.category} imageUrl={product.imageUrl} />
                <div className="product-card-body">
                  <div className="product-meta">
                    <span>{product.category}</span>
                    <span className={product.stockAvailable < product.minStock ? 'stock-low' : ''}>
                      {product.stockAvailable > 0 ? `${product.stockAvailable} tersedia` : 'Habis'}
                    </span>
                  </div>
                  <h3>{product.name}</h3>
                  <p>{product.description}</p>
                  <div className="product-card-footer">
                    <strong>{formatRupiah(product.priceIdr)}</strong>
                    <button
                      className="button button-primary button-small"
                      onClick={() => add(product)}
                      disabled={product.stockAvailable < 1}
                    >
                      Tambah
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
        {!loading && filtered.length === 0 ? (
          <div className="empty-state">Produk yang dicari tidak ditemukan.</div>
        ) : null}
      </div>
      {notice ? (
        <div className="toast" role="status">
          {notice}
        </div>
      ) : null}
    </section>
  );
}
