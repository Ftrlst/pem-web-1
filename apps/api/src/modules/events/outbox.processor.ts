import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OutboxStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AccountingService } from '../accounting/accounting.service';

@Injectable()
export class OutboxProcessor {
  private readonly logger = new Logger(OutboxProcessor.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly accounting: AccountingService,
  ) {}

  @Cron(CronExpression.EVERY_5_SECONDS)
  async processPendingEvents() {
    if (this.running) return;
    this.running = true;
    try {
      const now = new Date();
      await this.prisma.outboxEvent.updateMany({
        where: { status: OutboxStatus.PROCESSING, availableAt: { lt: now } },
        data: {
          status: OutboxStatus.PENDING,
          availableAt: now,
          lastError: 'Recovered expired lease',
        },
      });
      const events = await this.prisma.outboxEvent.findMany({
        where: { status: OutboxStatus.PENDING, availableAt: { lte: new Date() } },
        orderBy: { createdAt: 'asc' },
        take: 50,
      });
      for (const event of events) await this.processEvent(event.id);
    } catch (error) {
      this.logger.error(
        'Gagal membaca outbox event',
        error instanceof Error ? error.stack : undefined,
      );
    } finally {
      this.running = false;
    }
  }

  private async processEvent(id: string) {
    const claimed = await this.prisma.outboxEvent.updateMany({
      where: { id, status: OutboxStatus.PENDING, availableAt: { lte: new Date() } },
      data: {
        status: OutboxStatus.PROCESSING,
        attempts: { increment: 1 },
        availableAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    });
    if (claimed.count !== 1) return;

    try {
      const event = await this.prisma.outboxEvent.findUniqueOrThrow({ where: { id } });
      if (event.eventType === 'OrderStatusChanged') {
        const payload = event.payload as { toStatus?: string };
        if (payload.toStatus === 'CONFIRMED') {
          await this.accounting.postOrderPaymentJournal(event.aggregateId);
        }
      }
      // Other consumers (notification, search indexing, and analytics) subscribe here.
      // The event is deliberately acknowledged only after the local consumer succeeds.
      this.logger.debug(
        `Outbox event ${event.eventType} for ${event.aggregateType}/${event.aggregateId}`,
      );
      await this.prisma.outboxEvent.update({
        where: { id },
        data: { status: OutboxStatus.PUBLISHED, publishedAt: new Date(), lastError: null },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown outbox error';
      const event = await this.prisma.outboxEvent.findUnique({
        where: { id },
        select: { attempts: true },
      });
      const attempts = event?.attempts ?? 1;
      const delaySeconds = Math.min(3600, 2 ** Math.min(attempts, 10));
      await this.prisma.outboxEvent.update({
        where: { id },
        data: {
          status: attempts >= 10 ? OutboxStatus.FAILED : OutboxStatus.PENDING,
          availableAt: new Date(Date.now() + delaySeconds * 1000),
          lastError: message.slice(0, 1000),
        },
      });
      this.logger.error(`Outbox event ${id} gagal: ${message}`);
    }
  }
}
