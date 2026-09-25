import { z } from 'zod';

export const USER_ROLES = ['CUSTOMER', 'STAFF', 'SELLER', 'OWNER', 'ADMIN'] as const;
export const UserRole = {
  CUSTOMER: 'CUSTOMER',
  STAFF: 'STAFF',
  SELLER: 'SELLER',
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
} as const;
export type UserRole = (typeof USER_ROLES)[number];

export const ORDER_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'PREPARING',
  'PACKED',
  'READY_DELIVERY',
  'READY_PICKUP',
  'COMPLETED',
  'CANCELLED',
  'EXPIRED',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_METHODS = ['TRANSFER', 'QRIS', 'EWALLET', 'COD'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const FULFILLMENT_METHODS = ['DELIVERY', 'PICKUP'] as const;
export type FulfillmentMethod = (typeof FULFILLMENT_METHODS)[number];

export const PAYMENT_STATUSES = [
  'UNPAID',
  'PENDING',
  'PAID',
  'FAILED',
  'EXPIRED',
  'REFUNDED',
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const STOCK_MOVEMENT_TYPES = ['IN', 'OUT', 'ADJUSTMENT', 'DAMAGE', 'EXPIRED'] as const;
export type StockMovementType = (typeof STOCK_MOVEMENT_TYPES)[number];

export const idSchema = z.string().uuid();

export const moneySchema = z.union([
  z.string().regex(/^\d+$/, 'nominal harus bilangan bulat rupiah'),
  z.number().int().nonnegative(),
]);

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().min(8).max(24).optional(),
  password: z.string().min(12).max(128),
});

export const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(128),
});

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  phone: z.string().trim().min(8).max(24).optional(),
});

export const productQuerySchema = z.object({
  q: z.string().trim().max(80).optional(),
  category: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export const createProductSchema = z.object({
  name: z.string().trim().min(2).max(160),
  category: z.string().trim().min(2).max(80),
  priceIdr: z.coerce.number().int().positive(),
  stock: z.coerce.number().int().min(0).default(0),
  minStock: z.coerce.number().int().min(0).default(5),
  description: z.string().trim().max(2000).optional(),
  imageUrl: z.string().url().max(500).optional(),
  isActive: z.boolean().default(true),
});

export const updateProductSchema = createProductSchema.partial();

export const createOrderSchema = z
  .object({
    customerName: z.string().trim().min(2).max(120).optional(),
    customerPhone: z.string().trim().max(24).optional(),
    items: z
      .array(
        z.object({
          productId: idSchema,
          quantity: z.coerce.number().int().min(1).max(100),
        }),
      )
      .min(1)
      .max(50),
    fulfillmentMethod: z.enum(FULFILLMENT_METHODS),
    scheduledDate: z.string().date(),
    deliveryAddress: z.string().trim().min(10).max(500).optional(),
    pickupLocation: z.string().trim().min(2).max(200).optional(),
    paymentMethod: z.enum(PAYMENT_METHODS),
    customerNote: z.string().trim().max(500).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.fulfillmentMethod === 'DELIVERY' && !value.deliveryAddress) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['deliveryAddress'],
        message: 'Alamat wajib untuk delivery',
      });
    }
    if (value.fulfillmentMethod === 'PICKUP' && !value.pickupLocation) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['pickupLocation'],
        message: 'Lokasi wajib untuk pickup',
      });
    }
  });

export const updateOrderStatusSchema = z.object({
  status: z.enum(ORDER_STATUSES),
  note: z.string().trim().max(500).optional(),
});

export const createPaymentSchema = z.object({
  orderId: idSchema,
  method: z.enum(PAYMENT_METHODS),
  externalReference: z.string().trim().max(200).optional(),
});

export const createStockMovementSchema = z.object({
  productId: idSchema,
  type: z.enum(STOCK_MOVEMENT_TYPES),
  quantity: z.coerce.number().int().positive().optional(),
  newStock: z.coerce.number().int().min(0).optional(),
  reason: z.string().trim().min(2).max(200),
  referenceType: z.string().trim().max(100).optional(),
  referenceId: z.string().trim().max(100).optional(),
});

export const paginationMetaSchema = z.object({
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
});

export const apiErrorSchema = z.object({
  statusCode: z.number().int(),
  code: z.string(),
  message: z.string(),
  requestId: z.string().optional(),
  details: z.unknown().optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ProductQuery = z.infer<typeof productQuerySchema>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
export type CreateStockMovementInput = z.infer<typeof createStockMovementSchema>;

export type AuthResponse = {
  accessToken: string;
  expiresIn: number;
  user: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    role: UserRole;
  };
};

export type ProductResponse = {
  id: string;
  name: string;
  category: string;
  priceIdr: number;
  stock: number;
  reservedStock: number;
  stockAvailable: number;
  minStock: number;
  description: string | null;
  imageUrl: string | null;
  isActive: boolean;
};

export type OrderResponse = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  fulfillmentMethod: FulfillmentMethod;
  customerName: string;
  scheduledDate: string;
  deliveryAddress: string | null;
  pickupLocation: string | null;
  subtotalIdr: number;
  shippingIdr: number;
  totalIdr: number;
  trackingToken?: string;
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    unitPriceIdr: number;
    subtotalIdr: number;
  }>;
};

export const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED', 'EXPIRED'],
  CONFIRMED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['PACKED', 'CANCELLED'],
  PACKED: ['READY_DELIVERY', 'READY_PICKUP', 'CANCELLED'],
  READY_DELIVERY: ['COMPLETED', 'CANCELLED'],
  READY_PICKUP: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
  EXPIRED: [],
};

export function canTransitionOrder(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from].includes(to);
}
