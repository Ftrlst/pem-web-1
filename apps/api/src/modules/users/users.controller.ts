import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { UsersService } from './users.service';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @Length(2, 120)
  name?: string;

  @IsOptional()
  @IsString()
  @Length(8, 24)
  phone?: string;
}

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.users.getProfile(user.id);
  }

  @Patch('me')
  update(@CurrentUser() user: AuthenticatedUser, @Body() input: UpdateProfileDto) {
    return this.users.updateProfile(user.id, input);
  }
}
