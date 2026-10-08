import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ProductMovementType, Prisma } from '@prisma/client';
import { UserRole } from '@kletak/contracts';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../common/prisma/prisma.service';
import { withSerializableRetry } from '../../common/database/transaction.util';
import { bigintToNumber } from '../../common/utils/serialize';
import { CreateStockMovementDto, InventoryQueryDto, MovementTypeDto } from './dto/inventory.dto';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: InventoryQueryDto, user: AuthenticatedUser) {
    const outletId = await this.resolveOutletId(user);
    if (!outletId) throw new ConflictException('Outlet belum dikonfigurasi');
    const where: Prisma.StockMovementWhereInput = {
      outletId,
      ...(query.productId ? { productId: query.productId } : {}),
    };
    const skip = (query.page - 1) * query.pageSize;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.stockMovement.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: query.pageSize,
        include: { product: { select: { name: true } } },
      }),
      this.prisma.stockMovement.count({ where }),
    ]);
    return {
      data: items.map((item) => ({
        id: item.id,
        productId: item.productId,
        productName: item.product.name,
        type: item.type,
        quantity: item.quantity,
        stockBefore: item.stockBefore,
        stockAfter: item.stockAfter,
        reason: item.reason,
        referenceType: item.referenceType,
        referenceId: item.referenceId,
        createdAt: item.createdAt,
      })),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  }

  async lowStock(user: AuthenticatedUser) {
    const outletId = await this.resolveOutletId(user);
    if (!outletId) throw new ConflictException('Outlet belum dikonfigurasi');
    const products = await this.prisma.product.findMany({
      where: { outletId, isActive: true },
      orderBy: [{ stock: 'asc' }, { name: 'asc' }],
    });
    return products
      .filter((product) => product.stock <= product.minStock)
      .map((product) => ({
        id: product.id,
        name: product.name,
        stock: product.stock,
        reservedStock: product.reservedStock,
        stockAvailable: Math.max(product.stock - product.reservedStock, 0),
        minStock: product.minStock,
        priceIdr: bigintToNumber(product.priceIdr),
      }));
  }

  async create(input: CreateStockMovementDto, user: AuthenticatedUser, requestId?: string) {
    const outletId = await this.resolveOutletId(user);
    if (!outletId) throw new ConflictException('Outlet belum dikonfigurasi');

    return withSerializableRetry(this.prisma, async (tx) => {
      const product = await tx.product.findFirst({ where: { id: input.productId, outletId } });
      if (!product) throw new NotFoundException('Produk tidak ditemukan');

      let quantity = input.quantity ?? 0;
      let stockAfter: number;
      if (input.type === MovementTypeDto.ADJUSTMENT) {
        if (input.newStock === undefined) {
          throw new ConflictException('newStock wajib untuk adjustment');
        }
        quantity = Math.abs(input.newStock - product.stock);
        if (quantity === 0) throw new ConflictException('Adjustment tidak mengubah stok');
        stockAfter = input.newStock;
      } else {
        if (!input.quantity) throw new ConflictException('quantity wajib untuk movement ini');
        stockAfter =
          input.type === MovementTypeDto.IN
            ? product.stock + input.quantity
            : product.stock - input.quantity;
        if (stockAfter < 0) throw new ConflictException('Stok tidak mencukupi');
      }
      if (stockAfter < product.reservedStock) {
        throw new ConflictException('Stok tidak boleh lebih kecil dari stok yang direservasi');
      }

      const updated = await tx.product.update({
        where: { id: product.id },
        data: { stock: stockAfter },
      });
      const movement = await tx.stockMovement.create({
        data: {
          outletId,
          productId: product.id,
          createdById: user.id,
          type: input.type as ProductMovementType,
          quantity,
          stockBefore: product.stock,
          stockAfter,
          reason: input.reason.trim(),
          referenceType: input.referenceType || null,
          referenceId: input.referenceId || null,
        },
      });
      await tx.auditLog.create({
        data: {
          outletId,
          actorId: user.id,
          action: 'INVENTORY_MOVEMENT_CREATED',
          entityType: 'StockMovement',
          entityId: movement.id,
          oldValue: { stock: product.stock },
          newValue: { stock: stockAfter, type: input.type, quantity },
          requestId: requestId || null,
        },
      });
      await tx.outboxEvent.create({
        data: {
          aggregateType: 'Product',
          aggregateId: product.id,
          eventType: 'StockChanged',
          payload: { productId: product.id, stock: stockAfter, type: input.type },
        },
      });
      return {
        id: movement.id,
        productId: product.id,
        productName: updated.name,
        type: movement.type,
        quantity: movement.quantity,
        stockBefore: movement.stockBefore,
        stockAfter: movement.stockAfter,
        reason: movement.reason,
      };
    });
  }

  private async resolveOutletId(user: AuthenticatedUser): Promise<string | null> {
    if (user.role !== UserRole.ADMIN && user.outletId) return user.outletId;
    const outlet = await this.prisma.outlet.findFirst({ orderBy: { createdAt: 'asc' } });
    return outlet?.id ?? null;
  }
}
