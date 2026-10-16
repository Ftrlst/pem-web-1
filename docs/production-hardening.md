# Production hardening progress

Baseline hardening yang diterapkan setelah review `722a499`:

## Payment gate

- `CONFIRMED` ditolak pada endpoint status generik.
- Konfirmasi hanya melalui `PaymentsService.verify()` atau webhook yang signature-nya valid.
- Nominal dan metode payment divalidasi terhadap order.
- Order yang sudah `PAID` tidak dapat dibatalkan tanpa refund flow.

## Authorization

- Endpoint cancel memiliki role guard.
- Customer hanya dapat membatalkan order miliknya dan hanya sebelum diproses.
- Staff diverifikasi berdasarkan role dan outlet.
- Logout frontend sekarang merevoke refresh-token family di server.

## Concurrency

- Transaksi order, payment confirmation, cancel, expiry, dan inventory memakai serializable transaction.
- `P2034` retry bounded dengan exponential backoff.
- Expiry reservation memakai conditional claim dan tidak bisa double-release.
- Inventory mutation tidak boleh menurunkan `stock` di bawah `reservedStock`.
- Outbox memiliki lease recovery dan dead-letter state.

## Docker/API gateway

- `NEXT_PUBLIC_API_URL` menjadi build argument web image.
- Compose menjalankan migration sebelum API.
- API dipublish untuk development dan Nginx gateway menyediakan same-origin `/api`.
- Kubernetes initContainer dan Ingress ditambahkan.

## Integration tests

`apps/api/test/integration/production-guards.integration.test.ts` mencakup:

- payment gate dan atomic stock consumption;
- ownership pembatalan customer;
- concurrent reservation pada stock satu;
- webhook replay dan amount mismatch;
- refresh-token rotation/reuse.

Test integrasi berjalan otomatis di GitHub Actions dengan PostgreSQL service. Secara lokal, test dilewati bila `TEST_DATABASE_URL` belum diisi.

## Perintah validasi

```bash
pnpm typecheck
pnpm test
TEST_DATABASE_URL=postgresql://... pnpm test:integration
pnpm build
```