import { PrismaClient, UserRole } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  const outlet = await prisma.outlet.upsert({
    where: { slug: 'kletak-pusat' },
    update: {},
    create: { name: 'Kletak-Kletik Snack Pusat', slug: 'kletak-pusat' },
  });

  const passwordHash = await argon2.hash('KletakKletikDev123!', { type: argon2.argon2id });
  const users = [
    { name: 'Owner Kletak-Kletik', email: 'owner@kletakkletik.test', role: UserRole.OWNER },
    { name: 'Seller Kletak-Kletik', email: 'seller@kletakkletik.test', role: UserRole.SELLER },
    { name: 'Staff Gudang', email: 'staff@kletakkletik.test', role: UserRole.STAFF },
    { name: 'Pelanggan Demo', email: 'customer@kletakkletik.test', role: UserRole.CUSTOMER },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: { name: user.name, role: user.role, outletId: outlet.id, isActive: true },
      create: { ...user, outletId: outlet.id, passwordHash },
    });
  }

  const products = [
    {
      name: 'Keripik Pisang Original',
      category: 'Keripik',
      priceIdr: 12000n,
      stock: 80,
      minStock: 10,
      description: 'Keripik pisang renyah dengan spesifikasiEncryption yang aman.',
    },
    {
      name: 'Peyek Kacang Original',
      category: 'Peyek',
      priceIdr: 10000n,
      stock: 65,
      minStock: 10,
      description: 'Peyek kacang gurih dengan tekstur renyah.',
    },
    {
      name: 'Peyek Tempe Pedas',
      category: 'Peyek',
      priceIdr: 11000n,
      stock: 45,
      minStock: 8,
      description: 'Peyek tempe dengan cabai yang pedas nagih.',
    },
    {
      name: 'Kue Putu Ayu',
      category: 'Kue',
      priceIdr: 18000n,
      stock: 30,
      minStock: 5,
      description: 'Kue putu ayu lembut dengan santan premium.',
    },
  ];

  for (const product of products) {
    await prisma.product.upsert({
      where: { outletId_name: { outletId: outlet.id, name: product.name } },
      update: {
        category: product.category,
        priceIdr: product.priceIdr,
        minStock: product.minStock,
        description: product.description,
        isActive: true,
      },
      create: {
        outletId: outlet.id,
        name: product.name,
        category: product.category,
        priceIdr: product.priceIdr,
        stock: product.stock,
        minStock: product.minStock,
        description: product.description,
      },
    });
  }

  const accounts = [
    { code: '1-1000', name: 'Kas dan Bank', type: 'ASSET' as const, category: 'Kas' },
    { code: '1-1100', name: 'Piutang Usaha', type: 'ASSET' as const, category: 'Piutang' },
    { code: '1-1200', name: 'Persediaan', type: 'ASSET' as const, category: 'Persediaan' },
    { code: '4-1000', name: 'Penjualan', type: 'REVENUE' as const, category: 'Pendapatan' },
    { code: '5-1000', name: 'Harga Pokok Penjualan', type: 'EXPENSE' as const, category: 'Beban' },
    { code: '5-5000', name: 'Beban Operasional', type: 'EXPENSE' as const, category: 'Beban' },
  ];

  for (const account of accounts) {
    await prisma.chartOfAccount.upsert({
      where: { code: account.code },
      update: { name: account.name, type: account.type, category: account.category },
      create: account,
    });
  }

  console.log(`Seed selesai untuk outlet ${outlet.name}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
