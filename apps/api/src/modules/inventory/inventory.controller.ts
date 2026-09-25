import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@kletak/contracts';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateStockMovementDto, InventoryQueryDto } from './dto/inventory.dto';
import { InventoryService } from './inventory.service';

@ApiTags('inventory')
@ApiBearerAuth()
@Controller('inventory')
@Roles(UserRole.STAFF, UserRole.SELLER, UserRole.OWNER, UserRole.ADMIN)
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get('movements')
  list(@Query() query: InventoryQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.inventory.list(query, user);
  }

  @Get('low-stock')
  lowStock(@CurrentUser() user: AuthenticatedUser) {
    return this.inventory.lowStock(user);
  }

  @Post('movements')
  create(@Body() input: CreateStockMovementDto, @CurrentUser() user: AuthenticatedUser) {
    return this.inventory.create(input, user);
  }
}
