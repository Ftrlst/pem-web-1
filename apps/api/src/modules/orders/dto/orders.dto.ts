import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export enum FulfillmentMethodDto {
  DELIVERY = 'DELIVERY',
  PICKUP = 'PICKUP',
}

export enum PaymentMethodDto {
  TRANSFER = 'TRANSFER',
  QRIS = 'QRIS',
  EWALLET = 'EWALLET',
  COD = 'COD',
}

export enum OrderStatusDto {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  PREPARING = 'PREPARING',
  PACKED = 'PACKED',
  READY_DELIVERY = 'READY_DELIVERY',
  READY_PICKUP = 'READY_PICKUP',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
}

export class CreateOrderItemDto {
  @IsUUID()
  productId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  quantity!: number;
}

export class CreateOrderDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  customerName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(24)
  customerPhone?: string;

  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  @ArrayMinSize(1)
  items!: CreateOrderItemDto[];

  @IsEnum(FulfillmentMethodDto)
  fulfillmentMethod!: FulfillmentMethodDto;

  @IsDateString()
  scheduledDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  deliveryAddress?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  pickupLocation?: string;

  @IsEnum(PaymentMethodDto)
  paymentMethod!: PaymentMethodDto;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  customerNote?: string;
}

export class UpdateOrderStatusDto {
  @IsEnum(OrderStatusDto)
  status!: OrderStatusDto;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class OrderQueryDto {
  @IsOptional()
  @IsEnum(OrderStatusDto)
  status?: OrderStatusDto;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize = 20;
}
