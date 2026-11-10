import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest } from '../common/request.js';
import { Permission } from '../common/permissions.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';
import { RequirePermissions } from '../auth/permissions.decorator.js';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto.js';
import { UsersService } from './users.service.js';

@Controller('users')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions(Permission.USER_MANAGE)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  list(
    @Req() request: AuthenticatedRequest,
    @Query() query: { page?: string; limit?: string; search?: string; role?: string },
  ) {
    return this.usersService.list(request.user, query);
  }

  @Post()
  create(@Req() request: AuthenticatedRequest, @Body() dto: CreateUserDto) {
    return this.usersService.create(request.user, dto);
  }

  @Patch(':id')
  update(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(request.user, id, dto);
  }

  @Delete(':id')
  remove(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.usersService.remove(request.user, id);
  }
}
