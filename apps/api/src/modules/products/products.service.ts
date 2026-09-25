import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { UserRole } from '@kletak/contracts';
import { Prisma } from '@prisma/client';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../common/prisma/prisma.service';
import { bigintToNumber } from '../../common/utils/serialize';
import { CreateProductDto, ProductQueryDto, UpdateProductDto } from './dto/products.dto';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ProductQueryDto, requester?: AuthenticatedUser) {
    const outletId = await this.resolveOutletId(requester);
    const where: Prisma.ProductWhereInput = {
      ...(outletId ? { outletId } : {}),
      isActive: true,
      ...(query.category ? { category: { equals: query.category, mode: 'insensitive' } } : {}),
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: 'insensitive' } },
              { description: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const skip = (query.page - 1) * query.pageSize;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
        skip,
        take: query.pageSize,
      }),
      this.prisma.product.count({ where }),
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

  async getById(id: string, requester?: AuthenticatedUser) {
    const outletId = await this.resolveOutletId(requester);
    const product = await this.prisma.product.findFirst({
      where: { id, isActive: true, ...(outletId ? { outletId } : {}) },
    });
    if (!product) throw new NotFoundException('Produk tidak ditemukan');
    return this.serialize(product);
  }

  async create(input: CreateProductDto, requester: AuthenticatedUser) {
    const outletId = await this.resolveOutletId(requester);
    if (!outletId) throw new ConflictException('Pengguna belum memiliki outlet');
    const product = await this.prisma.product.create({
      data: {
        outletId,
        createdById: requester.id,
        name: input.name.trim(),
        category: input.category.trim(),
        priceIdr: BigInt(input.priceIdr),
        stock: input.stock,
        minStock: input.minStock,
        description: input.description?.trim() || null,
        imageUrl: input.imageUrl || null,
        isActive: input.isActive,
      },
    });
    return this.serialize(product);
  }

  async update(id: string, input: UpdateProductDto, requester: AuthenticatedUser) {
    const outletId = await this.resolveOutletId(requester);
    if (!outletId) throw new ConflictException('Outlet belum dikonfigurasi');
    const product = await this.prisma.product.findFirst({
      where: { id, outletId },
    });
    if (!product) throw new NotFoundException('Produk tidak ditemukan');
    if (input.stock !== undefined && input.stock < product.reservedStock) {
      throw new ConflictException('Stok tidak boleh lebih kecil dari stok yang sedang direservasi');
    }
    const updated = await this.prisma.product.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.category !== undefined ? { category: input.category.trim() } : {}),
        ...(input.priceIdr !== undefined ? { priceIdr: BigInt(input.priceIdr) } : {}),
        ...(input.stock !== undefined ? { stock: input.stock } : {}),
        ...(input.minStock !== undefined ? { minStock: input.minStock } : {}),
        ...(input.description !== undefined
          ? { description: input.description.trim() || null }
          : {}),
        ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl || null } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });
    return this.serialize(updated);
  }

  async deactivate(id: string, requester: AuthenticatedUser) {
    const outletId = await this.resolveOutletId(requester);
    if (!outletId) throw new ConflictException('Outlet belum dikonfigurasi');
    const product = await this.prisma.product.findFirst({
      where: { id, outletId },
    });
    if (!product) throw new NotFoundException('Produk tidak ditemukan');
    await this.prisma.product.update({ where: { id }, data: { isActive: false } });
    return { id, isActive: false };
  }

  private async resolveOutletId(requester?: AuthenticatedUser): Promise<string | null> {
    if (requester?.outletId) return requester.outletId;
    if (requester?.role === UserRole.ADMIN) return null;
    const outlet = await this.prisma.outlet.findFirst({ orderBy: { createdAt: 'asc' } });
    return outlet?.id ?? null;
  }

  private serialize(product: {
    id: string;
    name: string;
    category: string;
    priceIdr: bigint;
    stock: number;
    reservedStock: number;
    minStock: number;
    description: string | null;
    imageUrl: string | null;
    isActive: boolean;
  }) {
    const priceIdr = bigintToNumber(product.priceIdr);
    return {
      id: product.id,
      name: product.name,
      category: product.category,
      priceIdr,
      stock: product.stock,
      reservedStock: product.reservedStock,
      stockAvailable: Math.max(product.stock - product.reservedStock, 0),
      minStock: product.minStock,
      description: product.description,
      imageUrl: product.imageUrl,
      isActive: product.isActive,
    };
  }
}
