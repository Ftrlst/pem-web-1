-- Prevent one provider transaction from being attached to multiple payments.
CREATE UNIQUE INDEX "Payment_provider_providerTransactionId_key"
ON "Payment"("provider", "providerTransactionId");

-- Make payment creation retry-safe for the same order and idempotency key.
CREATE UNIQUE INDEX "Payment_orderId_idempotencyKey_key"
ON "Payment"("orderId", "idempotencyKey");