import { IsEmail, IsOptional, IsString, Length, MinLength } from 'class-validator';

export class RegisterDto {
  @IsString()
  @Length(2, 120)
  name!: string;

  @IsEmail()
  @Length(3, 254)
  email!: string;

  @IsOptional()
  @IsString()
  @Length(8, 24)
  phone?: string;

  @IsString()
  @MinLength(12)
  @Length(12, 128)
  password!: string;
}

export class LoginDto {
  @IsEmail()
  @Length(3, 254)
  email!: string;

  @IsString()
  @Length(1, 128)
  password!: string;
}

export class RefreshDto {
  @IsOptional()
  @IsString()
  @Length(32, 256)
  refreshToken?: string;
}
