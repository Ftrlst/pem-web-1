import Link from 'next/link';
import { ProductCatalog } from '@/components/product-catalog';

export default function HomePage() {
  return (
    <>
      <section className="hero">
        <div className="container hero-inner">
          <div className="hero-copy">
            <span className="eyebrow">SNACK TRADISIONAL, PENGALAMAN BARU</span>
            <h1>
              Snack kecil,
              <br />
              <em>kebucinean</em> besar.
            </h1>
            <p>
              Kletak-Kletik Snack menyajikan camilan rumahan yang dibuat dengan bahan pilihan, rasa
              yang bikin balik lagi, dan packaging yang menggemaskan.
            </p>
            <div className="hero-actions">
              <Link className="button button-primary" href="#katalog">
                Lihat katalog <span aria-hidden="true">&nbsp;→</span>
              </Link>
              <Link className="button button-ghost" href="/lacak">
                Lacak pesanan
              </Link>
            </div>
            <p className="hero-note">
              ✦ Dibuat setiap hari • Dikemas dengan perhatian • Dikirim dengan presisi
            </p>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="hero-card">
              <span className="snack-emoji">🍌</span>
              <strong>Happy bite!</strong>
              <span>Keripik pisang favorit</span>
            </div>
            <div className="floating-note one">⭐ 4.9 / 5</div>
            <div className="floating-note two">100% rumahan</div>
          </div>
        </div>
      </section>
      <section className="trust-strip">
        <div className="container trust-grid">
          <div className="trust-item">
            <span className="trust-icon">🌿</span>
            <div>
              <strong>Bahan pilihan</strong>
              <span>Rasa yang jujur</span>
            </div>
          </div>
          <div className="trust-item">
            <span className="trust-icon">📦</span>
            <div>
              <strong>Kemasan rapi</strong>
              <span>Selalu baru arrived</span>
            </div>
          </div>
          <div className="trust-item">
            <span className="trust-icon">🛵</span>
            <div>
              <strong>Pengirimanaman</strong>
              <span>Ambil sendiri atau diantar</span>
            </div>
          </div>
        </div>
      </section>
      <ProductCatalog />
      <section className="story-section">
        <div className="container story-grid">
          <div className="story-art" aria-hidden="true">
            🥜
          </div>
          <div className="story-copy">
            <span className="eyebrow">DARI DAPUR KECIL, DENGAN BESAR HATI</span>
            <h2>Setiap mouthful punya cerita.</h2>
            <p>
              Kami membiarkan rasa sederhana tetapFRESH. Dibuat dalam batch kecil, dikemas dengan
              perhatian, dan dikirim supaya tiba dalam kondisi paling enak.
            </p>
            <div className="story-list">
              <div>
                <b>01</b>
                <span>Resep keluarga yang dikurasi.</span>
              </div>
              <div>
                <b>02</b>
                <span>Produk tanpa pewarna buatan.</span>
              </div>
              <div>
                <b>03</b>
                <span>Pesanmu kami siapkan dengan prinsip dan perhatian.</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
