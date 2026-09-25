import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="page-shell">
      <div className="container empty-state">
        <h1>Halaman tidak ditemukan</h1>
        <p>Coba kembali ke katalog untuk menemukan camilan favoritmu.</p>
        <Link className="button button-primary" href="/katalog">
          Kembali ke katalog
        </Link>
      </div>
    </div>
  );
}
