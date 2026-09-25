import type { Metadata } from 'next';
import { ProductCatalog } from '@/components/product-catalog';

export const metadata: Metadata = { title: 'Katalog' };

export default function CatalogPage() {
  return (
    <div className="page-shell">
      <div className="container">
        <div className="page-header">
          <span className="eyebrow">THE GOOD STUFF</span>
          <h1>Katalog camilan</h1>
          <p>
            Pilih bite favoritmu. Pesanan bisa ambil sendiri, diantar, atauLANDING dengan pembayaran
            yang aman.
          </p>
        </div>
      </div>
      <ProductCatalog />
    </div>
  );
}
