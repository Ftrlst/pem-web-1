import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentMethod, PaymentStatus, Prisma } from '@prisma/client';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../common/prisma/prisma.service';
import { bigintToNumber } from '../../common/utils/serialize';
import { CreatePaymentDto } from './dto/payments.dto';
import { OrdersService } from '../orders/orders.service';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
    private readonly config: ConfigService,
  ) {}

  async create(
    input: CreatePaymentDto,
    user: AuthenticatedUser,
    idempotencyKey?: string,
    requestId?: string,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: input.orderId },
      include: { payments: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    if (!order) throw new NotFoundException('Pesanan tidak ditemukan');
    this.assertCanAccess(order, user);
    if (order.status !== 'PENDING')
      throw new ConflictException('Pesanan tidak dapat dibayar pada status ini');
    if (input.method !== order.paymentMethod) {
      throw new ConflictException('Metode pembayaran tidak sesuai dengan pesanan');
    }

    if (idempotencyKey) {
      const existing = await this.prisma.payment.findFirst({
        where: { orderId: order.id, idempotencyKey },
      });
      if (existing) return this.serialize(existing);
    }
    const active = order.payments[0];
    if (active && ['PENDING', 'PAID'].includes(active.status)) {
      if (active.status === PaymentStatus.PAID)
        throw new ConflictException('Pesanan sudah dibayar');
      return this.serialize(active);
    }

    const payment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.payment.create({
        data: {
          outletId: order.outletId,
          orderId: order.id,
          provider: 'MANUAL',
          idempotencyKey: idempotencyKey || null,
          method: input.method as PaymentMethod,
          amountIdr: order.totalIdr,
          status: input.method === 'COD' ? PaymentStatus.PENDING : PaymentStatus.UNPAID,
          metadata: {
            externalReference: input.externalReference || null,
            requestId: requestId || null,
          },
        },
      });
      await tx.auditLog.create({
        data: {
          outletId: order.outletId,
          actorId: user.id,
          action: 'PAYMENT_CREATED',
          entityType: 'Payment',
          entityId: created.id,
          newValue: {
            orderId: order.id,
            amountIdr: order.totalIdr.toString(),
            method: input.method,
          },
          requestId: requestId || null,
        },
      });
      return created;
    });
    return this.serialize(payment);
  }

  async verify(paymentId: string, user: AuthenticatedUser, requestId?: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { order: true },
    });
    if (!payment) throw new NotFoundException('Pembayaran tidak ditemukan');
    if (user.role !== 'ADMIN' && user.outletId !== payment.order.outletId) {
      throw new ForbiddenException('Pembayaran berada di luar outlet Anda');
    }
    const order = await this.orders.confirmPayment(paymentId, user, requestId);
    return this.serialize(
      await this.prisma.payment.findUniqueOrThrow({ where: { id: paymentId } }),
      order,
    );
  }

  async getById(id: string, user: AuthenticatedUser) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: { order: true },
    });
    if (!payment) throw new NotFoundException('Pembayaran tidak ditemukan');
    this.assertCanAccess(payment.order, user);
    return this.serialize(payment);
  }

  async handleWebhook(
    provider: string,
    body: Record<string, unknown>,
    rawBody: Buffer | undefined,
    headers: Record<string, string | string[] | undefined>,
    requestId?: string,
  ) {
    const normalizedProvider = provider.toLowerCase();
    const secret = this.config.get<string>(
      normalizedProvider === 'midtrans' ? 'MIDTRANS_WEBHOOK_SECRET' : 'XENDIT_WEBHOOK_SECRET',
      '',
    );
    if (!secret) throw new UnauthorizedException('Webhook provider belum dikonfigurasi');
    const signatureHeader =
      this.headerValue(headers, 'x-webhook-signature') || this.headerValue(headers, 'x-signature');
    if (!signatureHeader) throw new UnauthorizedException('Signature webhook tidak ditemukan');
    const payload = rawBody ?? Buffer.from(JSON.stringify(body));
    const expected = createHmac('sha256', secret).update(payload).digest('hex');
    const supplied = signatureHeader.replace(/^sha256=/i, '').trim();
    const expectedBuffer = Buffer.from(expected, 'utf8');
    const suppliedBuffer = Buffer.from(supplied, 'utf8');
    if (
      expectedBuffer.length !== suppliedBuffer.length ||
      !timingSafeEqual(expectedBuffer, suppliedBuffer)
    ) {
      throw new UnauthorizedException('Signature webhook tidak valid');
    }

    const eventId =
      this.headerValue(headers, 'x-event-id') ||
      String(body.event_id || body.id || body.transaction_id || '');
    if (!eventId) throw new BadRequestException('eventId webhook tidak ditemukan');
    const payloadHash = createHash('sha256').update(payload).digest('hex');
    try {
      await this.prisma.webhookEvent.create({
        data: { provider: normalizedProvider, eventId, payloadHash, status: 'RECEIVED' },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const existing = await this.prisma.webhookEvent.findUnique({
          where: { provider_eventId: { provider: normalizedProvider, eventId } },
        });
        if (existing?.status === 'PROCESSED') return { received: true, duplicate: true };
        if (existing) {
          await this.prisma.webhookEvent.update({
            where: { id: existing.id },
            data: { status: 'RECEIVED', error: null, processedAt: null },
          });
        }
      } else {
        throw error;
      }
    }

    const transactionId = String(body.transaction_id || body.id || body.payment_id || '');
    const payment = transactionId
      ? await this.prisma.payment.findFirst({
          where: {
            OR: [
              { providerTransactionId: transactionId },
              { orderId: String(body.order_id || body.external_reference || '') },
            ],
          },
          include: { order: true },
        })
      : null;
    if (!payment) {
      await this.prisma.webhookEvent.update({
        where: { provider_eventId: { provider: normalizedProvider, eventId } },
        data: { status: 'UNMATCHED', processedAt: new Date() },
      });
      return { received: true, matched: false };
    }

    try {
      const expectedAmount = payment.amountIdr;
      const receivedAmount = body.gross_amount ?? body.amount ?? body.paid_amount;
      if (
        receivedAmount !== undefined &&
        BigInt(Math.round(Number(receivedAmount))) !== expectedAmount
      ) {
        await this.prisma.webhookEvent.update({
          where: { provider_eventId: { provider: normalizedProvider, eventId } },
          data: { status: 'AMOUNT_MISMATCH', processedAt: new Date(), error: 'Amount mismatch' },
        });
        throw new BadRequestException('Nominal webhook tidak cocok dengan invoice');
      }

      const status = String(body.status || body.transaction_status || '').toUpperCase();
      const paid = ['PAID', 'SUCCESS', 'SETTLED', 'CAPTURED'].includes(status);
      const failed = ['FAILED', 'DENIED', 'CANCELLED', 'EXPIRED', 'VOID'].includes(status);
      if (paid) {
        await this.orders.confirmPayment(payment.id, undefined, requestId, {
          name: normalizedProvider,
          transactionId: transactionId || payment.providerTransactionId || undefined,
        });
      } else if (failed) {
        await this.prisma.payment.update({
          where: { id: payment.id },
          data: {
            provider: normalizedProvider,
            providerTransactionId: transactionId || payment.providerTransactionId,
            status: status === 'EXPIRED' ? PaymentStatus.EXPIRED : PaymentStatus.FAILED,
          },
        });
      }
      await this.prisma.webhookEvent.update({
        where: { provider_eventId: { provider: normalizedProvider, eventId } },
        data: { status: 'PROCESSED', processedAt: new Date() },
      });
      return { received: true, matched: true, paid };
    } catch (error) {
      await this.prisma.webhookEvent.update({
        where: { provider_eventId: { provider: normalizedProvider, eventId } },
        data: {
          status: 'FAILED',
          error: error instanceof Error ? error.message.slice(0, 1000) : 'Unknown webhook error',
        },
      });
      throw error;
    }
  }

  private headerValue(
    headers: Record<string, string | string[] | undefined>,
    name: string,
  ): string {
    const value = headers[name] ?? headers[name.toLowerCase()];
    return Array.isArray(value) ? value[0] || '' : value || '';
  }

  private assertCanAccess(
    order: { userId: string | null; outletId: string },
    user: AuthenticatedUser,
  ) {
    const isStaff = user.role !== 'CUSTOMER' && user.outletId === order.outletId;
    const isCustomer = order.userId === user.id;
    if (!isStaff && !isCustomer)
      throw new ForbiddenException('Anda tidak memiliki akses ke pembayaran ini');
  }

  private serialize(
    payment: {
      id: string;
      orderId: string;
      provider: string;
      providerTransactionId: string | null;
      method: PaymentMethod;
      amountIdr: bigint;
      status: PaymentStatus;
      paidAt: Date | null;
      createdAt: Date;
    },
    order?: { orderNumber: string },
  ) {
    return {
      id: payment.id,
      orderId: payment.orderId,
      orderNumber: order?.orderNumber,
      provider: payment.provider,
      providerTransactionId: payment.providerTransactionId,
      method: payment.method,
      amountIdr: bigintToNumber(payment.amountIdr),
      status: payment.status,
      paidAt: payment.paidAt,
      createdAt: payment.createdAt,
    };
  }
}
