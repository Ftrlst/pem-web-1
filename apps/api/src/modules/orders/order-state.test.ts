import { describe, expect, it } from 'vitest';
import { assertFulfillmentStatus, assertOrderTransition } from './order-state';

describe('order state machine', () => {
  it('accepts the production fulfillment path', () => {
    expect(() => assertOrderTransition('PENDING', 'CONFIRMED')).not.toThrow();
    expect(() => assertOrderTransition('PACKED', 'READY_PICKUP')).not.toThrow();
    expect(() => assertOrderTransition('READY_PICKUP', 'COMPLETED')).not.toThrow();
  });

  it('rejects invalid transitions', () => {
    expect(() => assertOrderTransition('PENDING', 'COMPLETED')).toThrow();
    expect(() => assertOrderTransition('CONFIRMED', 'CANCELLED')).toThrow();
  });

  it('enforces the fulfillment method', () => {
    expect(() => assertFulfillmentStatus('DELIVERY', 'READY_PICKUP')).toThrow();
    expect(() => assertFulfillmentStatus('PICKUP', 'READY_DELIVERY')).toThrow();
  });
});
