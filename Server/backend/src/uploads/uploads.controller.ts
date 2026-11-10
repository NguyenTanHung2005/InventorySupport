import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest } from '../common/request.js';
import { Permission } from '../common/permissions.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';
import { RequirePermissions } from '../auth/permissions.decorator.js';
import { UploadImageDto, UploadsService } from './uploads.service.js';

@Controller('uploads')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  /** Dùng cho ảnh sản phẩm và ảnh chụp để AI nhận diện. */
  @Post('image')
  @RequirePermissions(Permission.AI_USE)
  upload(@Req() request: AuthenticatedRequest, @Body() dto: UploadImageDto) {
    return this.uploadsService.saveImage(request.user, dto);
  }
}
