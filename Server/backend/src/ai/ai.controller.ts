import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AuthUser } from '../common/types.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { NormalizeProductDto } from './dto/normalize-product.dto.js';
import { AiService } from './ai.service.js';

type AuthenticatedRequest = Request & { user: AuthUser };

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('normalize-product')
  normalizeProduct(
    @Body() dto: NormalizeProductDto,
    @Req() _request: AuthenticatedRequest,
  ) {
    return this.aiService.normalizeProduct(dto);
  }
}
