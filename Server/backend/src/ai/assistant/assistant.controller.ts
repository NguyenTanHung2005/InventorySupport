import { Body, Controller, Delete, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest } from '../../common/request.js';
import { Permission } from '../../common/permissions.js';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../auth/guards/permissions.guard.js';
import { RequirePermissions } from '../../auth/permissions.decorator.js';
import { AssistantChatDto } from './assistant.types.js';
import { AssistantService } from './assistant.service.js';

@Controller('ai/assistant')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions(Permission.AI_USE)
export class AssistantController {
  constructor(private readonly assistant: AssistantService) {}

  @Post('chat')
  chat(@Req() request: AuthenticatedRequest, @Body() dto: AssistantChatDto) {
    return this.assistant.chat(request.user, dto);
  }

  @Delete('sessions/:id')
  reset(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.assistant.reset(request.user, id);
  }
}
