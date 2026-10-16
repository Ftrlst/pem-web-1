# Setup PostgreSQL lokal untuk Kletak-Kletik

Project ini memakai **PostgreSQL** (lihat `docs/adr/0001-modular-monolith.md` dan blueprint). Semua migration, CI service, dan integration test memakai PostgreSQL.

> **Catatan alat GUI:** MySQL Workbench hanya bisa konek ke MySQL/MariaDB dan **tidak bisa** dipakai untuk project ini. Untuk PostgreSQL gunakan **pgAdmin**, yang sudah ikut terinstall bersama PostgreSQL.

## 1. Pastikan PostgreSQL jalan

Instalasi Windows PostgreSQL membuat service bernama `postgresql-x64-16` (sesuaikan nomor versinya).

```powershell
Get-Service | Where-Object { $_.Name -like 'postgres*' }
```

Kalau statusnya `Stopped`:

```powershell
Start-Service postgresql-x64-16
```

Verifikasi port:

```powershell
Test-NetConnection 127.0.0.1 -Port 5432   #TcpTestSucceeded harus True
```

`psql` tersedia di `C:\Program Files\PostgreSQL\16\bin\psql.exe`:

```powershell
& 'C:\Program Files\PostgreSQL\16\bin\psql.exe' --version
```

## 2. Buat database dan user

Buka **pgAdmin**, klik kanan `Servers`, pilih `Add New Server`, lalu isi:

| Field | Nilai |
| --- | --- |
| Name | `localhost` |
| Host | `localhost` |
| Port | `5432` |
| Maintenance DB | `postgres` |
| Username | `postgres` |
| Password | password superuser yang Anda buat saat instalasi |

Lalu klik `Databases`, pilih `Create`, lalu `Database` dua kali untuk membuat:

- `kletak` - database aplikasi
- `kletak_test` - database khusus integration test

`kletak_test` wajib ada karena integration test menjalankan `TRUNCATE` di database itu. **Jangan pernah** arahkan `TEST_DATABASE_URL` ke database produksi.

## 3. Buat user aplikasi

Buka **Query Tool** di pgAdmin (koneksi ke database `postgres`), lalu jalankan:

```sql
CREATE USER kletak WITH PASSWORD 'GantiPasswordKuat123';

CREATE DATABASE kletak OWNER kletak;
CREATE DATABASE kletak_test OWNER kletak;

GRANT ALL PRIVILEGES ON DATABASE kletak TO kletak;
GRANT ALL PRIVILEGES ON DATABASE kletak_test TO kletak;
```

Ganti baris password di atas sebelum menjalankan. Perhatikan nama user harus konsisten dengan nama database.

Alternatif tanpa pgAdmin, lewat PowerShell:

```powershell
& 'C:\Program Files\PostgreSQL\16\bin\psql.exe' -U postgres -h localhost -c "CREATE USER kletak WITH PASSWORD 'GantiPasswordKuat123';"
& 'C:\Program Files\PostgreSQL\16\bin\psql.exe' -U postgres -h localhost -c "CREATE DATABASE kletak OWNER kletak;"
& 'C:\Program Files\PostgreSQL\16\bin\psql.exe' -U postgres -h localhost -c "CREATE DATABASE kletak_test OWNER kletak;"
```

## 4. Isi kredensial lokal

Edit `.env` dan `apps/api/.env` (keduanya sudah di-gitignore):

```dotenv
POSTGRES_DB=kletak
POSTGRES_USER=kletak
POSTGRES_PASSWORD=GantiPasswordKuat123
DATABASE_URL=postgresql://kletak:GantiPasswordKuat123@127.0.0.1:5432/kletak?schema=public
TEST_DATABASE_URL=postgresql://kletak:GantiPasswordKuat123@127.0.0.1:5432/kletak_test?schema=public
```

Ganti password dengan milik Anda. Kalau password mengandung `@`, `:`, `/`, `#`, encode sebagai `%40`, `%3A`, `%2F`, `%23`.

## 5. Terapkan migration

```powershell
pnpm install --frozen-lockfile
pnpm db:generate
pnpm db:migrate:deploy
```

Verifikasi tabel terbentuk lewat Query Tool pgAdmin:

```sql
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;
```

## 6. Jalankan integration test

```powershell
pnpm test:integration
```

Test otomatis **skip** bila `TEST_DATABASE_URL` kosong atau URL-nya tidak mengandung kata `test`. Lihat `apps/api/test/integration/production-guards.integration.test.ts`.

## Troubleshooting

| Gejala | Penyebab | Solusi |
| --- | --- | --- |
| `Can't reach database server at localhost:5432` | service PostgreSQL mati | `Start-Service postgresql-x64-16` |
| `password authentication failed for user` | password tidak sama dengan `.env` | jalankan `ALTER USER kletak WITH PASSWORD '...'` |
| `database already exists` | sudah dibuat sebelumnya | abaikan |
| `permission denied to create database` | login sebagai user non-superuser | jalankan `CREATE DATABASE` memakai user `postgres` |
| Integration test skip | `TEST_DATABASE_URL` kosong / tidak ada kata `test` | isi `TEST_DATABASE_URL` |
| `FATAL: too many connections` | pool Prisma + `max_connections` | turunkan `connection_limit` pada `DATABASE_URL`, atau naikkan `max_connections` di `postgresql.conf` |
| Error timezone | `TIMESTAMPTZ` menyimpan UTC | aplikasi memakai offset `+07:00`; setel `TZ` bila perlu |

## Menjalankan stack penuh lewat Docker Compose

`infra/docker-compose.yml` memakai image `postgres:16-alpine` dan mensyaratkan `POSTGRES_PASSWORD`.

```powershell
docker compose -f infra/docker-compose.yml --env-file .env up --build
```

Ada service `migrate` yang menjalankan `prisma migrate deploy` sebelum API start, lalu `gateway` (Nginx) expose web dan API pada satu origin.