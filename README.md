# Kletak-Kletik Snack

Kletak-Kletik Snack adalah baseline produksi untuk aplikasi operasional UMKM snack: katalog, pemesanan, reservasi stok, pembayaran, audit, dan PWA.

Blueprint sumber ada di `blueprint_kletak-kletik-snack.docx`. Analisis dan keputusan implementasi ada di `docs/blueprint-analysis.md`.

## Stack

- `apps/web` — Next.js App Router, React, TypeScript, PWA shell
- `apps/api` — NestJS modular monolith, REST/OpenAPI, Prisma/MySQL
- `packages/contracts` — schema Zod dan tipe bersama
- Redis + BullMQ — target queue adapter; baseline memakai transactional outbox MySQL

Setup database lokal via MySQL Workbench ada di `docs/mysql-local-setup.md`.
- GitHub Actions — CI, security scanning, build, dan deployment promotion

## Menjalankan lokal

Prasyarat: Node.js 22.14+ dan npm 10+.

```bash
corepack enable
pnpm install
cp .env.example .env
pnpm db:generate
pnpm db:migrate:deploy
pnpm db:seed
pnpm dev
```

- Web: `http://localhost:3000`
- API: `http://localhost:4000/api/v1`
- Health: `http://localhost:4000/api/v1/health/ready`

Docker Compose (butuh Docker Desktop/Engine):

```bash
docker compose -f infra/docker-compose.yml --env-file .env up --build
```

Compose menyediakan tiga entrypoint:

- Web langsung: `http://localhost:3000`
- API langsung: `http://localhost:4000/api/v1`
- Gateway Nginx: `http://localhost:8080` (rekomendasi untuk pengujian same-origin)

## MySQL lokal (MySQL Workbench)

Project ini memakai **MySQL 8.0+**, bukan MariaDB. Di mesin lokal ini port 3306 dipakai MariaDB 10.4 (menyimpan database project lain), sehingga MySQL 8.0 dipindahkan ke port **3307**.

1. Jalankan MySQL 8.0 di port 3307 (PowerShell sebagai Administrator):
   ```powershell
   powershell -ExecutionPolicy Bypass -File .\scripts\start-mysql8-on-3307.ps1
   ```
2. Di MySQL Workbench, sambungkan ke MySQL 8.0 port 3307, muat dan jalankan `infra/mysql/bootstrap.sql` (ganti passwordnya lebih dulu).
3. Samakan kredensial di `.env` dan `apps/api/.env`:
   ```dotenv
   MYSQL_PORT=3307
   DATABASE_URL=mysql://kletak:GantiPasswordKuat123@127.0.0.1:3307/kletak
   TEST_DATABASE_URL=mysql://kletak:GantiPasswordKuat123@127.0.0.1:3307/kletak_test
   ```

Panduan lengkap dan troubleshooting ada di `docs/mysql-local-setup.md`.

## Workspace commands

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm format:check
# Memerlukan MySQL test database (TEST_DATABASE_URL)
TEST_DATABASE_URL=mysql://... pnpm test:integration
```

## Environment

Salin `.env.example` dan isi nilai lokal. Jangan pernah commit `.env` atau kredensial payment gateway. Untuk CI/CD, simpan secret di GitHub Environments/Secrets atau secret manager cloud.

## Release policy

- `main` harus protected dan wajib melalui CI + review.
- Migration database harus backward-compatible dengan versi aplikasi sebelumnya.
- Payment/auth/migration wajib review owner atau tech lead.
- Production deploy dilakukan manual dari workflow setelah staging smoke test.
- Setiap release memiliki tag SemVer dan changelog.

## Status roadmap

Baseline ini sengaja mengimplementasikan **Phase 0 + MVP slice**, bukan mengondokan integrasi provider eksternal yang belum ditentukan. Lihat `docs/blueprint-analysis.md` untuk gap, acceptance criteria, dan fase berikutnya.
