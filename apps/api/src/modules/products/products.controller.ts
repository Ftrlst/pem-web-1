import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@kletak/contracts';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateProductDto, ProductQueryDto, UpdateProductDto } from './dto/products.dto';
import { ProductsService } from './products.service';

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Katalog produk' })
  list(@Query() query: ProductQueryDto, @CurrentUser() user?: AuthenticatedUser) {
    return this.products.list(query, user);
  }

  @Public()
  @Get(':id')
  get(@Param('id') id: string, @CurrentUser() user?: AuthenticatedUser) {
    return this.products.getById(id, user);
  }

  @ApiBearerAuth()
  @Roles(UserRole.SELLER, UserRole.OWNER, UserRole.ADMIN)
  @Post()
  create(@Body() input: CreateProductDto, @CurrentUser() user: AuthenticatedUser) {
    return this.products.create(input, user);
  }

  @ApiBearerAuth()
  @Roles(UserRole.SELLER, UserRole.OWNER, UserRole.ADMIN)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() input: UpdateProductDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.products.update(id, input, user);
  }

  @ApiBearerAuth()
  @Roles(UserRole.SELLER, UserRole.OWNER, UserRole.ADMIN)
  @Delete(':id')
  deactivate(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.products.deactivate(id, user);
  }
}
