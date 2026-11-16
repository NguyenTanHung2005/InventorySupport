import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';
import { RequirePermissions } from '../auth/permissions.decorator.js';
import { Permission } from '../common/permissions.js';
import type { AuthenticatedRequest } from '../common/request.js';
import { StocktakesService } from './stocktakes.service.js';
import type { StocktakeInput } from './stocktakes.service.js';
@Controller('stocktakes')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions(Permission.STOCK_ADJUST)
export class StocktakesController {
  constructor(private readonly service: StocktakesService) {}
  @Post() create(@Req() req: AuthenticatedRequest) {
    return this.service.create(req.user);
  }
  @Get() list(
    @Req() req: AuthenticatedRequest,
    @Query() query: { page?: string; limit?: string; status?: string },
  ) {
    return this.service.list(req.user, query);
  }
  @Get(':id') detail(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.detail(id, req.user);
  }
  @Post(':id/identify') identify(
    @Param('id') id: string,
    @Body() body: StocktakeInput,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.identify(id, body, req.user);
  }
  @Put(':id/items/:productId') save(
    @Param('id') id: string,
    @Param('productId') productId: string,
    @Body() body: StocktakeInput,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.save(id, productId, body, req.user);
  }
  @Delete(':id/items/:productId') remove(
    @Param('id') id: string,
    @Param('productId') productId: string,
    @Body() body: StocktakeInput,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.remove(id, productId, body, req.user);
  }
  @Post(':id/complete') complete(
    @Param('id') id: string,
    @Body() body: StocktakeInput,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.complete(id, body, req.user);
  }
  @Post(':id/cancel') cancel(
    @Param('id') id: string,
    @Body() body: StocktakeInput,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.cancel(id, body, req.user);
  }
}
