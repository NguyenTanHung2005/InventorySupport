import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest } from '../common/request.js';
import { Permission } from '../common/permissions.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';
import { RequirePermissions } from '../auth/permissions.decorator.js';
import { ProductsService } from '../products/products.service.js';
import { NormalizeProductDto, ScanImageDto } from './dto/normalize-product.dto.js';
import { AiService } from './ai.service.js';

@Controller('ai')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions(Permission.AI_USE)
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly productsService: ProductsService,
  ) {}

  @Get('status')
  status() {
    return { provider: this.aiService.providerEnabled ? 'claude' : 'heuristic' };
  }

  @Post('normalize-product')
  normalizeProduct(@Body() dto: NormalizeProductDto, @Req() request: AuthenticatedRequest) {
    return this.aiService.normalize(dto, this.productsService.categories(request.user));
  }

  /** Nhận diện ảnh + đối chiếu với sản phẩm đang có trong cửa hàng. */
  @Post('scan-image')
  async scanImage(@Body() dto: ScanImageDto, @Req() request: AuthenticatedRequest) {
    const result = await this.aiService.scanImage(
      String(dto.imageUrl ?? ''),
      request.user.storeId,
      this.productsService.categories(request.user),
      typeof dto.note === 'string' ? dto.note : undefined,
    );
    return {
      ...result,
      imageUrl: dto.imageUrl,
      suggestions: result.suggestions.map((suggestion) => ({
        ...suggestion,
        matchedProducts: this.productsService.match(request.user, {
          barcode: suggestion.barcode,
          name: suggestion.normalizedName,
        }),
      })),
    };
  }
}
