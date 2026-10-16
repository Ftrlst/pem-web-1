import { createHmac, randomUUID } from 'node:crypto';
import { describe, expect, beforeAll, afterAll, it } from 'vitest';
import { PrismaClient, UserRole } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthenticatedUser } from '../../src/common/decorators/current-user.decorator';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { PasswordService } from '../../src/common/security/password.service';
import { OrdersService } from '../../src/modules/orders/orders.service';
import { CreateOrderDto, OrderStatusDto } from '../../src/modules/orders/dto/orders.dto';
import { PaymentsService } from '../../src/modules/payments/payments.service';
import { CreatePaymentDto } from '../../src/modules/payments/dto/payments.dto';
import { AuthService } from '../../src/modules/auth/auth.service';

const databaseUrl = process.env.TEST_DATABASE_URL ?? '';
const describeDb = databaseUrl ? describe : describe.skip;
const isTestDatabase = /test/i.test(databaseUrl);
const password = 'IntegrationTest123!';

function actor(user: { id: string; role: UserRole; outletId: string | null }): AuthenticatedUser {
  return { id: user.id, role: user.role as AuthenticatedUser['role'], outletId: user.outletId };
}

function orderInput(
  productId: string,
  key: string,
  customerName = 'Integration Customer',
): CreateOrderDto {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return {
    customerName,
    items: [{ productId, quantity: 1 }],
    fulfillmentMethod: 'PICKUP',
    scheduledDate: date.toISOString().slice(0, 10),
    pickupLocation: 'Kletak-Kletik Pusat',
    paymentMethod: 'TRANSFER',
  } as CreateOrderDto;
}

