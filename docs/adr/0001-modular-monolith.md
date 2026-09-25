# ADR 0001: Modular monolith dengan transactional outbox

- Status: Accepted
- Tanggal: 25 September 2026

## Context

Blueprint membutuhkan MVP yang jelas dan mudah diskalakan, tanpa biaya operasional microservices. Order, inventory, payment, notification, dan accounting membutuhkan ACID dan auditability.

## Decision

Menggunakan satu NestJS API sebagai modular monolith. Batas domain tetap dipisah di folder/service. Semua perubahan penting ditulis ke `outbox_event` dalam transaksi PostgreSQL yang sama. Baseline memproses outbox secara idempotent; adapter Redis + BullMQ dapat ditambahkan tanpa mengubah kontrak event.

## Consequences

- Deployment MVP lebih sederhana dan mudah di-debug.
- Database tetap menjadi consistency boundary.
- Tim harus menjaga event contract dan idempotency consumer.
- Microservice extraction dapat dilakukan kemudian tanpa mengubah state machine utama.
