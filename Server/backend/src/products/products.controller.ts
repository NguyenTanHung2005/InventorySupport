import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AuthUser, UserRole } from '../common/types.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { ProductsService } from './products.service.js';

type AuthenticatedRequest = Request & { user: AuthUser };

@Controller('products')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest) {
    return this.productsService.list(request.user);
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
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  create(@Body() dto: CreateProductDto, @Req() request: AuthenticatedRequest) {
    return this.productsService.create(dto, request.user);
  }
}
