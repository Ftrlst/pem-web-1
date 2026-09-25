import { Body, Controller, Get, Headers, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@kletak/contracts';
import { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateOrderDto, OrderQueryDto, UpdateOrderStatusDto } from './dto/orders.dto';
import { OrdersService } from './orders.service';

@ApiTags('orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Public()
  @Post()
  @ApiOperation({ summary: 'Buat order dengan reservasi stok' })
  create(
    @Body() input: CreateOrderDto,
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() request: Request,
  ) {
    return this.orders.create(input, user, idempotencyKey, request.requestId);
  }

  @ApiBearerAuth()
  @Get()
  @Roles(UserRole.CUSTOMER, UserRole.STAFF, UserRole.SELLER, UserRole.OWNER, UserRole.ADMIN)
  list(@Query() query: OrderQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.orders.list(query, user);
  }

  @Public()
  @Get(':id/tracking')
  tracking(@Param('id') id: string, @Query('token') token: string) {
    return this.orders.getTracking(id, token);
  }

  @ApiBearerAuth()
  @Get(':id')
  get(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.orders.getById(id, user);
  }

  @ApiBearerAuth()
  @Patch(':id/status')
  @Roles(UserRole.STAFF, UserRole.SELLER, UserRole.OWNER, UserRole.ADMIN)
  updateStatus(
    @Param('id') id: string,
    @Body() input: UpdateOrderStatusDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    return this.orders.updateStatus(id, input, user, request.requestId);
  }

  @ApiBearerAuth()
  @Patch(':id/cancel')
  cancel(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser, @Req() request: Request) {
    return this.orders.cancel(id, user, request.requestId);
  }
}
