import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest } from '../common/request.js';
import { Permission } from '../common/permissions.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';
import { RequirePermissions } from '../auth/permissions.decorator.js';
import { ProductsService } from '../products/products.service.js';
import { NormalizeProductDto, ScanImageDto } from './dto/normalize-product.dto.js';
import { AiService } from './ai.service.js';
import { AssistantService } from './assistant/assistant.service.js';
import { MAX_TURNS } from './assistant/assistant-session.store.js';

@Controller('ai')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions(Permission.AI_USE)
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly productsService: ProductsService,
    private readonly assistant: AssistantService,
  ) {}

  @Get('status')
  status() {
    return {
      provider: this.aiService.providerEnabled ? 'claude' : 'heuristic',
      assistant: {
        provider: this.assistant.provider,
        model: this.assistant.provider === 'claude' ? this.assistant.model : undefined,
        maxTurns: MAX_TURNS,
      },
    };
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

  /**
   * Đọc phiếu nhập: AI trích dòng hàng, backend đối chiếu với kho. KHÔNG ghi dữ liệu;
   * mobile cho người dùng duyệt rồi mới gọi POST /inventory/batch.
   */
  @Post('scan-invoice')
  @RequirePermissions(Permission.AI_USE, Permission.STOCK_IMPORT)
  async scanInvoice(@Body() dto: ScanImageDto, @Req() request: AuthenticatedRequest) {
    const result = await this.aiService.scanInvoice(String(dto.imageUrl ?? ''), request.user.storeId);
    return {
      ...result,
      imageUrl: dto.imageUrl,
      lines: result.lines.map((line, index) => ({
        ...line,
        index,
        // Ứng viên tốt nhất đứng đầu; mobile chọn sẵn ứng viên đầu tiên.
        candidates: this.productsService.match(request.user, { barcode: line.barcode || undefined, name: line.name }),
      })),
    };
  }
}
