# ADR 0002: MySQL sebagai database aplikasi

- Status: Accepted
- Tanggal: 9 Oktober 2026
- Supersedes: pilihan database PostgreSQL pada baseline blueprint
- Server lokal: MySQL 8.0 pada port 3307

## Context

Blueprint awal merekomendasikan PostgreSQL. Lingkungan operasional lokal yang tersedia menjalankan **MySQL 8.0** (server `MySQL80`) dan sebuah **MariaDB 10.4** yang dipakai project lain. Proyek perlu memiliki migration, integration test, dan deployment yang sama-sama menggunakan satu dialect database.

MariaDB 10.4 sengaja **tidak** dipakai untuk project ini karena:

1. Prisma mensyaratkan MariaDB 10.6+ untuk dukungan resmi.
2. MariaDB 10.4 tidak menegakkan `CHECK` constraint (fitur baru sejak 10.5.1), sehingga invariant stok dan akuntansi pada migration tidak akan aktif.
3. `sql_mode` MariaDB 10.4 pada mesin ini tidak menyertakan `STRICT_TRANS_TABLES`, berisiko menyimpan data yang tidak konsisten.

Karena port 3306 dipakai MariaDB, MySQL 8.0 dikonfigurasi berjalan di port **3307**. CI memakai image `mysql:8.4` sehingga perbedaan minor versi tidak berpengaruh pada perilaku yang diuji.

## Decision

Menggunakan MySQL 8.0+ dengan Prisma:

- UUID disimpan sebagai `CHAR(36)`;
- timestamp menggunakan `DATETIME(3)` dengan konvensi `Asia/Jakarta`;
- enum Prisma dipetakan ke enum MySQL;
- `BIGINT` tetap dipakai untuk nominal rupiah;
- `JSON` dipakai untuk payload outbox, audit, dan metadata webhook;
- `CHECK` constraint menjaga invariant stok, kuantitas, dan jurnal.

## Consequences

- MySQL Workbench dapat digunakan untuk inspeksi, backup, dan querying lokal.
- Tidak ada lagi kompatibilitas PostgreSQL di branch ini; URL, migration, CI, dan test harus MySQL.
- Integrasi dan load test wajib dijalankan terhadap MySQL, bukan hanya unit test.
- Untuk production, gunakan managed MySQL 8.0+, backup/PITR, charset `utf8mb4`, dan session time zone `Asia/Jakarta`.
- Port lokal 3307 hanya untuk slingkasan development; di production penentuan port sepenuhnya urusan platform.
- Kolom `DATETIME` tidak menyimpan timezone; aplikasi dan operational runbook harus memakai satu convention waktu yang jelas.