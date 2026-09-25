import { Injectable, NotFoundException } from '@nestjs/common';
import { UserRole } from '@kletak/contracts';
import { PrismaService } from '../../common/prisma/prisma.service';
import { UpdateProfileDto } from './users.controller';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Pengguna tidak ditemukan');
    return this.publicUser(user);
  }

  async updateProfile(userId: string, input: UpdateProfileDto) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(input.name ? { name: input.name.trim() } : {}),
        ...(input.phone !== undefined ? { phone: input.phone.trim() || null } : {}),
      },
    });
    return this.publicUser(user);
  }

  private publicUser(user: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    role: UserRole;
  }) {
    return { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role };
  }
}
