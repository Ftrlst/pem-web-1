# Setup MySQL lokal (MySQL Workbench) untuk Kletak-Kletik

Project ini memakai **MySQL 8.4+** (lihat `docs/adr/0002-mysql-database.md`). Semua migration, CI, dan integration test memakai MySQL.

## 1. Pastikan service MySQL jalan

Di MySQL Workbench, buka koneksi lokal. Jika gagal, start service dulu:

```powershell
# elevated PowerShell
Start-Service MySQL80
Get-Service MySQL80
```

Verifikasi port:

```powershell
Test-NetConnection 127.0.0.1 -Port 3306
```

## 2. Buat database dan user

Jalankan SQL ini di tab Query MySQL Workbench:

```sql
CREATE DATABASE IF NOT EXISTS kletak CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS kletak_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'kletak'@'localhost' IDENTIFIED BY 'GantiPasswordKuat123!';
CREATE USER IF NOT EXISTS 'kletak'@'127.0.0.1' IDENTIFIED BY 'GantiPasswordKuat123!';

GRANT ALL PRIVILEGES ON kletak.* TO 'kletak'@'localhost';
GRANT ALL PRIVILEGES ON kletak_test.* TO 'kletak'@'localhost';
GRANT ALL PRIVILEGES ON kletak.* TO 'kletak'@'127.0.0.1';
GRANT ALL PRIVILEGES ON kletak_test.* TO 'kletak'@'127.0.0.1';
FLUSH PRIVILEGES;
```

`kletak_test` wajib ada: integration test menjalankan `TRUNCATE` di database itu, jadi jangan pernah arahkan `TEST_DATABASE_URL` ke database produksi.

## 3. Isi kredensial lokal

Edit `.env` dan `apps/api/.env` (keduanya sudah di-gitignore):

```dotenv
MYSQL_DATABASE=kletak
MYSQL_USER=kletak
MYSQL_PASSWORD=GantiPasswordKuat123!
MYSQL_ROOT_PASSWORD=<password-root-mysql-anda>
MYSQL_PORT=3306
DATABASE_URL=mysql://kletak:GantiPasswordKuat123!@127.0.0.1:3306/kletak
TEST_DATABASE_URL=mysql://kletak:GantiPasswordKuat123!@127.0.0.1:3306/kletak_test
```

Kalau password mengandung `@`, `:`, `/`, atau `#`, encode sebagai `%40`, `%3A`, `%2F`, `%23`.

## 4. Terapkan migration

```powershell
pnpm install --frozen-lockfile
pnpm db:generate
pnpm db:migrate:deploy
```

Pastikan tabel sudah terbentuk dengan query di Workbench:

```sql
USE kletak;
SHOW TABLES;
```

## 5. Jalankan integration test

```powershell
pnpm test:integration
```

Test otomatis **skip** bila `TEST_DATABASE_URL` kosong atau URL-nya tidak mengandung `test`. Lihat `apps/api/test/integration/production-guards.integration.test.ts`.

## 6. Menjalankan stack penuh lewat Docker Compose

`infra/docker-compose.yml` memakai image `mysql:8.4` dan mensyaratkan `MYSQL_PASSWORD` serta `MYSQL_ROOT_PASSWORD`.

```powershell
docker compose --env-file .env -f infra/docker-compose.yml up --build
```

Ada service `migrate` yang menjalankan `prisma migrate deploy` sebelum API start, lalu `gateway` (Nginx) expose web + API di satu origin.

## Troubleshooting

| Gejala | Penyebab | Solusi |
| --- | --- | --- |
| `Can't reach database server` | service MySQL mati | `Start-Service MySQL80` |
| `Access denied for user 'kletak'` | password tidak sama dengan `.env` | samakan ulang, lalu `FLUSH PRIVILEGES` |
| `Unknown database 'kletak_test'` | database test belum dibuat | jalankan SQL pada langkah 2 |
| Integration test skip | `TEST_DATABASE_URL` kosong / tidak ada `test` | isi `TEST_DATABASE_URL` |
| `ER_ROW_IS_REFERENCED_2` saat truncate | foreign key masih aktif | test sudah menonaktifkan `FOREIGN_KEY_CHECKS` di dalam transaksi; error ini biasanya muncul bila truncate dijalankan manual |
| `Too many connections` | pool Prisma + MySQL max_connections | turunkan `connection_limit` pada `DATABASE_URL` |
| Error timezone | `DATETIME` tidak menyimpan offset | jalankan `SET time_zone = '+07:00';` per koneksi |