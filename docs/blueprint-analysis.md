# Analisis Blueprint Kletak-Kletik Snack

> Status: baseline implementasi repository
> Sumber: `blueprint_kletak-kletik-snack.docx`
> Tanggal analisis: 25 September 2026

## 1. Ringkasan

Blueprint ini mendefinisikan aplikasi PWA untuk operasional UMKM snack dengan domain utama:

- katalog dan pemesanan pelanggan;
- stok dan movements;
- pembayaran;
- status/lacak pesanan;
- chat seller-pelanggan;
- pembukuan double-entry;
- audit trail dan notifikasi.

Arah **modular monolith + event-driven** sudah tepat untuk MVP dan lebih mudah dioperasikan daripada microservices. Namun blueprint masih berupa conceptually complete architecture, bukan spesifikasi yang dapat langsung dideploy dengan aman.

## 2. Temuan penting

### Yang sudah baik

- Pemisahan bounded context (`order`, `inventory`, `payment`, `chat`, `accounting`) jelas.
- MySQL dipilih untuk implementasi karena merupakan platform operasional yang tersedia di lingkungan deployment; order, inventory, payment, dan accounting tetap membutuhkan transaksi ACID.
- State machine pesanan, pembayaran, dan stok sudah diperiksa.
- Ada awareness terhadap idempotensi webhook, audit log, RBAC, PWA, queue, monitoring, dan deployment.
- Roadmap bertahap memisahkan MVP dari integrasi eksternal.

### Gap yang harus ditutup sebelum production

1. **Stok dan reservasi**
   - Blueprint hanya menambah `stock_movement`; belum ada model reservasi.
   - Dua pelanggan dapat checkout produk yang sama sebelum pembayaran selesai.
   - Implementasi baseline menggunakan `stock + reserved_stock` dan `inventory_reservation`.

2. **Konsistensi lintas modul**
   - “Event internal” saja tidak cukup untuk deployment multi-instance.
   - Perubahan database dan publish event harus atomik. Implementasi baseline memakai **transactional outbox** + BullMQ/Redis.

3. **Payment webhook**
   - Perlu verifikasi signature, anti-replay, idempotency, validasi amount/currency, dan status reconciliation.
   - Callback tidak boleh langsung mempercayai payload frontend.
   - Integrasi provider dibuat melalui adapter; MVP dapat memakai manual verification.

4. **Multi-tenant/outlet**
   - Role saja belum cukup untuk mencegah seller akses ke outlet lain.
   - Semua entity operasional memiliki `outlet_id` sejak awal, walaupun MVP satu outlet.

5. **Akuntansi**
   - `JournalEntry` saja belum menjamin pembukuan konsisten.
   - Setiap posting harus balanced, immutable setelah posted, memiliki reversal, dan memakai tipe akun yang benar.
   - Mapping event ke jurnal harus eksplisit; tidak semua status order otomatis menjadi pendapatan.

6. **PWA dan data sensitif**
   - Offline tidak boleh melakukan pembayaran atau mutation tanpa sinkronisasi aman.
   - Catalog/status dapat di-cache, tetapi halaman akun, chat, dan admin tidak boleh masuk shared cache.
   - Refresh token harus `HttpOnly`, `Secure`, `SameSite`, diputar, dan dapat direvoke.

7. **Observability dan operational readiness**
   - Availability `>99,5%` perlu SLO, alert, backup, restore drill, RPO/RTO, health/readiness endpoint, dan runbook.
   - Satu VM + MySQL self-hosted harus punya backup terenkripsi dan monitoring; Kubernetes tidak perlu untuk MVP.

8. **API contract**
   - Blueprint memakai path tanpa versi dan beberapa path tidak konsisten (`/orders{id}`).
   - Implementasi baseline memakai `/api/v1`, pagination, error envelope, OpenAPI, dan idempotency key.

## 3. Keputusan implementasi baseline

| Area | Keputusan |
|---|---|
| Runtime | Node.js 22/24 LTS, TypeScript |
| Monorepo | pnpm workspaces: `apps/web`, `apps/api`, `packages/contracts` |
| Frontend | Next.js App Router, React, CSS mobile-first, PWA |
| Backend | NestJS modular monolith |
| Database | MySQL 8.4+ |
| Queue | Transactional outbox MySQL di baseline; Redis + BullMQ menjadi adapter queue untuk notification/invoice pada fase berikutnya |
| Auth | JWT access pendek + refresh rotation di cookie HttpOnly, Argon2id, RBAC + outlet scope |
| Uang | integer rupiah (`BIGINT`), tanpa floating point |
| Waktu | `DATETIME(3)` dengan konfigurasi sesi `Asia/Jakarta` |
| Payment | `PaymentProvider` adapter; manual/transfer untuk baseline, Midtrans/Xendit nanti |
| Observability | structured log + request ID, health/readiness, metrics hook, Sentry-compatible DSN |
| CI/CD | GitHub Actions, CodeQL, dependency review, image scan, SBOM, preview/staging/production promotion |

