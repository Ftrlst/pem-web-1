# Operations runbook

## Health

- Liveness: `GET /api/v1/health/live`
- Readiness: `GET /api/v1/health/ready`

Readiness harus gagal jika PostgreSQL tidak dapat dijangkau. Ingress tidak boleh mengirim traffic ke pod yang belum ready.

## Database

1. Backup harian terenkripsi dan point-in-time recovery.
2. Simpan minimal 7 hari daily backup; sesuaikan dengan RPO.
3. Jalankan restore drill ke database staging setiap bulan.
4. Migration hanya melalui reviewed migration file dan `prisma migrate deploy`.
5. Jangan melakukan destructive migration pada jam sibuk tanpa rollback plan.

## Incidents

- Payment webhook failure: pause provider reconciliation, inspect `webhook_event`, retry dari queue, do not manually mark paid tanpa evidence.
- Oversell/negative stock: stop order creation, inspect reservations and movements, reconcile stock, then re-enable setelah verification.
- Redis down: API dapat mempertahankan state di PostgreSQL; queue consumer harus retry/backoff.
- Database unavailable: keep API unready, investigate connection pool/PostgreSQL, restore only after confirming data integrity.

## Release

1. Merge ke `main` setelah CI green.
2. Deploy staging; run smoke test: catalog, login, checkout, manual payment, status transition, stock decrement.
3. Promotion ke production requires environment approval.
4. Monitor error rate, p95 latency, queue lag, DB connections, and stock invariants.
5. Rollback memakai image tag sebelumnya; database migration harus backward-compatible.
