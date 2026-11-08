import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AuthUser, UserRole } from '../common/types.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { StockMovementDto } from './dto/stock-movement.dto.js';
import { InventoryService } from './inventory.service.js';

type AuthenticatedRequest = Request & { user: AuthUser };

@Controller('inventory')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Post('movement')
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.STAFF)
  move(@Body() dto: StockMovementDto, @Req() request: AuthenticatedRequest) {
    return this.inventoryService.move(dto, request.user);
  }

  @Get('low-stock')
  lowStock(@Req() request: AuthenticatedRequest) {
    return this.inventoryService.lowStock(request.user);
  }

  @Get('transactions')
  transactions(@Req() request: AuthenticatedRequest) {
    return this.inventoryService.transactions(request.user);
  }
}
