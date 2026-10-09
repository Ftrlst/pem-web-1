-- Bootstrap database Kletak-Kletik untuk MySQL 8.0 (port 3307)
--
-- Cara pakai:
--   1. Buka MySQL Workbench, buat/koneksi ke server MySQL 8.0 (port 3307)
--   2. Buka tab Query, muat file ini, lalu Execute (eksekusi per statement)
--
-- CATATAN: jangan pernah mengarahkan TEST_DATABASE_URL ke database produksi.
--   kletak_test akan di-TRUNCATE oleh integration test.

-- ---------------------------------------------------------------------------
-- Database
-- ---------------------------------------------------------------------------
CREATE DATABASE IF NOT EXISTS kletak
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE DATABASE IF NOT EXISTS kletak_test
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- User aplikasi
--
-- GANTI PASSWORD DI BAWAH sebelum menjalankan file ini.
-- Password yang mengandung karakter '@', ':', '/', '#' harus di-URL-encode
-- saat dipakai di DATABASE_URL (mis. @ -> %40).
-- ---------------------------------------------------------------------------
CREATE USER IF NOT EXISTS 'kletak'@'localhost'    IDENTIFIED BY 'GantiPasswordKuat123';
CREATE USER IF NOT EXISTS 'kletak'@'127.0.0.1'  IDENTIFIED BY 'GantiPasswordKuat123';
CREATE USER IF NOT EXISTS 'kletak'@'%'           IDENTIFIED BY 'GantiPasswordKuat123';

-- ---------------------------------------------------------------------------
-- Hak akses
-- 'kletak' saja yang butuh ALL PRIVILEGES (untuk CREATE TABLE saat migrate).
-- ---------------------------------------------------------------------------
GRANT ALL PRIVILEGES ON kletak.*       TO 'kletak'@'localhost';
GRANT ALL PRIVILEGES ON kletak.*       TO 'kletak'@'127.0.0.1';
GRANT ALL PRIVILEGES ON kletak.*       TO 'kletak'@'%';

-- Test database hanya butuh DELETE untuk TRUNCATE, tapi ALL PRIVILEGES
-- dipakai agar migrasi schema bisa dijalankan terhadapnya bila diperlukan.
GRANT ALL PRIVILEGES ON kletak_test.*   TO 'kletak'@'localhost';
GRANT ALL PRIVILEGES ON kletak_test.*   TO 'kletak'@'127.0.0.1';
GRANT ALL PRIVILEGES ON kletak_test.*   TO 'kletak'@'%';

FLUSH PRIVILEGES;

-- ---------------------------------------------------------------------------
-- Verifikasi (pilih blok di bawah lalu Execute)
-- ---------------------------------------------------------------------------
SELECT
  VERSION()                                AS versi_server,
  @@character_set_server                    AS charset_server,
  @@collation_server                       AS collation_server,
  @@transaction_isolation                  AS isolation_level,
  @@global.time_zone                       AS zona_waktu_global;

SELECT
  schema_name,
  default_character_set_name AS charset,
  default_collation_name     AS collation
FROM information_schema.SCHEMATA
WHERE schema_name IN ('kletak', 'kletak_test');