import { describe, expect, it } from 'vitest';
import { canTransitionOrder, createOrderSchema } from './index';

describe('order contract', () => {
  it('allows the normal fulfillment flow', () => {
    expect(canTransitionOrder('PENDING', 'CONFIRMED')).toBe(true);
    expect(canTransitionOrder('CONFIRMED', 'PREPARING')).toBe(true);
    expect(canTransitionOrder('READY_PICKUP', 'COMPLETED')).toBe(true);
  });

  it('rejects invalid order transitions', () => {
    expect(canTransitionOrder('PENDING', 'COMPLETED')).toBe(false);
    expect(canTransitionOrder('COMPLETED', 'CANCELLED')).toBe(false);
    expect(canTransitionOrder('CONFIRMED', 'CANCELLED')).toBe(false);
    expect(canTransitionOrder('PACKED', 'CANCELLED')).toBe(false);
  });

  it('requires an address for delivery', () => {
    const result = createOrderSchema.safeParse({
      items: [{ productId: '00000000-0000-0000-0000-000000000001', quantity: 1 }],
      fulfillmentMethod: 'DELIVERY',
      scheduledDate: '2026-09-25',
      paymentMethod: 'TRANSFER',
    });
    expect(result.success).toBe(false);
  });
});
