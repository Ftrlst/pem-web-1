import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { UserRole } from '@kletak/contracts';
import { Roles } from '../../common/decorators/roles.decorator';
import { AccountingService } from './accounting.service';

class JournalQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 50;
}

@ApiTags('accounting')
@ApiBearerAuth()
@Controller('accounting')
@Roles(UserRole.OWNER, UserRole.ADMIN)
export class AccountingController {
  constructor(private readonly accounting: AccountingService) {}

  @Get('coa')
  coa() {
    return this.accounting.coa();
  }

  @Get('journals')
  journals(@Query() query: JournalQueryDto) {
    return this.accounting.journals(query);
  }

  @Get('ledger')
  ledger(
    @Query('accountCode') accountCode: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.accounting.ledger(accountCode, from, to);
  }

  @Get('trial-balance')
  trialBalance(@Query('from') from?: string, @Query('to') to?: string) {
    return this.accounting.trialBalance(from, to);
  }
}
