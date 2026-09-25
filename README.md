# Kletak-Kletik Snack

Kletak-Kletik Snack adalah baseline produksi untuk aplikasi operasional UMKM snack: katalog, pemesanan, reservasi stok, pembayaran, audit, dan PWA.

Blueprint sumber ada di `blueprint_kletak-kletik-snack.docx`. Analisis dan keputusan implementasi ada di `docs/blueprint-analysis.md`.

## Stack

- `apps/web` — Next.js App Router, React, TypeScript, PWA shell
- `apps/api` — NestJS modular monolith, REST/OpenAPI, Prisma/PostgreSQL
- `packages/contracts` — schema Zod dan tipe bersama
- Redis + BullMQ — target queue adapter; baseline memakai transactional outbox PostgreSQL
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

## Workspace commands

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm format:check
```

## Environment

Salin `.env.example` dan isi nilai lokal. Jangan pernah commit `.env` atau kredensial payment gateway. Untuk CI/CD, simpan secret di GitHub Environments/Secrets atau secret manager cloud.

## Release policy

- `main` harus protected dan wajib melalui CI + review.
- Migrationdatabase harus backward-compatible dengan versi aplikasi sebelumnya.
- Payment/auth/migration wajib review owner atau tech lead.
- Production deploy dilakukan manual dari workflow setelah staging smoke test.
- Setiap release memiliki tag SemVer dan changelog.

## Status roadmap

Baseline ini sengaja mengimplementasikan **Phase 0 + MVP slice**, bukan mengondokan integrasi provider eksternal yang belum ditentukan. Lihat `docs/blueprint-analysis.md` untuk gap, acceptance criteria, dan fase berikutnya.
