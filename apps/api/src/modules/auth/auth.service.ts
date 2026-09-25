import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@kletak/contracts';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PasswordService } from '../../common/security/password.service';
import { randomToken, sha256 } from '../../common/security/token.util';
import { LoginDto, RegisterDto } from './dto/auth.dto';

type AccessPayload = {
  sub: string;
  role: UserRole;
  outletId: string | null;
};

@Injectable()
export class AuthService {
  private readonly refreshCookieName = 'kletak_refresh_token';

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly passwords: PasswordService,
    private readonly config: ConfigService,
  ) {}

  async register(input: RegisterDto) {
    const email = input.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) throw new ConflictException('Email sudah terdaftar');

    const outlet = await this.prisma.outlet.findFirst({ orderBy: { createdAt: 'asc' } });
    if (!outlet) throw new ConflictException('Outlet belum dikonfigurasi');

    const user = await this.prisma.user.create({
      data: {
        name: input.name.trim(),
        email,
        phone: input.phone?.trim() || null,
        passwordHash: await this.passwords.hash(input.password),
        role: UserRole.CUSTOMER,
        outletId: outlet.id,
      },
    });
    return this.issueSession(user);
  }

  async login(input: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email.trim().toLowerCase() },
    });
    if (
      !user ||
      !user.isActive ||
      !(await this.passwords.verify(user.passwordHash, input.password))
    ) {
      throw new UnauthorizedException('Email atau password salah');
    }
    return this.issueSession(user);
  }

  async refresh(rawToken?: string) {
    if (!rawToken) throw new UnauthorizedException('Refresh token tidak ditemukan');
    const tokenHash = sha256(rawToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (!stored || !stored.user.isActive)
      throw new UnauthorizedException('Refresh token tidak valid');

    if (stored.revokedAt) {
      await this.prisma.refreshToken.updateMany({
        where: { familyId: stored.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Refresh token sudah digunakan');
    }
    if (stored.expiresAt <= new Date())
      throw new UnauthorizedException('Refresh token kedaluwarsa');

    const nextRawToken = randomToken();
    const expiresAt = new Date(Date.now() + this.refreshTtlDays * 24 * 60 * 60 * 1000);
    await this.prisma.$transaction([
      this.prisma.refreshToken.update({
        where: { id: stored.id },
        data: { revokedAt: new Date() },
      }),
      this.prisma.refreshToken.create({
        data: {
          userId: stored.userId,
          tokenHash: sha256(nextRawToken),
          familyId: stored.familyId,
          expiresAt,
        },
      }),
    ]);

    return {
      accessToken: await this.createAccessToken(stored.user),
      expiresIn: this.accessTtlSeconds,
      refreshToken: nextRawToken,
      user: this.publicUser(stored.user),
    };
  }

  async logout(rawToken?: string) {
    if (!rawToken) return;
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: sha256(rawToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) throw new UnauthorizedException('Pengguna tidak aktif');
    return this.publicUser(user);
  }

  private async issueSession(user: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    role: UserRole;
    outletId: string | null;
  }) {
    const rawRefreshToken = randomToken();
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: sha256(rawRefreshToken),
        familyId: randomToken(18),
        expiresAt: new Date(Date.now() + this.refreshTtlDays * 24 * 60 * 60 * 1000),
      },
    });
    return {
      accessToken: await this.createAccessToken(user),
      expiresIn: this.accessTtlSeconds,
      refreshToken: rawRefreshToken,
      user: this.publicUser(user),
    };
  }

  private async createAccessToken(user: {
    id: string;
    role: UserRole;
    outletId: string | null;
  }): Promise<string> {
    const payload: AccessPayload = { sub: user.id, role: user.role, outletId: user.outletId };
    return this.jwt.signAsync(payload, {
      expiresIn: this.config.get<string>('ACCESS_TOKEN_TTL', '15m') as never,
    });
  }

  private publicUser(user: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    role: UserRole;
  }) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
    };
  }

  private get refreshTtlDays(): number {
    return this.config.get<number>('REFRESH_TOKEN_TTL_DAYS', 30);
  }

  private get accessTtlSeconds(): number {
    const value = this.config.get<string>('ACCESS_TOKEN_TTL', '15m');
    const match = /^(\d+)([smhd])$/.exec(value);
    if (!match) return 900;
    const amount = Number(match[1]);
    const multiplier = { s: 1, m: 60, h: 3600, d: 86400 }[match[2]] ?? 60;
    return amount * multiplier;
  }

  getRefreshCookieName(): string {
    return this.refreshCookieName;
  }

  getRefreshCookieOptions() {
    return {
      httpOnly: true,
      secure: this.config.get<boolean>('COOKIE_SECURE', false),
      sameSite: 'lax' as const,
      path: '/api/v1/auth',
      maxAge: this.refreshTtlDays * 24 * 60 * 60 * 1000,
    };
  }
}
