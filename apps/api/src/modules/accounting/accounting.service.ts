import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { bigintToNumber } from '../../common/utils/serialize';

@Injectable()
export class AccountingService {
  constructor(private readonly prisma: PrismaService) {}

  async coa() {
    return this.prisma.chartOfAccount.findMany({ orderBy: { code: 'asc' } });
  }

  async journals(params: { from?: string; to?: string; page: number; pageSize: number }) {
    const where: Prisma.JournalEntryWhereInput = {
      ...(params.from || params.to
        ? {
            entryDate: {
              ...(params.from ? { gte: new Date(`${params.from}T00:00:00.000Z`) } : {}),
              ...(params.to ? { lte: new Date(`${params.to}T23:59:59.999Z`) } : {}),
            },
          }
        : {}),
    };
    const skip = (params.page - 1) * params.pageSize;
    const [data, total] = await this.prisma.$transaction([
      this.prisma.journalEntry.findMany({
        where,
        orderBy: [{ entryDate: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: params.pageSize,
        include: { lines: { include: { account: true } } },
      }),
      this.prisma.journalEntry.count({ where }),
    ]);
    return {
      data: data.map((entry) => ({
        ...entry,
        lines: entry.lines.map((line) => ({
          ...line,
          debitIdr: bigintToNumber(line.debitIdr),
          creditIdr: bigintToNumber(line.creditIdr),
        })),
      })),
      meta: {
        page: params.page,
        pageSize: params.pageSize,
        total,
        totalPages: Math.ceil(total / params.pageSize),
      },
    };
  }

  async ledger(accountCode: string, from?: string, to?: string) {
    const account = await this.prisma.chartOfAccount.findUnique({ where: { code: accountCode } });
    if (!account) return [];
    const lines = await this.prisma.journalLine.findMany({
      where: {
        accountId: account.id,
        ...(from || to
          ? {
              journalEntry: {
                entryDate: {
                  ...(from ? { gte: new Date(`${from}T00:00:00.000Z`) } : {}),
                  ...(to ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}),
                },
              },
            }
          : {}),
      },
      orderBy: { journalEntry: { entryDate: 'asc' } },
      include: { journalEntry: true },
    });
    let runningBalance = 0n;
    return lines.map((line) => {
      runningBalance += line.debitIdr - line.creditIdr;
      return {
        id: line.id,
        date: line.journalEntry.entryDate,
        entryNumber: line.journalEntry.entryNumber,
        description: line.journalEntry.description,
        debitIdr: bigintToNumber(line.debitIdr),
        creditIdr: bigintToNumber(line.creditIdr),
        balanceIdr: bigintToNumber(runningBalance),
      };
    });
  }

  async postOrderPaymentJournal(orderId: string) {
    const existing = await this.prisma.journalEntry.findFirst({
      where: { referenceType: 'ORDER', referenceId: orderId },
      select: { id: true },
    });
    if (existing) return existing;

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { payments: { where: { status: 'PAID' }, orderBy: { paidAt: 'desc' }, take: 1 } },
    });
    const payment = order?.payments[0];
    if (!order || !payment) return null;

    const [cash, revenue] = await Promise.all([
      this.prisma.chartOfAccount.findUnique({ where: { code: '1-1000' } }),
      this.prisma.chartOfAccount.findUnique({ where: { code: '4-1000' } }),
    ]);
    if (!cash || !revenue) throw new Error('COA akun kas atau penjualan belum tersedia');

    try {
      return await this.prisma.journalEntry.create({
        data: {
          entryNumber: `JE-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
          entryDate: new Date(),
          description: `Pembayaran pesanan ${order.orderNumber}`,
          referenceId: order.id,
          referenceType: 'ORDER',
          lines: {
            create: [
              {
                accountId: cash.id,
                accountCode: cash.code,
                debitIdr: order.totalIdr,
                creditIdr: 0n,
              },
              {
                accountId: revenue.id,
                accountCode: revenue.code,
                debitIdr: 0n,
                creditIdr: order.totalIdr,
              },
            ],
          },
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return this.prisma.journalEntry.findFirstOrThrow({
          where: { referenceType: 'ORDER', referenceId: orderId },
        });
      }
      throw error;
    }
  }

  async trialBalance(from?: string, to?: string) {
    const lines = await this.prisma.journalLine.findMany({
      where: {
        ...(from || to
          ? {
              journalEntry: {
                entryDate: {
                  ...(from ? { gte: new Date(`${from}T00:00:00.000Z`) } : {}),
                  ...(to ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}),
                },
              },
            }
          : {}),
      },
      select: { accountId: true, accountCode: true, debitIdr: true, creditIdr: true },
    });
    const grouped = new Map<string, { code: string; debit: bigint; credit: bigint }>();
    for (const line of lines) {
      const current = grouped.get(line.accountId) ?? {
        code: line.accountCode,
        debit: 0n,
        credit: 0n,
      };
      current.debit += line.debitIdr;
      current.credit += line.creditIdr;
      grouped.set(line.accountId, current);
    }
    const rows = [...grouped.entries()].map(([accountId, value]) => ({
      accountId,
      accountCode: value.code,
      debitIdr: bigintToNumber(value.debit),
      creditIdr: bigintToNumber(value.credit),
      balanceIdr: bigintToNumber(value.debit - value.credit),
    }));
    return {
      rows,
      totals: {
        debitIdr: rows.reduce((sum, row) => sum + row.debitIdr, 0),
        creditIdr: rows.reduce((sum, row) => sum + row.creditIdr, 0),
      },
      balanced:
        rows.reduce((sum, row) => sum + row.debitIdr, 0) ===
        rows.reduce((sum, row) => sum + row.creditIdr, 0),
    };
  }
}
