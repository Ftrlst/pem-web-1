import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { canTransitionOrder, OrderStatus, UserRole } from '@kletak/contracts';
import {
  FulfillmentMethod as PrismaFulfillmentMethod,
  OrderStatus as PrismaOrderStatus,
  PaymentMethod as PrismaPaymentMethod,
  PaymentStatus as PrismaPaymentStatus,
  Prisma,
  ReservationStatus,
} from '@prisma/client';
import { randomToken, sha256 } from '../../common/security/token.util';
import { bigintToNumber } from '../../common/utils/serialize';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../common/prisma/prisma.service';
import { withSerializableRetry } from '../../common/database/transaction.util';
import { assertFulfillmentStatus, assertOrderTransition } from './order-state';
import {
  CreateOrderDto,
  FulfillmentMethodDto,
  OrderQueryDto,
  OrderStatusDto,
  PaymentMethodDto,
  UpdateOrderStatusDto,
} from './dto/orders.dto';

const RESERVATION_TTL_MINUTES = 120;
const DELIVERY_FEE_IDR = 10_000n;

type OrderWithDetails = Prisma.OrderGetPayload<{
  include: { items: true; payments: true };
}>;

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    input: CreateOrderDto,
    requester?: AuthenticatedUser,
    idempotencyKey?: string,
    requestId?: string,
  ) {
    const outletId = await this.resolveOutletId(requester);
    if (!outletId) throw new ConflictException('Outlet belum dikonfigurasi');

    if (idempotencyKey) {
      const existing = await this.prisma.order.findFirst({
        where: { idempotencyKey, outletId, ...(requester ? { userId: requester.id } : {}) },
        include: { items: true, payments: true },
      });
      if (existing) return this.serialize(existing);
    }

    const user = requester
      ? await this.prisma.user.findUnique({
          where: { id: requester.id },
          select: { name: true, phone: true },
        })
      : null;
    const customerName = requester ? user?.name : input.customerName?.trim();
    if (!customerName) throw new BadRequestException('Nama pelanggan wajib untuk checkout tamu');

    const groupedItems = new Map<string, number>();
    for (const item of input.items) {
      groupedItems.set(item.productId, (groupedItems.get(item.productId) ?? 0) + item.quantity);
    }
    const productIds = [...groupedItems.keys()];
    const scheduledDate = new Date(`${input.scheduledDate}T00:00:00.000Z`);
    if (Number.isNaN(scheduledDate.getTime()))
      throw new BadRequestException('Tanggal pesanan tidak valid');
    if (
      input.fulfillmentMethod === FulfillmentMethodDto.DELIVERY &&
      !input.deliveryAddress?.trim()
    ) {
      throw new BadRequestException('Alamat wajib untuk delivery');
    }
    if (input.fulfillmentMethod === FulfillmentMethodDto.PICKUP && !input.pickupLocation?.trim()) {
      throw new BadRequestException('Lokasi wajib untuk pickup');
    }

    const trackingToken = randomToken(32);
    const order = await withSerializableRetry(this.prisma, async (tx) => {
      const products = await tx.product.findMany({
        where: { id: { in: productIds }, outletId, isActive: true },
      });
      if (products.length !== productIds.length) {
        throw new NotFoundException('Salah satu produk tidak tersedia');
      }
      const productById = new Map(products.map((product) => [product.id, product]));
      let subtotal = 0n;
      for (const [productId, quantity] of groupedItems) {
        const product = productById.get(productId);
        if (!product || product.stock - product.reservedStock < quantity) {
          throw new ConflictException(`Stok ${product?.name ?? 'produk'} tidak mencukupi`);
        }
        subtotal += product.priceIdr * BigInt(quantity);
      }
      const shipping =
        input.fulfillmentMethod === FulfillmentMethodDto.DELIVERY ? DELIVERY_FEE_IDR : 0n;
      const orderNumber = this.createOrderNumber();
      const created = await tx.order.create({
        data: {
          outletId,
          userId: requester?.id,
          orderNumber,
          idempotencyKey: idempotencyKey || null,
          status: PrismaOrderStatus.PENDING,
          paymentMethod: input.paymentMethod as PrismaPaymentMethod,
          fulfillmentMethod: input.fulfillmentMethod as PrismaFulfillmentMethod,
          customerName,
          customerPhone: requester ? user?.phone : input.customerPhone?.trim() || null,
          deliveryAddress: input.deliveryAddress?.trim() || null,
          pickupLocation: input.pickupLocation?.trim() || null,
          scheduledDate,
          subtotalIdr: subtotal,
          shippingIdr: shipping,
          totalIdr: subtotal + shipping,
          customerNote: input.customerNote?.trim() || null,
          trackingTokenHash: sha256(trackingToken),
        },
        include: { items: true, payments: true },
      });

      for (const [productId, quantity] of groupedItems) {
        const product = productById.get(productId)!;
        const updated = await tx.product.updateMany({
          where: {
            id: productId,
            stock: { gte: product.reservedStock + quantity },
          },
          data: { reservedStock: { increment: quantity } },
        });
        if (updated.count !== 1) {
          throw new ConflictException(`Stok ${product.name} berubah, silakan ulangi checkout`);
        }
        await tx.orderItem.create({
          data: {
            orderId: created.id,
            productId,
            productName: product.name,
            quantity,
            unitPriceIdr: product.priceIdr,
            subtotalIdr: product.priceIdr * BigInt(quantity),
          },
        });
        await tx.inventoryReservation.create({
          data: {
            orderId: created.id,
            productId,
            quantity,
            expiresAt: new Date(Date.now() + RESERVATION_TTL_MINUTES * 60 * 1000),
          },
        });
      }

      await tx.orderStatusHistory.create({
        data: {
          orderId: created.id,
          fromStatus: null,
          toStatus: PrismaOrderStatus.PENDING,
          changedById: requester?.id,
          note: 'Order dibuat',
        },
      });
      await tx.auditLog.create({
        data: {
          outletId,
          actorId: requester?.id,
          action: 'ORDER_CREATED',
          entityType: 'Order',
          entityId: created.id,
          newValue: { orderNumber, totalIdr: (subtotal + shipping).toString() },
          requestId: requestId || null,
        },
      });
      await tx.outboxEvent.create({
        data: {
          aggregateType: 'Order',
          aggregateId: created.id,
          eventType: 'OrderCreated',
          payload: {
            orderId: created.id,
            orderNumber,
            totalIdr: (subtotal + shipping).toString(),
          },
        },
      });
      return created;
    });

    return this.serialize(order, requester ? undefined : trackingToken);
  }

  async list(query: OrderQueryDto, requester: AuthenticatedUser) {
    const outletId = await this.resolveOutletId(requester);
    if (!outletId) throw new ConflictException('Outlet belum dikonfigurasi');
    const where: Prisma.OrderWhereInput = {
      outletId,
      ...(requester.role === 'CUSTOMER' ? { userId: requester.id } : {}),
      ...(query.status ? { status: query.status as PrismaOrderStatus } : {}),
    };
    const skip = (query.page - 1) * query.pageSize;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: query.pageSize,
        include: { items: true, payments: { orderBy: { createdAt: 'desc' }, take: 1 } },
      }),
      this.prisma.order.count({ where }),
    ]);
    return {
      data: items.map((item) => this.serialize(item)),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  }

  async getById(id: string, requester?: AuthenticatedUser, trackingToken?: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { items: true, payments: { orderBy: { createdAt: 'desc' } } },
    });
    if (!order) throw new NotFoundException('Pesanan tidak ditemukan');
    this.assertCanView(order, requester, trackingToken);
    return this.serialize(order, trackingToken);
  }

  async updateStatus(
    id: string,
    input: UpdateOrderStatusDto,
    requester: AuthenticatedUser,
    requestId?: string,
  ) {
    if (input.status === OrderStatusDto.CONFIRMED) {
      throw new ConflictException(
        'Status CONFIRMED hanya dapat diproses melalui payment verification',
      );
    }

    const order = await withSerializableRetry(this.prisma, async (tx) => {
      const current = await tx.order.findUnique({
        where: { id },
        include: { reservations: true },
      });
      if (!current) throw new NotFoundException('Pesanan tidak ditemukan');
      this.assertStaffCanAccess(current, requester);
      return this.transitionInTx(
        tx,
        current,
        input.status as OrderStatus,
        requester,
        input.note,
        requestId,
      );
    });
    return this.getById(order.id, requester);
  }

  async cancel(id: string, requester: AuthenticatedUser, requestId?: string) {
    const cancelled = await withSerializableRetry(this.prisma, async (tx) => {
      const current = await tx.order.findUnique({
        where: { id },
        include: { reservations: true },
      });
      if (!current) throw new NotFoundException('Pesanan tidak ditemukan');

      if (requester.role === UserRole.CUSTOMER) {
        if (current.userId !== requester.id) {
          throw new ForbiddenException('Pesanan ini bukan milik Anda');
        }
        if (current.status !== PrismaOrderStatus.PENDING) {
          throw new ConflictException('Pesanan hanya dapat dibatalkan sebelum diproses');
        }
      } else {
        this.assertStaffCanAccess(current, requester);
      }

      const paidPayment = await tx.payment.findFirst({
        where: { orderId: id, status: PrismaPaymentStatus.PAID },
        select: { id: true },
      });
      if (paidPayment) {
        throw new ConflictException('Pesanan lunas tidak dapat dibatalkan tanpa refund');
      }

      return this.transitionInTx(
        tx,
        current,
        OrderStatusDto.CANCELLED,
        requester,
        'Dibatalkan oleh pengguna',
        requestId,
      );
    });
    return this.getById(cancelled.id, requester);
  }

  async confirmPayment(
    paymentId: string,
    actor?: AuthenticatedUser,
    requestId?: string,
    provider?: { name: string; transactionId?: string },
  ): Promise<OrderWithDetails> {
    return withSerializableRetry(
      this.prisma,
      async (tx) => {
        const payment = await tx.payment.findUnique({
          where: { id: paymentId },
          include: { order: { include: { reservations: true } } },
        });
        if (!payment) throw new NotFoundException('Pembayaran tidak ditemukan');
        if (actor) this.assertStaffCanAccess(payment.order, actor);
        if (payment.status === PrismaPaymentStatus.PAID) {
          return tx.order.findUniqueOrThrow({
            where: { id: payment.orderId },
            include: { items: true, payments: true },
          });
        }
        if (
          payment.status !== PrismaPaymentStatus.UNPAID &&
          payment.status !== PrismaPaymentStatus.PENDING
        ) {
          throw new ConflictException('Status pembayaran tidak dapat diverifikasi');
        }
        if (payment.amountIdr !== payment.order.totalIdr) {
          throw new ConflictException('Nominal pembayaran tidak sesuai dengan total pesanan');
        }
        if (payment.method !== payment.order.paymentMethod) {
          throw new ConflictException('Metode pembayaran tidak sesuai dengan pesanan');
        }
        if (payment.order.status !== PrismaOrderStatus.PENDING) {
          throw new ConflictException('Pesanan tidak dapat dikonfirmasi pada status saat ini');
        }
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: PrismaPaymentStatus.PAID,
            paidAt: new Date(),
            provider: provider?.name || payment.provider || 'MANUAL',
            providerTransactionId: provider?.transactionId || payment.providerTransactionId,
          },
        });
        return this.transitionInTx(
          tx,
          payment.order,
          'CONFIRMED',
          actor,
          'Pembayaran terverifikasi',
          requestId,
        );
      },
      { timeoutMs: 15_000 },
    );
  }

  async getTracking(id: string, trackingToken: string) {
    if (!trackingToken) throw new BadRequestException('trackingToken wajib');
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { items: true, payments: { orderBy: { createdAt: 'desc' } } },
    });
    if (!order || !order.trackingTokenHash || order.trackingTokenHash !== sha256(trackingToken)) {
      throw new NotFoundException('Pesanan tidak ditemukan');
    }
    return this.serialize(order);
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async expireReservations() {
    const now = new Date();
    const expired = await this.prisma.inventoryReservation.findMany({
      where: { status: ReservationStatus.ACTIVE, expiresAt: { lt: now } },
      take: 100,
    });

    for (const reservation of expired) {
      await withSerializableRetry(this.prisma, async (tx) => {
        const claimed = await tx.inventoryReservation.updateMany({
          where: {
            id: reservation.id,
            status: ReservationStatus.ACTIVE,
            expiresAt: { lt: now },
          },
          data: { status: ReservationStatus.EXPIRED, releasedAt: now },
        });
        if (claimed.count !== 1) return;

        const released = await tx.product.updateMany({
          where: {
            id: reservation.productId,
            reservedStock: { gte: reservation.quantity },
          },
          data: { reservedStock: { decrement: reservation.quantity } },
        });
        if (released.count !== 1) {
          throw new ConflictException('Reservasi tidak dapat dilepas karena stok berubah');
        }

        const order = await tx.order.findUnique({ where: { id: reservation.orderId } });
        if (!order || order.status !== PrismaOrderStatus.PENDING) return;

        const remaining = await tx.inventoryReservation.count({
          where: { orderId: order.id, status: ReservationStatus.ACTIVE },
        });
        if (remaining !== 0) return;

        await tx.order.update({
          where: { id: order.id },
          data: { status: PrismaOrderStatus.EXPIRED },
        });
        await tx.orderStatusHistory.create({
          data: {
            orderId: order.id,
            fromStatus: order.status,
            toStatus: PrismaOrderStatus.EXPIRED,
            note: 'Seluruh reservasi kedaluwarsa',
          },
        });
        await tx.outboxEvent.create({
          data: {
            aggregateType: 'Order',
            aggregateId: order.id,
            eventType: 'OrderStatusChanged',
            payload: { orderId: order.id, fromStatus: order.status, toStatus: 'EXPIRED' },
          },
        });
      });
    }
  }

  private async transitionInTx(
    tx: Prisma.TransactionClient,
    order: {
      id: string;
      status: PrismaOrderStatus;
      fulfillmentMethod: PrismaFulfillmentMethod;
      outletId: string;
      orderNumber: string;
      reservations: Array<{
        id: string;
        productId: string;
        quantity: number;
        status: ReservationStatus;
      }>;
    },
    nextStatus: OrderStatus,
    actor?: AuthenticatedUser,
    note?: string,
    requestId?: string,
  ): Promise<OrderWithDetails> {
    const currentStatus = order.status as OrderStatus;
    if (currentStatus === nextStatus) {
      return tx.order.findUniqueOrThrow({
        where: { id: order.id },
        include: { items: true, payments: true },
      });
    }
    assertOrderTransition(currentStatus, nextStatus);
    assertFulfillmentStatus(order.fulfillmentMethod as 'DELIVERY' | 'PICKUP', nextStatus);

    if (nextStatus === 'CONFIRMED') {
      await this.consumeReservations(tx, order);
    }
    if (nextStatus === 'CANCELLED' || nextStatus === 'EXPIRED') {
      const paidPayment = await tx.payment.findFirst({
        where: { orderId: order.id, status: PrismaPaymentStatus.PAID },
        select: { id: true },
      });
      if (paidPayment) {
        throw new ConflictException('Pesanan lunas tidak dapat dibatalkan tanpa refund');
      }
      await this.releaseReservations(tx, order);
    }

    const updated = await tx.order.update({
      where: { id: order.id },
      data: { status: nextStatus as PrismaOrderStatus },
    });
    await tx.orderStatusHistory.create({
      data: {
        orderId: order.id,
        fromStatus: order.status,
        toStatus: nextStatus as PrismaOrderStatus,
        changedById: actor?.id || null,
        note: note || null,
      },
    });
    await tx.auditLog.create({
      data: {
        outletId: order.outletId,
        actorId: actor?.id || null,
        action: 'ORDER_STATUS_CHANGED',
        entityType: 'Order',
        entityId: order.id,
        oldValue: { status: order.status },
        newValue: { status: nextStatus },
        requestId: requestId || null,
      },
    });
    await tx.outboxEvent.create({
      data: {
        aggregateType: 'Order',
        aggregateId: order.id,
        eventType: 'OrderStatusChanged',
        payload: { orderId: order.id, fromStatus: order.status, toStatus: nextStatus },
      },
    });
    return { ...updated, items: [], payments: [] };
  }

  private async consumeReservations(
    tx: Prisma.TransactionClient,
    order: {
      id: string;
      outletId: string;
      orderNumber: string;
      reservations: Array<{
        id: string;
        productId: string;
        quantity: number;
        status: ReservationStatus;
      }>;
    },
  ) {
    for (const reservation of order.reservations.filter(
      (item) => item.status === ReservationStatus.ACTIVE,
    )) {
      const product = await tx.product.findUnique({ where: { id: reservation.productId } });
      if (!product || product.stock < reservation.quantity) {
        throw new ConflictException('Stok tidak cukup saat konfirmasi pembayaran');
      }
      await tx.product.update({
        where: { id: product.id },
        data: {
          stock: { decrement: reservation.quantity },
          reservedStock: { decrement: reservation.quantity },
        },
      });
      await tx.inventoryReservation.update({
        where: { id: reservation.id },
        data: { status: ReservationStatus.CONSUMED },
      });
      await tx.stockMovement.create({
        data: {
          outletId: order.outletId,
          productId: product.id,
          type: 'OUT',
          quantity: reservation.quantity,
          stockBefore: product.stock,
          stockAfter: product.stock - reservation.quantity,
          reason: `Penjualan ${order.orderNumber}`,
          referenceType: 'ORDER',
          referenceId: order.id,
        },
      });
    }
  }

  private async releaseReservations(
    tx: Prisma.TransactionClient,
    order: {
      reservations: Array<{
        id: string;
        productId: string;
        quantity: number;
        status: ReservationStatus;
      }>;
    },
  ) {
    for (const reservation of order.reservations.filter(
      (item) => item.status === ReservationStatus.ACTIVE,
    )) {
      await tx.inventoryReservation.update({
        where: { id: reservation.id },
        data: { status: ReservationStatus.RELEASED, releasedAt: new Date() },
      });
      await tx.product.update({
        where: { id: reservation.productId },
        data: { reservedStock: { decrement: reservation.quantity } },
      });
    }
  }

  private assertCanView(
    order: { userId: string | null; outletId: string; trackingTokenHash?: string | null },
    requester?: AuthenticatedUser,
    trackingToken?: string,
  ) {
    if (requester && requester.role !== 'CUSTOMER' && requester.outletId === order.outletId) return;
    if (requester && order.userId === requester.id) return;
    if (trackingToken && order.trackingTokenHash === sha256(trackingToken)) return;
    throw new ForbiddenException('Anda tidak memiliki akses ke pesanan ini');
  }

  private assertStaffCanAccess(order: { outletId: string }, requester: AuthenticatedUser) {
    if (
      requester.role === UserRole.CUSTOMER ||
      (requester.role !== UserRole.ADMIN && requester.outletId !== order.outletId)
    ) {
      throw new ForbiddenException('Akses staff ke pesanan ini tidak diizinkan');
    }
  }

  private async resolveOutletId(requester?: AuthenticatedUser): Promise<string | null> {
    if (requester?.outletId) return requester.outletId;
    const outlet = await this.prisma.outlet.findFirst({ orderBy: { createdAt: 'asc' } });
    return outlet?.id ?? null;
  }

  private createOrderNumber(): string {
    const date = new Date().toISOString().slice(0, 10).replaceAll('-', '');
    const suffix = randomToken(4)
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, 5)
      .toUpperCase();
    return `KKS-${date}-${suffix}`;
  }

  private serialize(order: OrderWithDetails, trackingToken?: string) {
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      paymentMethod: order.paymentMethod,
      fulfillmentMethod: order.fulfillmentMethod,
      customerName: order.customerName,
      scheduledDate: order.scheduledDate.toISOString().slice(0, 10),
      deliveryAddress: order.deliveryAddress,
      pickupLocation: order.pickupLocation,
      subtotalIdr: bigintToNumber(order.subtotalIdr),
      shippingIdr: bigintToNumber(order.shippingIdr),
      totalIdr: bigintToNumber(order.totalIdr),
      ...(trackingToken ? { trackingToken } : {}),
      items: order.items.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        unitPriceIdr: bigintToNumber(item.unitPriceIdr),
        subtotalIdr: bigintToNumber(item.subtotalIdr),
      })),
      payment: order.payments[0]
        ? {
            id: order.payments[0].id,
            status: order.payments[0].status,
            method: order.payments[0].method,
            amountIdr: bigintToNumber(order.payments[0].amountIdr),
            paidAt: order.payments[0].paidAt,
          }
        : null,
    };
  }
}
