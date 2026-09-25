# Security Policy

## Melihat kerentanan

Jangan membuka issue publik untuk temuan yang belum diperbaiki. Kirim detail minimal melalui GitHub Security Advisory repository atau kanal privat yang telah disepakati. Sertakan langkah reproduksi, dampak, dan request ID tanpa menyertakan secret/data pelanggan.

## Target

- OWASP ASVS level 2
- Dependency/container vulnerability high/critical harus mitigated sebelum production
- Payment webhook harus signature-verified dan idempotent

## Pelaporan

Target initial response: 3 hari kerja. Untuk insiden aktif, gunakan kanal insiden repository owner dan nonaktifkan impacted flow jika diperlukan.
