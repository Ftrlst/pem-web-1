# Setup MySQL lokal (MySQL Workbench) untuk Kletak-Kletik

Project ini memakai **MySQL 8.0+** (lihat `docs/adr/0002-mysql-database.md`). Semua migration, CI, dan integration test memakai MySQL.

## 0. Penting: kenapa port 3307, bukan 3306

Di mesin ini, port `3306` dipakai **MariaDB 10.4** yang menyimpan database project lain (`brandkita.id`). MariaDB 10.4 tidak dipakai project ini karena:

- Prisma mensyaratkan MariaDB **10.6+**;
- MariaDB 10.4 **tidak menegakkan `CHECK` constraint** (baru sejak 10.5.1), sehingga invariant stok/jurnal yang ada di migration tidak akan aktif.

MySQL 8.0 asli sudah terinstall sebagai service Windows `MySQL80`, tetapi default ke port 3306 dan bentrok dengan MariaDB. Solusinya: jalankan MySQL 8.0 di **port 3307** dan biarkan MariaDB di 3306 tetap berjalan.

## 1. Jalankan MySQL 8.0 di port 3307

Skrip ini mengubah konfigurasi `my.ini`, membuat backup, menyalakan service, lalu memverifikasi koneksinya. Jalankan di **PowerShell sebagai Administrator**:

```powershell
cd D:\TUGAS KAMPUS\smt3\pem-web-1
powershell -ExecutionPolicy Bypass -File .\scripts\start-mysql8-on-3307.ps1
```

Perintah manual bila perlu:

```powershell
# PowerShell (Administrator)
$ini = 'C:\ProgramData\MySQL\MySQL Server 8.0\my.ini'
Copy-Item $ini "$ini.bak" -Force
Stop-Service MySQL80 -ErrorAction SilentlyContinue
(Get-Content $ini -Raw) -replace '(?m)^(\s*)port\s*=\s*\d+\s*$', '${1}port = 3307' | Set-Content $ini -NoNewline
Start-Service MySQL80
Get-Service MySQL80
Test-NetConnection 127.0.0.1 -Port 3307
```

Verifikasi port:

```powershell
Test-NetConnection 127.0.0.1 -Port 3307   # True
Test-NetConnection 127.0.0.1 -Port 3306   # tetap MariaDB, boleh True
```

## 2. Buat database dan user

Buka MySQL Workbench → koneksi ke **MySQL 8.0 port 3307** → tab Query → muat `infra/mysql/bootstrap.sql` → Execute.

Ganti password pada baris `IDENTIFIED BY` di file tersebut sebelum menjalankan, lalu salin password yang sama ke `.env`.

`kletak_test` wajib ada: integration test menjalankan `TRUNCATE` di database itu, jadi jangan pernah arahkan `TEST_DATABASE_URL` ke database produksi.

## 3. Isi kredensial lokal

Edit `.env` dan `apps/api/.env` (keduanya sudah di-gitignore):

```dotenv
MYSQL_DATABASE=kletak
MYSQL_USER=kletak
MYSQL_PASSWORD=GantiPasswordKuat123!
MYSQL_ROOT_PASSWORD=<password-root-mysql-anda>
MYSQL_PORT=3307
DATABASE_URL=mysql://kletak:GantiPasswordKuat123@127.0.0.1:3307/kletak
TEST_DATABASE_URL=mysql://kletak:GantiPasswordKuat123@127.0.0.1:3307/kletak_test
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
| `Can't reach database server` di port 3307 | service MySQL80 mati | jalankan `scripts/start-mysql8-on-3307.ps1` sebagai Administrator |
| Koneksi nyasar ke `brandkita.id` | masih memakai port 3306 (MariaDB) | pastikan `DATABASE_URL` dan `TEST_DATABASE_URL` memakai `3307` |
| `Access denied for user 'kletak'` | password tidak sama dengan `.env` | samakan dengan password di `infra/mysql/bootstrap.sql`, lalu `FLUSH PRIVILEGES` |
| `Unknown database 'kletak_test'` | database test belum dibuat | jalankan `infra/mysql/bootstrap.sql` |
| Integration test skip | `TEST_DATABASE_URL` kosong / tidak ada kata `test` | isi `TEST_DATABASE_URL` |
| `ER_ROW_IS_REFERENCED_2` saat truncate | foreign key masih aktif | test sudah menonaktifkan `FOREIGN_KEY_CHECKS` di dalam transaksi; error ini muncul bila truncate dijalankan manual |
| `Too many connections` | pool Prisma + `max_connections` MySQL | turunkan `connection_limit` pada `DATABASE_URL` |
| Error timezone | `DATETIME` tidak menyimpan offset | jalankan `SET time_zone = '+07:00';` per koneksi |

## Rollback ke port 3306

Jika MariaDB perlu dipakai lagi, kembalikan `my.ini` dari backup:

```powershell
# PowerShell (Administrator)
Stop-Service MySQL80
$ini = 'C:\ProgramData\MySQL\MySQL Server 8.0\my.ini'
Copy-Item (Get-ChildItem "$ini.bak-*" | Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName $ini -Force
Start-Service MySQL80
```