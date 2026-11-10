import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest } from '../common/request.js';
import { Permission } from '../common/permissions.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';
import { RequirePermissions } from '../auth/permissions.decorator.js';
import { StockMovementDto } from './dto/stock-movement.dto.js';
import type { TransactionQuery } from './dto/stock-movement.dto.js';
import { InventoryService } from './inventory.service.js';

@Controller('inventory')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  /** Quyền chi tiết (nhập / xuất / kiểm kê) được kiểm tra theo `type` trong service. */
  @Post('movement')
  move(@Body() dto: StockMovementDto, @Req() request: AuthenticatedRequest) {
    return this.inventoryService.move(dto, request.user);
  }

  @Get('low-stock')
  @RequirePermissions(Permission.PRODUCT_VIEW)
  lowStock(@Req() request: AuthenticatedRequest) {
    return this.inventoryService.lowStock(request.user);
  }

  @Get('transactions')
  @RequirePermissions(Permission.PRODUCT_VIEW)
  transactions(@Req() request: AuthenticatedRequest, @Query() query: TransactionQuery) {
    return this.inventoryService.transactions(request.user, query);
  }

  @Get('summary')
  @RequirePermissions(Permission.PRODUCT_VIEW)
  summary(@Req() request: AuthenticatedRequest, @Query() query: Pick<TransactionQuery, 'from' | 'to'>) {
    return this.inventoryService.summary(request.user, query);
  }
}
