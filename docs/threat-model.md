# Threat model baseline

## Trust boundaries

1. Browser PWA tidak dipercaya: harga, role, total, status, dan stock tidak boleh dipercaya dari client.
2. API menerima guest checkout; akses tracking membutuhkan token acak yang hanya diberikan sekali.
3. Payment provider adalah external system; signature dan replay protection wajib.
4. Redis/BullMQ adalah internal dependency; failure tidak boleh merusak state pesanan.
5. Browser cache tidak boleh menyimpan token, payment detail, chat, atau admin response.

## Kontrol utama

- Argon2id password hashing dan generic login error.
- Access JWT pendek, refresh rotation, reuse detection, cookie `HttpOnly/Secure/SameSite`.
- RBAC + resource/outlet ownership checks.
- Zod/class-validator allow-list; parameterized Prisma query.
- Idempotency-Key untuk create order/payment.
- Serializable transaction dan reservation untuk mencegah oversell.
- Webhook signature verification, provider event uniqueness, amount/order validation.
- Audit log untuk status, payment, inventory, dan product mutation.
- Helmet, strict CORS, rate limit, request ID, structured logs.
- No secrets in repository; GitHub Environment secrets and cloud secret manager in deployment.

## Residual risks

- WhatsApp/FCM delivery is best effort until retry and consent policy are implemented.
- Offline catalog cache can be stale; UI harus menampilkan last-updated/offline state.
- Manual payment verification bergantung pada staff yang terlatih dan kontrol segregation of duties.
- Compromise of a staff account dapat merusak data; production wajib MFA untuk OWNER/ADMIN.
