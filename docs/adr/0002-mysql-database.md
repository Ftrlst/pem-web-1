# ADR 0002: MySQL sebagai database aplikasi

- Status: Accepted
- Tanggal: 9 Oktober 2026
- Supersedes: pilihan database PostgreSQL pada baseline blueprint

## Context

Blueprint awal merekomendasikan PostgreSQL. Lingkungan operasional yang tersedia menggunakan MySQL Workbench dan MySQL 8.0/8.4. Proyek perlu memiliki migration, integration test, dan deployment yang sama-sama menggunakan satu dialect database.

## Decision

Menggunakan MySQL 8.4+ dengan Prisma:

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
- Untuk production, gunakan managed MySQL 8.4, backup/PITR, charset `utf8mb4`, dan session time zone `Asia/Jakarta`.
- Kolom `DATETIME` tidak menyimpan timezone; aplikasi dan operational runbook harus memakai satu convention waktu yang jelas.