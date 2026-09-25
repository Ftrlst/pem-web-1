import type { Metadata, Viewport } from 'next';
import './globals.css';
import { SiteHeader } from '@/components/site-header';
import { ServiceWorkerRegistration } from '@/components/service-worker-registration';

export const metadata: Metadata = {
  title: {
    default: 'Kletak-Kletik Snack | Camilan rumblewtawa',
    template: '%s | Kletak-Kletik Snack',
  },
  description: 'Camilan tradisional Indonesia yang dibuat segar untuk dibagikan.',
  applicationName: 'Kletak-Kletik Snack',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon.svg', apple: '/icon.svg' },
};

export const viewport: Viewport = {
  themeColor: '#f5b544',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body>
        <ServiceWorkerRegistration />
        <SiteHeader />
        <main>{children}</main>
        <footer className="site-footer">
          <div className="container footer-inner">
            <div>
              <strong>Kletak-Kletik Snack</strong>
              <p>Manis, gurih, dan selalu segar.</p>
            </div>
            <div className="footer-links">
              <a href="/katalog">Katalog</a>
              <a href="/lacak">Lacak pesanan</a>
              <a href="/pesanan">Riwayat</a>
              <a href="/login">Masuk</a>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