describeDb('production guards against PostgreSQL', () => {
  let prisma: PrismaClient;
  let orders: OrdersService;
  let payments: PaymentsService;
  let auth: AuthService;
  let outletId: string;
  let owner: { id: string; email: string; role: UserRole; outletId: string | null };
  let customerA: { id: string; email: string; role: UserRole; outletId: string | null };
  let customerB: { id: string; email: string; role: UserRole; outletId: string | null };
  let productId: string;

  beforeAll(async () => {
    prisma = new PrismaClient({ datasourceUrl: databaseUrl });
    await prisma.$connect();
    const passwordService = new PasswordService();
    const outlet = await prisma.outlet.create({
      data: { name: 'Integration Outlet', slug: `integration-${randomUUID().slice(0, 8)}` },
    });
    outletId = outlet.id;
    const passwordHash = await passwordService.hash(password);
    owner = await prisma.user.create({
      data: {
        name: 'Owner Test',
        email: `owner-${randomUUID()}@test.local`,
        passwordHash,
        role: UserRole.OWNER,
        outletId,
      },
      select: { id: true, email: true, role: true, outletId: true },
    });
    customerA = await prisma.user.create({
      data: {
        name: 'Customer A',
        email: `a-${randomUUID()}@test.local`,
        passwordHash,
        role: UserRole.CUSTOMER,
        outletId,
      },
      select: { id: true, email: true, role: true, outletId: true },
    });
    customerB = await prisma.user.create({
      data: {
        name: 'Customer B',
        email: `b-${randomUUID()}@test.local`,
        passwordHash,
        role: UserRole.CUSTOMER,
        outletId,
      },
      select: { id: true, email: true, role: true, outletId: true },
    });
    const product = await prisma.product.create({
      data: {
        outletId,
        name: `Product ${randomUUID().slice(0, 6)}`,
        category: 'Test',
        priceIdr: 10000n,
        stock: 10,
        minStock: 1,
      },
    });
    productId = product.id;

    orders = new OrdersService(prisma as unknown as PrismaService);
    const config = {
      get: (key: string, fallback?: unknown) =>
        key === 'MIDTRANS_WEBHOOK_SECRET' ? 'integration-secret' : fallback,
    } as unknown as ConfigService;
    payments = new PaymentsService(prisma as unknown as PrismaService, orders, config);
    auth = new AuthService(
      prisma as unknown as PrismaService,
      new JwtService({ secret: 'integration-access-secret-32-characters-long' }),
      passwordService,
      config,
    );
  });

  afterAll(async () => {
    if (prisma) {
      if (isTestDatabase) {
        await prisma.$executeRawUnsafe(
          'TRUNCATE TABLE "JournalLine", "JournalEntry", "ChatMessage", "ChatRoom", "AuditLog", "OutboxEvent", "WebhookEvent", "StockMovement", "InventoryReservation", "Payment", "OrderItem", "OrderStatusHistory", "Order", "Product", "RefreshToken", "User", "Outlet", "ChartOfAccount" CASCADE',
        );
      }
      await prisma.$disconnect();
    }
  });

  it('only allows CONFIRMED through verified payment and consumes stock atomically', async () => {
    const order = await orders.create(
      orderInput(productId, randomUUID()),
      customerA ? actor(customerA) : undefined,
      randomUUID(),
    );

    await expect(
      orders.updateStatus(order.id, { status: OrderStatusDto.CONFIRMED }, actor(owner)),
    ).rejects.toThrow('payment verification');

    const payment = await payments.create(
      { orderId: order.id, method: 'TRANSFER' } as CreatePaymentDto,
      actor(customerA),
      randomUUID(),
    );
    await payments.verify(payment.id, actor(owner));

    const confirmed = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { payments: true, reservations: true },
    });
    expect(confirmed.status).toBe('CONFIRMED');
    expect(confirmed.payments[0]?.status).toBe('PAID');
    expect(confirmed.reservations[0]?.status).toBe('CONSUMED');
  });

  it('prevents a customer from cancelling another customer order', async () => {
    const order = await orders.create(
      orderInput(productId, randomUUID()),
      actor(customerA),
      randomUUID(),
    );
    await expect(orders.cancel(order.id, actor(customerB))).rejects.toThrow('bukan milik Anda');
    await expect(orders.cancel(order.id, actor(customerA))).resolves.toMatchObject({
      status: 'CANCELLED',
    });
  });

  it('allows only one reservation when concurrent orders compete for one unit', async () => {
    const product = await prisma.product.create({
      data: {
        outletId,
        name: `Scarce ${randomUUID().slice(0, 6)}`,
        category: 'Test',
        priceIdr: 10000n,
        stock: 1,
        minStock: 0,
      },
    });
    const results = await Promise.allSettled([
      orders.create(orderInput(product.id, randomUUID()), actor(customerA), randomUUID()),
      orders.create(orderInput(product.id, randomUUID()), actor(customerB), randomUUID()),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    const updated = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(updated.reservedStock).toBeLessThanOrEqual(1);
  });

  it('accepts a valid webhook once and treats a replay as duplicate', async () => {
    const order = await orders.create(
      orderInput(productId, randomUUID()),
      actor(customerA),
      randomUUID(),
    );
    const payment = await payments.create(
      { orderId: order.id, method: 'TRANSFER' } as CreatePaymentDto,
      actor(customerA),
      randomUUID(),
    );
    const body = {
      order_id: order.id,
      transaction_id: `tx-${randomUUID()}`,
      status: 'PAID',
      gross_amount: order.totalIdr,
    };
    const rawBody = Buffer.from(JSON.stringify(body));
    const signature = createHmac('sha256', 'integration-secret').update(rawBody).digest('hex');
    const headers = { 'x-event-id': randomUUID(), 'x-webhook-signature': signature };

    const first = await payments.handleWebhook('midtrans', body, rawBody, headers);
    const second = await payments.handleWebhook('midtrans', body, rawBody, headers);
    expect(first).toMatchObject({ matched: true, paid: true });
    expect(second).toMatchObject({ duplicate: true });
    const updated = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(updated.status).toBe('PAID');
    expect(updated.providerTransactionId).toBe(body.transaction_id);
  });

  it('does not mark an order paid when the webhook amount does not match', async () => {
    const order = await orders.create(
      orderInput(productId, randomUUID()),
      actor(customerA),
      randomUUID(),
    );
    const payment = await payments.create(
      { orderId: order.id, method: 'TRANSFER' } as CreatePaymentDto,
      actor(customerA),
      randomUUID(),
    );
    const body = {
      order_id: order.id,
      transaction_id: `tx-mismatch-${randomUUID()}`,
      status: 'PAID',
      gross_amount: order.totalIdr + 1,
    };
    const rawBody = Buffer.from(JSON.stringify(body));
    const signature = createHmac('sha256', 'integration-secret').update(rawBody).digest('hex');

    await expect(
      payments.handleWebhook('midtrans', body, rawBody, {
        'x-event-id': randomUUID(),
        'x-webhook-signature': signature,
      }),
    ).rejects.toThrow('tidak cocok');
    const unchanged = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(unchanged.status).not.toBe('PAID');
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe(
      'PENDING',
    );
  });

  it('rotates refresh tokens and rejects reuse', async () => {
    const login = await auth.login({ email: owner.email, password });
    const rotated = await auth.refresh(login.refreshToken);
    expect(rotated.accessToken).toBeTruthy();
    await expect(auth.refresh(login.refreshToken)).rejects.toThrow('sudah digunakan');
  });
});