> **Catatan keputusan database:** blueprint awal merekomendasikan PostgreSQL. Repository ini sengaja dimigrasikan ke MySQL 8.4 agar sesuai dengan platform operasional yang tersedia. Prisma schema, migration SQL, Docker Compose, CI service, dan integration test harus selalu menggunakan MySQL; jangan mencampur URL atau dialect PostgreSQL.

## 4. Model transaksi yang dipilih

### Checkout

1. Backend mengambil harga dari database; harga dari client tidak dipercaya.
2. Backend memvalidasi stok tersedia (`stock - reserved_stock >= quantity`).
3. Order dibuat pada status `PENDING` dan jumlah stok dicadangkan.
4. Reservation memiliki expiry dan dilepas saat order expired/cancelled.
5. Event `OrderCreated` ditulis ke outbox dalam transaksi yang sama.
6. Payment confirmation mengunci order, memvalidasi transisi, dan mengekstrak stok secara atomik.
7. Setiap perubahan status, pembayaran, dan stok menulis audit log.

### Payment

Status pembayaran dipisahkan dari status order:

`UNPAID -> PENDING -> PAID | FAILED | EXPIRED`, dengan `REFUNDED` sebagai terminal state refund.

Order tidak boleh dianggap lunas hanya karena redirect browser; hanya callback tervalidasi atau verifikasi staff yang boleh mengubah state.

## 5. Fase implementasi

### Fase 0 — Production baseline (dimulai di repository ini)

- struktur monorepo dan contracts;
- konfigurasi environment yang tervalidasi;
- MySQL schema/migration dan seed;
- health/readiness, error envelope, request ID;
- auth register/login/refresh/logout, RBAC;
- katalog, order, reservation, inventory, payment manual;
- audit log, outbox, Docker Compose;
- GitHub Actions, Dependabot, CodeQL, issue/PR templates;
- PWA shell dengan cache catalog yang aman.

### Fase 1 — MVP closed loop

- UI customer: katalog, cart, checkout, tracking;
- UI staff/owner: orders, products, stock;
- manual transfer/COD flow;
- unit/integration/e2e tests dan load test dasar;
- backup/restore serta runbook operasional.

### Fase 2 — Payment production

- pilih satu provider (Midtrans **atau** Xendit);
- signature verification, webhook inbox, reconciliation job;
- invoice/PDF, reminder, refund, reconciliation dashboard.

### Fase 3 — Realtime dan notification

- Socket.IO dengan Redis adapter;
- room authorization dan message persistence;
- Web Push (VAPID), WhatsApp via BSP resmi;
- retry/dead-letter handling.

### Fase 4 — Accounting dan multi-outlet

- COA migration, opening balance, posting/reversal, period close;
- laporan laba rugi, balance sheet, cash flow, sales;
- owner dashboard dan outlet-scoped RBAC.

## 6. Acceptance criteria “production-ready”

Aplikasi belum boleh disebut production-ready hanya karena bisa `npm run dev`. Minimal harus memenuhi:

- [ ] migrations berjalan otomatis dan rollback/compatibility diperiksa;
- [ ] health/readiness dan graceful shutdown;
- [ ] tidak ada secret di GitHub/repo/log;
- [ ] dependency dan container scan lulus;
- [ ] auth rate-limit, rotation, revoke, dan authorization ownership diuji;
- [ ] concurrency test membuktikan tidak terjadi oversell;
- [ ] webhook duplicate/out-of-order diuji;
- [ ] backup terenkripsi dan restore drill terdokumentasi;
- [ ] PWA tidak menyimpan data sensitif di cache offline;
- [ ] Sentry/error tracking dan alert expiry reservation aktif;
- [ ] backup target RPO/RTO disetujui owner;
- [ ] staging smoke test dan rollback release terdokumentasi.

## 7. GitHub ecosystem

Repository dikonfigurasi sebagai:

- **Issues + Projects**: backlog, bug, release checklist;
- **Pull Requests**: review wajib, perubahan migration/API wajib label;
- **Actions**: CI, preview image, staging deploy, production manual approval;
- **Dependabot**: npm dan GitHub Actions updates;
- **CodeQL/Dependency Review**: security scanning;
- **Environments/Secrets**: `preview`, `staging`, `production` tanpa kredensial production di branch;
- **Releases**: semantic versioning dan changelog;
- **CODEOWNERS**: wajib review owner/tech lead untuk auth, payment, migration.

## 8. Hal yang masih membutuhkan keputusan bisnis

- provider pembayaran pertama;
- nama akun bank danrekening resmi yang boleh ditampilkan;
- kebijakan ongkir, minimum order, area delivery, dan cancellation;
- apakah harga/PRODUK per outlet berbeda;
- kebijakan retensi dan penghapusan data;
- target RPO/RTO, budget, dan provider hosting.
