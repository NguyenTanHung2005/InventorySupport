import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../common/request.js';
import { Permission } from '../common/permissions.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';
import { RequirePermissions } from '../auth/permissions.decorator.js';
import { CreateProductDto, UpdateProductDto } from './dto/create-product.dto.js';
import type { ProductQuery } from './dto/create-product.dto.js';
import { ProductsService } from './products.service.js';

@Controller('products')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions(Permission.PRODUCT_VIEW)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest, @Query() query: ProductQuery) {
    return this.productsService.list(request.user, query);
  }

  @Get('categories')
  categories(@Req() request: AuthenticatedRequest) {
    return this.productsService.categories(request.user);
  }

  /** Phân tích chuỗi camera đọc được (mã vạch / QR) và tìm sản phẩm. */
  @Get('resolve')
  resolve(@Query('raw') raw: string, @Req() request: AuthenticatedRequest) {
    return this.productsService.resolve(raw, request.user);
  }

  @Get(':id/label')
  label(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.productsService.label(id, request.user);
  }

  @Get('barcode/:barcode')
  findByBarcode(@Param('barcode') barcode: string, @Req() request: AuthenticatedRequest) {
    return this.productsService.findByBarcode(barcode, request.user);
  }

  @Get(':id')
  findById(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.productsService.findById(id, request.user);
  }

  @Post()
  @RequirePermissions(Permission.PRODUCT_CREATE)
  create(@Body() dto: CreateProductDto, @Req() request: AuthenticatedRequest) {
    return this.productsService.create(dto, request.user);
  }

  @Patch(':id')
  @RequirePermissions(Permission.PRODUCT_UPDATE)
  update(@Param('id') id: string, @Body() dto: UpdateProductDto, @Req() request: AuthenticatedRequest) {
    return this.productsService.update(id, dto, request.user);
  }

  @Delete(':id')
  @RequirePermissions(Permission.PRODUCT_DELETE)
  remove(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.productsService.remove(id, request.user);
  }
}
