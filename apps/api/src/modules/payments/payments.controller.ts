import { Body, Controller, Get, Headers, Param, Patch, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@kletak/contracts';
import { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreatePaymentDto } from './dto/payments.dto';
import { PaymentsService } from './payments.service';

@ApiTags('payments')
@ApiBearerAuth()
@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Public()
  @Post('webhooks/:provider')
  webhook(
    @Param('provider') provider: string,
    @Body() body: Record<string, unknown>,
    @Req() request: Request & { rawBody?: Buffer },
  ) {
    return this.payments.handleWebhook(
      provider,
      body,
      request.rawBody,
      request.headers,
      request.requestId,
    );
  }

  @Post()
  create(
    @Body() input: CreatePaymentDto,
    @CurrentUser() user: AuthenticatedUser,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() request: Request,
  ) {
    return this.payments.create(input, user, idempotencyKey, request.requestId);
  }

  @Get(':id')
  get(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.payments.getById(id, user);
  }

  @Patch(':id/verify')
  @Roles(UserRole.STAFF, UserRole.SELLER, UserRole.OWNER, UserRole.ADMIN)
  verify(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Req() request: Request) {
    return this.payments.verify(id, user, request.requestId);
  }
}
