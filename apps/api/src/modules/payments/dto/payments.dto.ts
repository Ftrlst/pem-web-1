import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export enum PaymentMethodDto {
  TRANSFER = 'TRANSFER',
  QRIS = 'QRIS',
  EWALLET = 'EWALLET',
  COD = 'COD',
}

export class CreatePaymentDto {
  @IsUUID()
  orderId!: string;

  @IsEnum(PaymentMethodDto)
  method!: PaymentMethodDto;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  externalReference?: string;
}
