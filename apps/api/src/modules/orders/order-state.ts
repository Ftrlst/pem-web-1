import { BadRequestException } from '@nestjs/common';
import { ORDER_TRANSITIONS, OrderStatus } from '@kletak/contracts';

export function assertOrderTransition(from: OrderStatus, to: OrderStatus) {
  if (!ORDER_TRANSITIONS[from].includes(to)) {
    throw new BadRequestException(`Transisi status ${from} -> ${to} tidak diizinkan`);
  }
}

export function assertFulfillmentStatus(
  fulfillmentMethod: 'DELIVERY' | 'PICKUP',
  status: OrderStatus,
) {
  if (status === 'READY_DELIVERY' && fulfillmentMethod !== 'DELIVERY') {
    throw new BadRequestException('Status SIAP_DIANTAR hanya untuk delivery');
  }
  if (status === 'READY_PICKUP' && fulfillmentMethod !== 'PICKUP') {
    throw new BadRequestException('Status SIAP_DIAMBIL hanya untuk pickup');
  }
}
