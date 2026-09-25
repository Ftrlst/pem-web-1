import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserRole } from '@kletak/contracts';

export type AuthenticatedUser = {
  id: string;
  role: UserRole;
  outletId: string | null;
};

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const request = context.switchToHttp().getRequest<{ user: AuthenticatedUser }>();
    return request.user;
  },
);
