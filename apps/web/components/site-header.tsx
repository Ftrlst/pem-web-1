'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { cartCount, readCart } from '@/lib/cart';
import { logout as logoutSession, setAccessToken } from '@/lib/api';

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [count, setCount] = useState(0);
  const [user, setUser] = useState<{ name: string; role: string } | null>(null);

  useEffect(() => {
    const sync = () => setCount(cartCount(readCart()));
    sync();
    window.addEventListener('storage', sync);
    window.addEventListener('kletak-cart-updated', sync);
    try {
      const stored = localStorage.getItem('kletak_user');
      if (stored) setUser(JSON.parse(stored));
    } catch {
      setUser(null);
    }
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('kletak-cart-updated', sync);
    };
  }, [pathname]);

  async function logout() {
    try {
      await logoutSession();
    } catch {
      // Clear the client state even if the session already expired.
    }
    setAccessToken(null);
    localStorage.removeItem('kletak_user');
    setUser(null);
    router.push('/');
  }

  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link className="brand" href="/" aria-label="Kletak-Kletik Snack home">
          <span className="brand-mark">K</span>
          <span>
            <strong>Kletak-Kletik</strong>
            <small>SNACK • CERIA • BERMANIS</small>
          </span>
        </Link>
        <nav className="main-nav" aria-label="Navigasi utama">
          <Link className={pathname === '/' ? 'active' : ''} href="/">
            Beranda
          </Link>
          <Link className={pathname?.startsWith('/katalog') ? 'active' : ''} href="/katalog">
            Katalog
          </Link>
          <Link className={pathname?.startsWith('/pesanan') ? 'active' : ''} href="/pesanan">
            Pesanan
          </Link>
          {user && user.role !== 'CUSTOMER' ? <Link href="/dashboard">Dashboard</Link> : null}
        </nav>
        <div className="header-actions">
          <Link className="cart-link" href="/keranjang" aria-label={`Keranjang, ${count} item`}>
            <span aria-hidden="true">🛒</span>
            {count > 0 ? <b>{count}</b> : null}
          </Link>
          {user ? (
            <button className="text-button" onClick={logout}>
              Keluar
            </button>
          ) : (
            <Link className="button button-small button-ghost" href="/login">
              Masuk
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
