# API contract

Base URL production: `https://api.example.com/api/v1`

Swagger lokal: `http://localhost:4000/api/docs`

## Auth

- `POST /auth/register` — customer registration.
- `POST /auth/login` — access token response + refresh cookie.
- `POST /auth/refresh-token` — rotate refresh token.
- `POST /auth/logout` — revoke current refresh token.
- `GET /auth/me` — authenticated profile.
- `GET/PATCH /users/me` — profile.

## Catalog

- `GET /products?q=&category=&page=&pageSize=` — public, paginated.
- `GET /products/{id}` — public detail.
- `POST/PATCH/DELETE /products` — SELLER/OWNER/ADMIN.

## Orders

- `POST /orders` — public guest/customer checkout; send `Idempotency-Key` for retry-safe creation.
- `GET /orders` — authenticated customer/staff list.
- `GET /orders/{id}` — authenticated detail.
- `GET /orders/{id}/tracking?token=...` — guest tracking with one-time issued token.
- `PATCH /orders/{id}/status` — staff state transition.
- `PATCH /orders/{id}/cancel` — cancel permitted order.

## Inventory and payment

- `GET /inventory/movements` — staff history.
- `GET /inventory/low-stock` — staff alert list.
- `POST /inventory/movements` — staff stock movement.
- `POST /payments` — create payment attempt; send `Idempotency-Key`.
- `GET /payments/{id}` — payment detail.
- `PATCH /payments/{id}/verify` — staff manual verification (MVP).

## Accounting

- `GET /accounting/coa`
- `GET /accounting/journals`
- `GET /accounting/ledger?accountCode=`
- `GET /accounting/trial-balance`

All mutating endpoints return a request ID. Error shape:

```json
{
  "statusCode": 400,
  "code": "BAD_REQUEST",
  "message": "Pesan yang dapat ditindaklanjuti",
  "requestId": "uuid",
  "timestamp": "ISO-8601"
}
```

## State transition

`PENDING -> CONFIRMED -> PREPARING -> PACKED -> READY_DELIVERY|READY_PICKUP -> COMPLETED`

`PENDING -> CANCELLED` only. Order yang sudah dibayar tidak dapat dibatalkan tanpa refund flow. `EXPIRED` is scheduler-driven. Payment status is independent and must be verified server-side.
